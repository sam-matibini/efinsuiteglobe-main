// Writes an upload plan to the database with the signed-in user's session.
// Row-level security already lets organization members insert/update
// employees, so no edge function or service key is needed.

import type { SupabaseClient } from '@supabase/supabase-js';
import { RowPlan, UploadMode, UploadPlan } from './plan';
import { TEMPLATE_VERSION } from './schema';

export interface CommitInput {
  plan: UploadPlan;
  organizationId: string;
  userId: string | null;
  mode: UploadMode;
  replaceBlanks: boolean;
  file: { name: string; size: number; hash: string | null };
  onProgress?: (done: number, total: number) => void;
}

export interface RowResult {
  rowNumber: number;
  employeeNumber: string;
  name: string;
  action: 'create' | 'update' | 'skip';
  status: 'created' | 'updated' | 'failed' | 'skipped';
  employeeId?: string;
  message?: string;
}

export interface CommitResult {
  batchId: string | null;
  created: number;
  updated: number;
  failed: number;
  skipped: number;
  results: RowResult[];
  /** Set when the history record could not be written (the import itself still ran). */
  historyWarning?: string;
}

const CHUNK = 25;

/** Turns Postgres/PostgREST errors into something an HR user can act on. */
export function friendlyError(e: unknown): string {
  const err = e as { message?: string; details?: string; code?: string };
  const msg = err?.message ?? String(e);
  if (/employees_(organization_email_unique|unique_active_email)/.test(msg)) return 'Another employee already uses this email.';
  if (/employees_organization_employee_number_unique/.test(msg)) return 'Another employee already uses this Employee ID.';
  if (/NIN\)? is required/i.test(msg)) return 'National ID (NIN) must be exactly 11 digits for Nigerian employees.';
  if (/invalid input value for enum (\w+): "([^"]*)"/.test(msg)) {
    const [, type, val] = msg.match(/invalid input value for enum (\w+): "([^"]*)"/)!;
    return `"${val}" is not a valid ${type.replace(/_/g, ' ')}.`;
  }
  if (/violates row-level security/i.test(msg)) return 'You do not have permission to add employees to this organization.';
  if (/job_site_id/.test(msg) && /foreign key/i.test(msg)) return 'The job site no longer exists.';
  return [msg, err?.details].filter(Boolean).join(' — ');
}

export async function commitPlan(db: SupabaseClient, input: CommitInput): Promise<CommitResult> {
  const { plan, organizationId } = input;
  const valid = plan.fileErrors.length ? [] : plan.rows.filter((r) => r.errors.length === 0);
  const results = new Map<number, RowResult>();
  for (const r of plan.rows) {
    if (plan.fileErrors.length || r.errors.length) {
      results.set(r.rowNumber, {
        rowNumber: r.rowNumber, employeeNumber: r.employeeNumber, name: r.name, action: 'skip', status: 'skipped',
        message: plan.fileErrors[0] ?? r.errors.map((e) => e.message).join(' '),
      });
    }
  }
  let historyWarning: string | undefined;

  // 1. History batch (best effort — never blocks the import).
  let batchId: string | null = null;
  {
    const { data, error } = await db
      .from('employee_import_batches')
      .insert({
        organization_id: organizationId,
        import_mode: input.mode,
        country_code: plan.country.code,
        file_name: input.file.name,
        file_hash: input.file.hash,
        file_size_bytes: input.file.size,
        template_version: TEMPLATE_VERSION,
        total_rows: plan.rows.length,
        status: 'posting',
        replace_blanks: input.replaceBlanks,
        validation_summary: plan.summary,
        created_by: input.userId,
      } as never)
      .select('id')
      .single();
    if (error) historyWarning = `Import history could not be recorded: ${error.message}`;
    else batchId = (data as { id: string }).id;
  }

  const total = valid.length;
  let done = 0;
  const tick = (n = 1) => { done += n; input.onProgress?.(done, total); };
  input.onProgress?.(0, total);

  const record = (r: RowPlan, status: RowResult['status'], employeeId?: string, message?: string) =>
    results.set(r.rowNumber, { rowNumber: r.rowNumber, employeeNumber: r.employeeNumber, name: r.name, action: r.action, status, employeeId, message });

  // 2. Creates — in chunks; a failing chunk is retried row by row to pin down the bad rows.
  const creates = valid.filter((r) => r.action === 'create');
  for (let i = 0; i < creates.length; i += CHUNK) {
    const chunk = creates.slice(i, i + CHUNK);
    const { data, error } = await db.from('employees').insert(chunk.map((r) => r.payload) as never).select('id, employee_number');
    if (!error && data) {
      const ids = new Map((data as { id: string; employee_number: string }[]).map((d) => [d.employee_number, d.id]));
      for (const r of chunk) record(r, 'created', ids.get(r.employeeNumber));
      tick(chunk.length);
      continue;
    }
    for (const r of chunk) {
      const { data: one, error: oneErr } = await db.from('employees').insert(r.payload as never).select('id').single();
      if (oneErr) record(r, 'failed', undefined, friendlyError(oneErr));
      else record(r, 'created', (one as { id: string }).id);
      tick();
    }
  }

  // 3. Updates — one row at a time, scoped to the organization.
  for (const r of valid.filter((x) => x.action === 'update')) {
    if (!r.existingId || Object.keys(r.payload).length === 0) {
      record(r, 'skipped', r.existingId, 'Nothing to update.');
      tick();
      continue;
    }
    const { error } = await db.from('employees').update(r.payload as never).eq('id', r.existingId).eq('organization_id', organizationId);
    if (error) record(r, 'failed', r.existingId, friendlyError(error));
    else record(r, 'updated', r.existingId);
    tick();
  }

  const ordered = plan.rows.map((r) => results.get(r.rowNumber)!).filter(Boolean);
  const created = ordered.filter((r) => r.status === 'created').length;
  const updated = ordered.filter((r) => r.status === 'updated').length;
  const failed = ordered.filter((r) => r.status === 'failed').length;
  const skipped = ordered.filter((r) => r.status === 'skipped').length;

  // 4. History rows, batch totals and audit (best effort).
  if (batchId) {
    const planByRow = new Map(plan.rows.map((r) => [r.rowNumber, r]));
    const rowRecords = ordered.map((res) => {
      const p = planByRow.get(res.rowNumber)!;
      return {
        batch_id: batchId,
        sheet: 'employees',
        row_number: res.rowNumber,
        raw_data: p.raw,
        employee_number: res.employeeNumber || null,
        resolved_employee_id: res.employeeId ?? null,
        // rollback_employee_import soft-deletes rows with match_type 'new'.
        match_type: p.action === 'update' ? 'update_by_id' : 'new',
        is_valid: p.errors.length === 0,
        validation_errors: p.errors,
        validation_warnings: p.warnings,
        posted: res.status === 'created' || res.status === 'updated',
        posted_entity_id: res.status === 'created' || res.status === 'updated' ? res.employeeId ?? null : null,
      };
    });
    for (let i = 0; i < rowRecords.length; i += 500) {
      const { error } = await db.from('employee_import_rows').insert(rowRecords.slice(i, i + 500) as never);
      if (error) { historyWarning = `Import row history could not be recorded: ${error.message}`; break; }
    }
    const errorReport = ordered
      .filter((r) => r.status === 'failed' || r.status === 'skipped')
      .map((r) => ({ rowId: `row-${r.rowNumber}`, sheet: 'employees', row: r.rowNumber, employeeNumber: r.employeeNumber || null, error: r.status === 'skipped' ? `Skipped: ${r.message}` : r.message }));
    await db
      .from('employee_import_batches')
      .update({
        status: created + updated > 0 ? 'posted' : 'failed',
        created_count: created,
        updated_count: updated,
        skipped_count: skipped,
        failed_count: failed,
        posted_at: new Date().toISOString(),
        posted_by: input.userId,
        error_report: errorReport.length ? errorReport : null,
      } as never)
      .eq('id', batchId);
    await db.from('employee_import_audit').insert({
      batch_id: batchId,
      action: 'post',
      details: { created, updated, skipped, failed, engine: 'client-v2' },
      performed_by: input.userId,
    } as never);
  }

  return { batchId, created, updated, failed, skipped, results: ordered, historyWarning };
}
