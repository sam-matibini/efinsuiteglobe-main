/**
 * Phase 11 — NG Tax filing submission helpers.
 *
 * Two supported submission modes:
 *   - manifest : generate authority-formatted CSV manifest for manual upload
 *   - manual   : record a submission the user made outside the system
 *
 * `api` mode is stubbed; real integrations (NRS TaxProMax, LIRS eTax) will
 * plug in per-authority payload builders.
 */
import { supabase } from '@/integrations/supabase/client';

export type SubmissionMode = 'manifest' | 'manual' | 'api';

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildFilingManifest(filing: any, defCode: string): { filename: string; content: string } {
  const meta = [
    ['Field', 'Value'],
    ['Filing ID', filing.id],
    ['Tax code', defCode],
    ['Form', filing.form_code ?? ''],
    ['Period start', filing.period_start],
    ['Period end', filing.period_end],
    ['Total taxable base', filing.total_taxable_base],
    ['Total tax', filing.total_tax],
    ['Generated at', new Date().toISOString()],
  ];
  const body = meta.map(r => r.map(csvEscape).join(',')).join('\n');
  const filename = `NG-${defCode}-${filing.period_end}-${filing.id.slice(0, 8)}.csv`;
  return { filename, content: body };
}

export function downloadManifest(manifest: { filename: string; content: string }) {
  const blob = new Blob([manifest.content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = manifest.filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function submitFiling(params: {
  filingId: string;
  mode: SubmissionMode;
  reference?: string;
  payload?: Record<string, unknown>;
}) {
  const { filingId, mode, reference, payload } = params;

  const { error: subErr } = await (supabase as any).rpc('ng_submit_filing', {
    p_filing_id: filingId,
    p_confirmation_reference: reference || null,
  });
  if (subErr) throw subErr;

  const { error: metaErr } = await (supabase.from('ng_tax_filings') as any)
    .update({
      submission_mode: mode,
      submission_payload: payload ?? null,
    })
    .eq('id', filingId);
  if (metaErr) throw metaErr;
}

export async function acknowledgeFiling(filingId: string, ackRef?: string) {
  const { error } = await (supabase as any).rpc('ng_mark_filing_acknowledged', {
    p_filing_id: filingId,
    p_ack_reference: ackRef || null,
  });
  if (error) throw error;
}

export async function rejectFiling(filingId: string, reason: string) {
  const { error } = await (supabase as any).rpc('ng_mark_filing_rejected', {
    p_filing_id: filingId,
    p_reason: reason,
  });
  if (error) throw error;
}
