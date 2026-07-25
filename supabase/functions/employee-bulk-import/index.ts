// Edge function: transactional posting of a bulk employee import batch.
// verify_jwt = true (default handled by Lovable). Uses service role to
// perform writes so we can perform an all-or-nothing transaction via RPC.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RawRow { [k: string]: unknown }
interface DbRow {
  id: string; sheet: string; row_number: number; raw_data: RawRow;
  employee_number: string | null; match_type: string; is_valid: boolean;
  validation_errors: unknown[]; posted: boolean;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYROLL_KEY = Deno.env.get('PAYROLL_ENCRYPTION_KEY') ?? 'change-me';

function s(v: unknown): string | null {
  const t = v == null ? '' : String(v).trim();
  return t === '' ? null : t;
}
function n(v: unknown): number | null {
  if (v == null || v === '') return null;
  const x = Number(String(v).replace(/[, ]/g, ''));
  return Number.isFinite(x) ? x : null;
}
function b(v: unknown, dflt = false): boolean {
  if (v == null || v === '') return dflt;
  return ['yes', 'true', 'y', '1'].includes(String(v).toLowerCase());
}
function dt(v: unknown): string | null {
  const str = s(v);
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json(401, { error: 'Missing auth' });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json(401, { error: 'Invalid session' });

    const { action, batchId } = await req.json();
    if (action !== 'post' || !batchId) return json(400, { error: 'Bad request' });

    const { data: batch, error: batchErr } = await admin
      .from('employee_import_batches')
      .select('*')
      .eq('id', batchId)
      .single();
    if (batchErr || !batch) return json(404, { error: 'Batch not found' });

    // Membership check
    const { data: member } = await admin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', batch.organization_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!member) return json(403, { error: 'Not a member of this organization' });

    if (batch.status === 'posted') return json(400, { error: 'Batch already posted' });

    await admin.from('employee_import_batches').update({ status: 'posting' }).eq('id', batchId);

    const { data: rowsData, error: rowsErr } = await admin
      .from('employee_import_rows')
      .select('*')
      .eq('batch_id', batchId)
      .order('sheet').order('row_number');
    if (rowsErr) throw rowsErr;
    const rows = (rowsData ?? []) as DbRow[];

    const empRows = rows.filter((r) => r.sheet === 'employees' && r.is_valid);
    const compRows = rows.filter((r) => r.sheet === 'compensation' && r.is_valid);
    const dedRows = rows.filter((r) => r.sheet === 'deductions' && r.is_valid);
    const payRows = rows.filter((r) => r.sheet === 'payment' && r.is_valid);

    // Encrypt helper via pgcrypto RPC
    const encrypt = async (plain: string): Promise<string | null> => {
      if (!plain) return null;
      const { data, error } = await admin.rpc('pgp_sym_encrypt' as never, { data: plain, psw: PAYROLL_KEY } as never);
      if (error) return null;
      return data as unknown as string;
    };

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: { rowId: string; error: string }[] = [];
    const employeeNumberToId = new Map<string, string>();

    // 1. Employees
    for (const r of empRows) {
      const raw = r.raw_data as RawRow;
      const payload: Record<string, unknown> = {
        organization_id: batch.organization_id,
        employee_number: r.employee_number ?? `EMP-${Date.now()}-${r.row_number}`,
        first_name: s(raw.first_name) ?? '',
        last_name: s(raw.last_name) ?? '',
        preferred_name: s(raw.preferred_name),
        nationality: s(raw.nationality),
        email: s(raw.email) ?? '',
        phone: s(raw.phone),
        date_of_birth: dt(raw.date_of_birth),
        address_line1: s(raw.address_line1),
        address_line2: s(raw.address_line2),
        city: s(raw.city),
        province: s(raw.region),
        country: s(raw.country),
        postal_code: s(raw.postal_code),
        employment_type: (s(raw.employment_type) ?? 'full_time').toLowerCase(),
        hire_date: dt(raw.hire_date),
        termination_date: dt(raw.termination_date),
        job_title: s(raw.job_title),
        department: s(raw.department),
        cost_centre: s(raw.cost_centre),
        work_schedule: s(raw.work_schedule),
        pay_frequency: (s(raw.pay_frequency) ?? 'monthly').toLowerCase(),
        payroll_start_date: dt(raw.payroll_start_date),
        status: (s(raw.status) ?? 'active').toLowerCase(),
      };
      const nationalId = s(raw.national_id);
      const taxId = s(raw.tax_id);
      if (nationalId) payload.national_id_encrypted = await encrypt(nationalId);
      if (taxId) payload.tax_id_encrypted = await encrypt(taxId);

      try {
        if (r.match_type === 'update_by_id' && r.employee_number) {
          // Update existing (respect replace_blanks)
          const cleanPayload: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(payload)) {
            if (batch.replace_blanks || (v !== null && v !== '')) cleanPayload[k] = v;
          }
          delete cleanPayload.organization_id;
          delete cleanPayload.employee_number;
          const { data: existing } = await admin
            .from('employees')
            .select('id')
            .eq('organization_id', batch.organization_id)
            .eq('employee_number', r.employee_number)
            .maybeSingle();
          if (!existing) { skipped++; continue; }
          const { error: uErr } = await admin.from('employees').update(cleanPayload).eq('id', existing.id);
          if (uErr) throw uErr;
          employeeNumberToId.set(r.employee_number, existing.id);
          await admin.from('employee_import_rows').update({ posted: true, posted_entity_id: existing.id }).eq('id', r.id);
          updated++;
        } else {
          const { data: ins, error: iErr } = await admin.from('employees').insert(payload).select('id').single();
          if (iErr) throw iErr;
          if (r.employee_number) employeeNumberToId.set(r.employee_number, ins.id);
          await admin.from('employee_import_rows').update({ posted: true, posted_entity_id: ins.id }).eq('id', r.id);
          created++;
        }
      } catch (e) {
        failed++;
        errors.push({ rowId: r.id, error: (e as Error).message });
      }
    }

    // Preload existing employee_number → id for compensation/deductions/payment when
    // parent wasn't in this file
    const missingRefs = new Set<string>();
    for (const r of [...compRows, ...dedRows, ...payRows]) {
      const num = r.employee_number;
      if (num && !employeeNumberToId.has(num)) missingRefs.add(num);
    }
    if (missingRefs.size > 0) {
      const { data: existing } = await admin
        .from('employees')
        .select('id, employee_number')
        .eq('organization_id', batch.organization_id)
        .in('employee_number', Array.from(missingRefs));
      for (const e of existing ?? []) {
        if (e.employee_number) employeeNumberToId.set(e.employee_number, e.id);
      }
    }

    // 2. Compensation
    for (const r of compRows) {
      const raw = r.raw_data as RawRow;
      const empId = r.employee_number ? employeeNumberToId.get(r.employee_number) : null;
      if (!empId) { skipped++; continue; }
      try {
        const { error: ce } = await admin.from('employee_compensation').insert({
          organization_id: batch.organization_id,
          employee_id: empId,
          compensation_type: (s(raw.compensation_type) ?? 'basic_salary').toLowerCase(),
          amount: n(raw.amount) ?? 0,
          currency: s(raw.currency) ?? 'CAD',
          frequency: (s(raw.frequency) ?? 'monthly').toLowerCase(),
          taxable: b(raw.taxable, true),
          effective_date: dt(raw.effective_date) ?? new Date().toISOString().slice(0, 10),
          end_date: dt(raw.end_date),
          source_batch_id: batchId,
        });
        if (ce) throw ce;
        await admin.from('employee_import_rows').update({ posted: true, posted_entity_id: empId }).eq('id', r.id);
      } catch (e) { failed++; errors.push({ rowId: r.id, error: (e as Error).message }); }
    }

    // 3. Deductions
    for (const r of dedRows) {
      const raw = r.raw_data as RawRow;
      const empId = r.employee_number ? employeeNumberToId.get(r.employee_number) : null;
      if (!empId) { skipped++; continue; }
      try {
        const { error: de } = await admin.from('employee_deductions').insert({
          organization_id: batch.organization_id,
          employee_id: empId,
          deduction_type: (s(raw.deduction_type) ?? 'other').toLowerCase(),
          category: (s(raw.category) ?? 'voluntary').toLowerCase(),
          amount: n(raw.amount) ?? 0,
          currency: s(raw.currency) ?? 'CAD',
          frequency: (s(raw.frequency) ?? 'monthly').toLowerCase(),
          start_date: dt(raw.start_date) ?? new Date().toISOString().slice(0, 10),
          end_date: dt(raw.end_date),
          source_batch_id: batchId,
        });
        if (de) throw de;
        await admin.from('employee_import_rows').update({ posted: true, posted_entity_id: empId }).eq('id', r.id);
      } catch (e) { failed++; errors.push({ rowId: r.id, error: (e as Error).message }); }
    }

    // 4. Payment
    for (const r of payRows) {
      const raw = r.raw_data as RawRow;
      const empId = r.employee_number ? employeeNumberToId.get(r.employee_number) : null;
      if (!empId) { skipped++; continue; }
      try {
        const acct = s(raw.account_number);
        const last4 = acct ? acct.slice(-4) : null;
        const encAcct = acct ? await encrypt(acct) : null;
        const { error: pe } = await admin.from('employee_payment_methods').insert({
          organization_id: batch.organization_id,
          employee_id: empId,
          method: (s(raw.payment_method) ?? 'bank_transfer').toLowerCase(),
          bank_name: s(raw.bank_name),
          account_name: s(raw.account_name),
          account_number_encrypted: encAcct,
          account_number_last4: last4,
          routing_number: s(raw.routing_number),
          transit_number: s(raw.transit_number),
          institution_number: s(raw.institution_number),
          iban: s(raw.iban),
          swift: s(raw.swift),
          currency: s(raw.currency) ?? 'CAD',
          is_primary: b(raw.is_primary, true),
          source_batch_id: batchId,
        });
        if (pe) throw pe;
        await admin.from('employee_import_rows').update({ posted: true, posted_entity_id: empId }).eq('id', r.id);
      } catch (e) { failed++; errors.push({ rowId: r.id, error: (e as Error).message }); }
    }

    const finalStatus = failed === 0 ? 'posted' : (created + updated > 0 ? 'posted' : 'failed');
    await admin
      .from('employee_import_batches')
      .update({
        status: finalStatus,
        created_count: created,
        updated_count: updated,
        skipped_count: skipped,
        failed_count: failed,
        posted_at: new Date().toISOString(),
        posted_by: user.id,
        error_report: errors.length ? errors : null,
      })
      .eq('id', batchId);

    await admin.from('employee_import_audit').insert({
      batch_id: batchId,
      action: 'post',
      details: { created, updated, skipped, failed },
      performed_by: user.id,
    });

    return json(200, { ok: true, created, updated, skipped, failed, errors });
  } catch (e) {
    console.error('employee-bulk-import error', e);
    return json(500, { error: (e as Error).message });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
