import { describe, expect, it } from 'vitest';
import { allIgnorableKeys, applyIgnores, buildPlan, issueKey, PlanContext } from './plan';
import type { ParsedUpload } from './parse';

const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({
  organizationId: 'org-1',
  countryCode: 'NG',
  mode: 'create',
  replaceBlanks: false,
  orgJurisdiction: 'LA',
  existing: [],
  jobSites: [{ id: 'site-1', name: 'Head Office', code: 'HQ' }],
  today: new Date(2026, 10, 26),
  ...over,
});

const parsedOf = (rows: Record<string, string>[]): ParsedUpload => ({
  fileName: 'f.xlsx', fileSize: 1, sheetName: 'Sheet1', fileErrors: [], fileWarnings: [],
  headers: [...new Set(rows.flatMap((r) => Object.keys(r)))].map((k) => ({ header: k, key: k })),
  rows: rows.map((values, i) => ({ rowNumber: i + 2, values })),
});

let nin = 10000000000;
const row = (over: Record<string, string> = {}) => ({
  employee_number: `EMP${nin}`, first_name: 'Ada', last_name: 'Obi', email: `ada${nin}@example.com`,
  hire_date: '2024-01-15', national_id: String(++nin), annual_salary: '1200000', ...over,
});

describe('ignoring upload errors', () => {
  it('lets the user ignore errors on optional fields, as on the real upload', () => {
    // Row 46/98 on the user's file: date of birth on or after the hire date.
    const plan = buildPlan(parsedOf([row({ date_of_birth: '2024-02-01' })]), ctx());
    const [r] = plan.rows;
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ field: 'date_of_birth', ignorable: true, ifIgnored: 'Imported with the dates as entered.' });
    expect(plan.summary.ready).toBe(0);

    const after = applyIgnores(plan, new Set([issueKey(r.rowNumber, r.errors[0])]));
    expect(after.rows[0].errors).toEqual([]);
    expect(after.rows[0].ignored).toHaveLength(1);
    expect(after.summary).toMatchObject({ ready: 1, withErrors: 0, creates: 1 });
    expect(after.rows[0].payload.date_of_birth).toBe('2024-02-01');
  });

  it('never lets a must-fix error be ignored (shared email, as on the real upload)', () => {
    const plan = buildPlan(parsedOf([
      row({ email: 'earthweb.docs@gmail.com' }),
      row({ email: 'earthweb.docs@gmail.com' }),
    ]), ctx());
    const dup = plan.rows[1];
    expect(dup.errors[0]).toMatchObject({ field: 'email' });
    expect(dup.errors[0].ignorable).toBeFalsy();
    const after = applyIgnores(plan, new Set([issueKey(dup.rowNumber, dup.errors[0])]));
    expect(after.rows[1].errors).toHaveLength(1);
    expect(after.summary.ready).toBe(1);
    expect(allIgnorableKeys(plan)).not.toContain(issueKey(dup.rowNumber, dup.errors[0]));
  });

  it('keeps required-field and NIN errors blocking', () => {
    const plan = buildPlan(parsedOf([row({ first_name: '', national_id: '123' })]), ctx());
    expect(plan.rows[0].errors.map((e) => e.ignorable ?? false)).toEqual([false, false]);
  });

  it('applies a safe outcome for each ignorable error', () => {
    const plan = buildPlan(parsedOf([row({
      job_site: 'Nowhere',
      employment_type: 'intern',
      jurisdiction: 'Narnia',
      termination_date: 'not a date',
      annual_salary: '500000',
      hourly_rate: '2000',
    })]), ctx());
    const r = plan.rows[0];
    expect(r.errors.every((e) => e.ignorable)).toBe(true);
    expect(r.errors.map((e) => e.field).sort()).toEqual(['employment_type', 'hourly_rate', 'job_site', 'jurisdiction', 'termination_date']);
    // The payload already holds the ignored outcome.
    expect(r.payload).toMatchObject({ employment_type: 'full_time', province: 'LA', annual_salary: 500000, hourly_rate: null });
    expect(r.payload).not.toHaveProperty('job_site_id');
    expect(r.payload).not.toHaveProperty('termination_date');
  });

  it('cannot ignore an unknown state when there is no organization default', () => {
    const plan = buildPlan(parsedOf([row({ jurisdiction: 'Narnia' })]), ctx({ orgJurisdiction: null }));
    expect(plan.rows[0].errors[0].ignorable).toBeFalsy();
  });

  it('"Ignore all" clears ignorable errors and warnings but leaves must-fix rows blocked', () => {
    const plan = buildPlan(parsedOf([
      row({ date_of_birth: '2030-01-01' }),          // ignorable
      row({ tax_id: '' }),                            // warning only (TIN empty)
      row({ email: 'not-an-email' }),                 // must fix
    ]), ctx());
    expect(plan.summary).toMatchObject({ ready: 1, withErrors: 2 });
    const after = applyIgnores(plan, new Set(allIgnorableKeys(plan)));
    expect(after.summary).toMatchObject({ ready: 2, withErrors: 1, withWarnings: 0 });
    expect(after.rows[2].errors).toHaveLength(1);
    expect(allIgnorableKeys(after)).toEqual([]);
  });

  it('undoing an ignore puts the error back', () => {
    const plan = buildPlan(parsedOf([row({ job_site: 'Nowhere' })]), ctx());
    const key = issueKey(2, plan.rows[0].errors[0]);
    expect(applyIgnores(plan, new Set([key])).summary.ready).toBe(1);
    expect(applyIgnores(plan, new Set()).summary.ready).toBe(0);
  });
});
