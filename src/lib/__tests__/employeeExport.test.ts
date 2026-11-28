import { describe, expect, it } from 'vitest';
import { buildEmployeeExportRows, EMPLOYEE_EXPORT_HEADERS, employeeExportFileName, toCsv } from '../employeeExport';
import type { ListEmployee } from '../employeeListView';

const base: ListEmployee = { first_name: 'Zainab', last_name: 'Abdulazeez', email: 'z@x.com', employee_number: '00170', department: 'Finance', job_title: 'Revenue Collector', employment_type: 'contract', status: 'active', hire_date: '2024-08-12T00:00:00', annual_salary: 480000, phone: '08012345678', nin: '01234567890', bank_institution: 'Access Bank', bank_account: '0123456789' };

describe('employee export', () => {
  it('builds one row per employee with ID first and labels for type and status', () => {
    const [row] = buildEmployeeExportRows([base]);
    expect(row).toHaveLength(EMPLOYEE_EXPORT_HEADERS.length);
    expect(row[0]).toBe('00170');           // leading zeros kept as text
    expect(row[4]).toBe('08012345678');
    expect(row[7]).toBe('Contract');
    expect(row[8]).toBe('Salaried');
    expect(row[9]).toBe(480000);
    expect(row[10]).toBe('');
    expect(row[12]).toBe('2024-08-12');
    expect(row[13]).toBe('Active');
  });

  it('handles hourly staff and missing values', () => {
    const [row] = buildEmployeeExportRows([{ ...base, annual_salary: null, hourly_rate: 500, employee_number: null, department: null, status: 'on_leave' }]);
    expect(row[0]).toBe('');
    expect(row[5]).toBe('');
    expect(row[8]).toBe('Hourly');
    expect(row[10]).toBe(500);
    expect(row[11]).toBe(500 * 2080);
    expect(row[13]).toBe('On Leave');
  });

  it('masks National ID and account number unless revealed', () => {
    const [masked] = buildEmployeeExportRows([base]);
    expect(masked.slice(14)).toEqual(['•••••••7890', 'Access Bank', '••••••6789']);
    const [full] = buildEmployeeExportRows([base], true);
    expect(full.slice(14)).toEqual(['01234567890', 'Access Bank', '0123456789']);   // leading zeros kept
  });

  it('falls back to the SIN / national ID when there is no NIN', () => {
    const [row] = buildEmployeeExportRows([{ ...base, nin: null, sin_encrypted: '123-456-789', bank_account: null, bank_institution: null }], true);
    expect(row.slice(14)).toEqual(['123-456-789', '', '']);
  });

  it('quotes CSV cells containing commas, quotes or line breaks', () => {
    expect(toCsv(['A', 'B'], [['x,y', 'say "hi"'], ['line\nbreak', 3]])).toBe('A,B\r\n"x,y","say ""hi"""\r\n"line\nbreak",3');
  });

  it('names the file after the organization and date', () => {
    expect(employeeExportFileName('Acme Nigeria Ltd.', 'xlsx', new Date('2026-11-28T10:00:00Z'))).toBe('Acme-Nigeria-Ltd-employees-2026-11-28.xlsx');
    expect(employeeExportFileName(undefined, 'csv', new Date('2026-11-28T10:00:00Z'))).toBe('employees-employees-2026-11-28.csv');
  });
});
