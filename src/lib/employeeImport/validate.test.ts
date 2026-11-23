import { describe, expect, it } from 'vitest';
import { validateImport } from './validate';
import { parseEmployeeFile, ParsedFile } from './parser';
import { generateEmployeeTemplate } from './template';

const emptySheet = { headers: [], rows: [] };
const baseRow = {
  employee_id: 'EMP-1',
  first_name: 'Amina',
  last_name: 'Okafor',
  email: 'amina@example.com',
  phone: '+234 800 000 0000',
  hire_date: '2026-01-01',
  national_id: '12345678901',
  tax_id: '12345678-0001',
  employment_type: 'full_time',
  pay_frequency: 'monthly',
  status: 'active',
};

function file(rows: Record<string, unknown>[]): ParsedFile {
  return {
    employees: { headers: Object.keys(baseRow), rows },
    compensation: emptySheet,
    deductions: emptySheet,
    payment: emptySheet,
    fileName: 't.xlsx',
    fileSize: 1,
  };
}

const opts = (existingEmails: string[] = []) => ({
  mode: 'create' as const,
  countryCode: 'NG',
  existing: { byNumber: new Map(), byEmail: new Map(existingEmails.map((e) => [e, 'id'])) },
  departments: new Set<string>(),
  divisions: new Set<string>(),
});

const codes = (rows: Record<string, unknown>[], existingEmails?: string[]) =>
  validateImport(file(rows), opts(existingEmails)).employees.map((r) => r.errors.map((e) => e.code));

describe('validateImport (Nigeria)', () => {
  it('accepts a complete row', () => {
    expect(codes([baseRow])).toEqual([[]]);
  });

  it('requires an 11-digit NIN, as the database trigger does', () => {
    expect(codes([{ ...baseRow, national_id: '' }])[0]).toContain('national_id_required');
    expect(codes([{ ...baseRow, national_id: '1234' }])[0]).toContain('nin_invalid');
  });

  it('rejects values the employees enums do not accept', () => {
    const [errs] = codes([{ ...baseRow, employment_type: 'intern', pay_frequency: 'daily', status: 'probation' }]);
    expect(errs).toEqual(expect.arrayContaining(['employment_type_unknown', 'pay_frequency_unknown', 'status_unknown']));
    expect(codes([{ ...baseRow, employment_type: 'Full Time' }])).toEqual([[]]);
  });

  it('rejects emails that would break the unique email index', () => {
    expect(codes([baseRow], ['amina@example.com'])[0]).toContain('duplicate_email');
    const second = { ...baseRow, employee_id: 'EMP-2', email: 'AMINA@example.com' };
    expect(codes([baseRow, second])[1]).toContain('duplicate_email_in_file');
  });
});

describe('NG template round-trip', () => {
  it('parses the downloaded template into valid rows', async () => {
    const blob = generateEmployeeTemplate({ countryCode: 'NG' });
    const f = new File([await blob.arrayBuffer()], 'employee-bulk-upload-template-NG.xlsx');
    const parsed = await parseEmployeeFile(f);
    const res = validateImport(parsed, opts());
    expect(res.fileErrors).toEqual([]);
    expect(res.employees.every((r) => r.isValid)).toBe(true);
    expect(res.compensation.every((r) => r.isValid)).toBe(true);
    expect(parsed.employees.rows[0].hire_date).toBe('2026-01-01');
  });
});
