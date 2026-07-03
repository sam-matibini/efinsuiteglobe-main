/**
 * Phase 12 — Deterministic cache key for address tax requests.
 * Hashing keeps the key short and avoids leaking address details in indexes.
 */
import type { AddressTaxRequest } from './types';

function normalizeAddress(a: { region: string; postalCode: string; countryCode: string; city?: string }) {
  return `${a.countryCode.toUpperCase()}|${a.region.toUpperCase()}|${(a.postalCode || '').replace(/\s+/g, '').toUpperCase()}|${(a.city || '').toLowerCase().trim()}`;
}

export async function buildCacheKey(req: AddressTaxRequest, provider: string): Promise<string> {
  const linesSig = req.lines
    .map(l => `${l.id}:${Math.round(l.amount * 100)}:${l.productTaxCode ?? ''}:${l.isExempt ? 'X' : ''}`)
    .join(';');
  const raw = [
    provider,
    normalizeAddress(req.origin),
    normalizeAddress(req.destination),
    linesSig,
    req.documentDate ?? '',
    req.exemptionCertificateNumber ?? '',
  ].join('||');

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = new TextEncoder().encode(raw);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback (shouldn't be hit in modern browsers/Deno)
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) - h) + raw.charCodeAt(i);
  return `fallback_${h}`;
}
