// Shared Square Connect API helpers.
//
// Credentials come from project secrets and are only ever used server-side:
//   SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_ENVIRONMENT,
//   SQUARE_WEBHOOK_SIGNATURE_KEY

export const SQUARE_API_VERSION = '2024-10-17';

export function squareBase(): string {
  const env = (Deno.env.get('SQUARE_ENVIRONMENT') ?? 'sandbox').toLowerCase();
  return env === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

export function squareToken(): string {
  const token = Deno.env.get('SQUARE_ACCESS_TOKEN');
  if (!token) throw new Error('Square is not configured (missing SQUARE_ACCESS_TOKEN)');
  return token;
}

export function squareLocationId(): string {
  const id = Deno.env.get('SQUARE_LOCATION_ID');
  if (!id) throw new Error('Square is not configured (missing SQUARE_LOCATION_ID)');
  return id;
}

export async function squareFetch(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(`${squareBase()}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Authorization': `Bearer ${squareToken()}`,
      'Square-Version': SQUARE_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let body: any = null;
  try { body = await res.json(); } catch { body = null; }
  return { ok: res.ok, status: res.status, body };
}

export function squareErrorMessage(body: any, fallback: string): string {
  const errs = body?.errors;
  if (Array.isArray(errs) && errs.length) {
    return errs.map((e: any) => e.detail || e.code).filter(Boolean).join('; ') || fallback;
  }
  return fallback;
}

/** Square money amounts are integer minor units. */
export function toMinorUnits(amount: number): number {
  return Math.round(Number(amount) * 100);
}

/**
 * Verify a Square webhook signature (HMAC-SHA256 over notificationUrl + rawBody,
 * base64-encoded), per Square's webhook documentation.
 */
export async function verifySquareSignature(
  rawBody: string,
  signature: string | null,
  notificationUrl: string,
): Promise<boolean> {
  const key = Deno.env.get('SQUARE_WEBHOOK_SIGNATURE_KEY');
  if (!key || !signature) return false;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(notificationUrl + rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
