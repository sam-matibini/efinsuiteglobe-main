import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseDate, parseWorkbook } from './parse';
import { buildPlan, PlanContext } from './plan';
import { buildTemplateWorkbook } from './template';
import { commitPlan } from './commit';

const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({
  organizationId: 'org-1',
  countryCode: 'NG',
  mode: 'create',
  replaceBlanks: false,
  orgJurisdiction: 'LA',
  existing: [],
  jobSites: [{ id: 'site-1', name: 'Head Office', code: 'HQ' }],
  today: new Date(2026, 10, 23),
  ...over,
});

/** Writes a workbook to xlsx bytes and reads it back, like a real upload. */
function roundTrip(wb: XLSX.WorkBook) {
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return parseWorkbook(XLSX.read(bytes, { type: 'array', cellDates: false, cellNF: true }), 'test.xlsx', 1);
}

/** A sheet shaped like the user's real file: numeric NIN/Employee ID cells and real Excel dates. */
function userStyleWorkbook() {
  const headers = ['Employee ID', 'First Name', 'Middle Name', 'Last Name', 'Date of Birth', 'Gender', 'Nationality', 'National ID', 'Tax ID', 'Email', 'Hire Date', 'State/Province', 'Annual Salary'];
  const ws = XLSX.utils.aoa_to_sheet([
    headers,
    [80987080928, 'Opeyemi', 'Godwin', 'Oshin', new Date(1994, 0, 12), 'Male', 'Nigeria', 80987080928, '80987080928', 'godwin@example.com', new Date(2024, 2, 1), 'Lagos', '4,800,000'],
    [31303409860, 'Taiwo', 'Damilare', 'Odubola', new Date(1989, 6, 18), 'Male', 'Nigeria', '31303409860', '31303409860', 'tybabe@example.com', new Date(2023, 0, 9), 'LA', 3600000],
  ], { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');
  return wb;
}

describe('parse', () => {
  it('keeps 11-digit numeric NINs exact and decodes Excel dates without time-zone drift', () => {
    const parsed = roundTrip(userStyleWorkbook());
    expect(parsed.fileErrors).toEqual([]);
    expect(parsed.rows[0].values.national_id).toBe('80987080928');
    expect(parsed.rows[0].values.employee_number).toBe('80987080928');
    expect(parsed.rows[0].values.date_of_birth).toBe('1994-01-12');
    expect(parsed.rows[1].values.hire_date).toBe('2023-01-09');
  });

  it('keeps leading zeros in CSV', () => {
    const csv = 'First Name,Last Name,Email,Hire Date,National ID\nAda,Obi,ada@example.com,2026-01-02,01234567890\n';
    const wb = XLSX.read(new TextEncoder().encode(csv), { type: 'array', raw: true });
    expect(parseWorkbook(wb, 'x.csv', 1).rows[0].values.national_id).toBe('01234567890');
  });

  it('reports missing required columns', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['First Name', 'Last Name'], ['A', 'B']]), 'Employees');
    expect(roundTrip(wb).fileErrors.join(' ')).toMatch(/email.*hire date/);
  });

  it('parses common date spellings', () => {
    expect(parseDate('2026-03-04', 'DMY')).toBe('2026-03-04');
    expect(parseDate('03/04/2026', 'DMY')).toBe('2026-04-03');
    expect(parseDate('03/04/2026', 'MDY')).toBe('2026-03-04');
    expect(parseDate('7/18/1989', 'DMY')).toBe('1989-07-18');
    expect(parseDate('12 Jan 1994', 'DMY')).toBe('1994-01-12');
    expect(parseDate('31/02/2026', 'DMY')).toBeNull();
  });
});

describe('plan', () => {
  it('turns the user-style file into ready Nigerian employees', () => {
    const plan = buildPlan(roundTrip(userStyleWorkbook()), ctx());
    expect(plan.rows.map((r) => r.errors)).toEqual([[], []]);
    const p = plan.rows[0].payload;
    expect(p).toMatchObject({
      organization_id: 'org-1', employee_number: '80987080928', nin: '80987080928', province: 'LA', country: 'NG',
      email: 'godwin@example.com', hire_date: '2024-03-01', date_of_birth: '1994-01-12', annual_salary: 4800000,
      employment_type: 'full_time', pay_frequency: 'monthly', status: 'active',
    });
    expect(p.statutory_profile).toMatchObject({ tax_id: '80987080928', gender: 'Male', middle_name: 'Godwin' });
    expect(plan.summary).toMatchObject({ total: 2, ready: 2, creates: 2 });
  });

  it('validates the template example row', () => {
    const plan = buildPlan(roundTrip(buildTemplateWorkbook({ countryCode: 'NG' })), ctx());
    expect(plan.fileErrors).toEqual([]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].errors).toEqual([]);
  });

  const parsedOf = (rows: Record<string, string>[]) => ({
    fileName: 'f', fileSize: 1, sheetName: 'Employees', fileErrors: [], fileWarnings: [],
    headers: Object.keys(rows[0]).map((k) => ({ header: k, key: k })),
    rows: rows.map((values, i) => ({ rowNumber: i + 2, values })),
  });
  const base = { first_name: 'Ada', last_name: 'Obi', email: 'ada@example.com', hire_date: '2026-01-02', national_id: '12345678901', annual_salary: '100000' };

  it('enforces the NIN rule the database applies to Nigerian employees', () => {
    const errs = (row: Record<string, string>) => buildPlan(parsedOf([row]), ctx()).rows[0].errors.map((e) => e.field);
    expect(errs({ ...base, national_id: '' })).toContain('national_id');
    expect(errs({ ...base, national_id: '1234' })).toContain('national_id');
    expect(errs({ ...base, national_id: '123 4567 8901' })).toEqual([]);
  });

  it('normalises enum spellings and rejects values the database would refuse', () => {
    const plan = buildPlan(parsedOf([{ ...base, employment_type: 'Full Time', pay_frequency: 'Bi-Weekly', status: 'probation' }]), ctx());
    expect(plan.rows[0].payload).toMatchObject({ employment_type: 'full_time', pay_frequency: 'bi_weekly' });
    expect(plan.rows[0].errors.map((e) => e.field)).toEqual(['status']);
  });

  it('resolves job sites and jurisdictions by name or code', () => {
    const plan = buildPlan(parsedOf([{ ...base, job_site: 'hq', jurisdiction: 'Abuja' }, { ...base, email: 'b@example.com', national_id: '12345678902', job_site: 'Nowhere', jurisdiction: 'Narnia' }]), ctx());
    expect(plan.rows[0].payload).toMatchObject({ job_site_id: 'site-1', province: 'FC' });
    expect(plan.rows[1].errors.map((e) => e.field).sort()).toEqual(['job_site', 'jurisdiction']);
  });

  it('catches duplicates in the file and against existing employees', () => {
    const existing = [{ id: 'e1', employee_number: 'EMP-1', email: 'taken@example.com' }];
    const plan = buildPlan(parsedOf([
      { ...base, employee_number: 'X1' },
      { ...base, employee_number: 'X1', email: 'ADA@example.com', national_id: '12345678901' },
      { ...base, employee_number: 'EMP-1', email: 'other@example.com', national_id: '22345678901' },
      { ...base, employee_number: 'X3', email: 'taken@example.com', national_id: '32345678901' },
    ]), ctx({ existing }));
    expect(plan.rows[1].errors.map((e) => e.field).sort()).toEqual(['email', 'employee_number', 'national_id']);
    expect(plan.rows[2].errors[0].message).toMatch(/already exists/);
    expect(plan.rows[3].errors[0].message).toMatch(/already used by employee EMP-1/);
  });

  it('generates Employee IDs when blank on create', () => {
    const plan = buildPlan(parsedOf([base, { ...base, email: 'b@example.com', national_id: '12345678902' }]), ctx());
    expect(plan.rows.map((r) => r.employeeNumber)).toEqual(['EMP-20261123-0001', 'EMP-20261123-0002']);
  });

  it('updates only the filled-in fields and merges the statutory profile', () => {
    const existing = [{ id: 'e1', employee_number: 'EMP-1', email: 'ada@example.com', statutory_profile: { rsa_number: 'PEN1' } }];
    const plan = buildPlan(parsedOf([{ employee_number: 'EMP-1', first_name: '', last_name: '', email: '', hire_date: '', national_id: '', annual_salary: '250000', tax_id: 'T-9' }]), ctx({ mode: 'upsert', existing }));
    const r = plan.rows[0];
    expect(r.action).toBe('update');
    expect(r.errors).toEqual([]);
    expect(r.payload).toEqual({ annual_salary: 250000, hourly_rate: null, statutory_profile: { rsa_number: 'PEN1', tax_id: 'T-9' } });
  });
});

// ---- minimal fake Supabase client that records writes
function fakeDb(opts: { failEmail?: string } = {}) {
  const calls: { table: string; op: string; payload: unknown }[] = [];
  let id = 0;
  const builder = (table: string) => {
    let op = '';
    let payload: unknown;
    const exec = () => {
      calls.push({ table, op, payload });
      if (table === 'employees' && op === 'insert') {
        const rows = (Array.isArray(payload) ? payload : [payload]) as { email: string; employee_number: string }[];
        if (rows.some((r) => r.email === opts.failEmail)) {
          return { data: null, error: { message: 'duplicate key value violates unique constraint "employees_organization_email_unique"' } };
        }
        const data = rows.map((r) => ({ id: `emp-${++id}`, employee_number: r.employee_number }));
        return { data: Array.isArray(payload) ? data : data[0], error: null };
      }
      if (table === 'employee_import_batches' && op === 'insert') return { data: { id: 'batch-1' }, error: null };
      return { data: null, error: null };
    };
    const b: Record<string, unknown> = {
      insert(p: unknown) { op = 'insert'; payload = p; return b; },
      update(p: unknown) { op = 'update'; payload = p; return b; },
      select() { return b; },
      eq() { return b; },
      single() { return Promise.resolve(exec()); },
      then(res: (v: unknown) => unknown, rej: (e: unknown) => unknown) { return Promise.resolve(exec()).then(res, rej); },
    };
    return b;
  };
  return { db: { from: builder } as unknown as SupabaseClient, calls };
}

describe('commit', () => {
  it('inserts valid rows, isolates a failing row, and records history', async () => {
    const parsed = roundTrip(userStyleWorkbook());
    const plan = buildPlan(parsed, ctx());
    const { db, calls } = fakeDb({ failEmail: 'tybabe@example.com' });
    const progress: number[] = [];
    const res = await commitPlan(db, {
      plan, organizationId: 'org-1', userId: 'u1', mode: 'create', replaceBlanks: false,
      file: { name: 'f.xlsx', size: 1, hash: null }, onProgress: (d) => progress.push(d),
    });
    expect(res).toMatchObject({ batchId: 'batch-1', created: 1, failed: 1, updated: 0 });
    expect(res.results[1].message).toBe('Another employee already uses this email.');
    expect(progress.at(-1)).toBe(2);
    const batchUpdate = calls.find((c) => c.table === 'employee_import_batches' && c.op === 'update')!.payload as Record<string, unknown>;
    expect(batchUpdate).toMatchObject({ status: 'posted', created_count: 1, failed_count: 1 });
    const rows = calls.find((c) => c.table === 'employee_import_rows')!.payload as { match_type: string; posted_entity_id: string | null }[];
    expect(rows.map((r) => [r.match_type, r.posted_entity_id])).toEqual([['new', 'emp-1'], ['new', null]]);
  });
});
