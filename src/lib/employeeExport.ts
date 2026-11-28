// Download the employee list (as currently filtered and sorted) to Excel or CSV.
import * as XLSX from 'xlsx';
import { annualEquivalent, employmentTypeLabel, statusLabel, type ListEmployee } from './employeeListView';

export const EMPLOYEE_EXPORT_HEADERS = [
  'Employee ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Department', 'Position',
  'Employment Type', 'Pay Type', 'Annual Salary', 'Hourly Rate', 'Annual Equivalent', 'Start Date', 'Status',
] as const;

export type ExportCell = string | number;

/** One row per employee, in the order given. IDs and phones stay text so leading zeros survive. */
export function buildEmployeeExportRows(rows: ListEmployee[]): ExportCell[][] {
  return rows.map((e) => {
    const hasSalary = !!(e.annual_salary && e.annual_salary > 0);
    const hasHourly = !hasSalary && !!(e.hourly_rate && e.hourly_rate > 0);
    return [
      e.employee_number ?? '',
      e.first_name,
      e.last_name,
      e.email ?? '',
      e.phone ?? '',
      e.department ?? '',
      e.job_title ?? '',
      employmentTypeLabel(e.employment_type),
      hasSalary ? 'Salaried' : hasHourly ? 'Hourly' : '',
      hasSalary ? Number(e.annual_salary) : '',
      hasHourly ? Number(e.hourly_rate) : '',
      annualEquivalent(e) ?? '',
      e.hire_date ? e.hire_date.slice(0, 10) : '',
      statusLabel(e.status),
    ];
  });
}

/** CSV text (RFC 4180 quoting). */
export function toCsv(headers: readonly string[], rows: ExportCell[][]): string {
  const cell = (v: ExportCell) => {
    const s = String(v ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export function employeeExportFileName(orgName: string | undefined, ext: 'xlsx' | 'csv', today = new Date()): string {
  const slug = (orgName || 'employees').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'employees';
  const d = today.toISOString().slice(0, 10);
  return `${slug}-employees-${d}.${ext}`;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadEmployeesCsv(rows: ListEmployee[], orgName?: string) {
  // BOM so Excel opens ₦ and accented names correctly.
  const csv = '﻿' + toCsv(EMPLOYEE_EXPORT_HEADERS, buildEmployeeExportRows(rows));
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), employeeExportFileName(orgName, 'csv'));
}

export function downloadEmployeesExcel(rows: ListEmployee[], orgName?: string, currencyFormat = '#,##0.00') {
  const data = buildEmployeeExportRows(rows);
  const ws = XLSX.utils.aoa_to_sheet([[...EMPLOYEE_EXPORT_HEADERS], ...data]);
  // Keep Employee ID and Phone as text; money columns as numbers with a money format.
  const moneyCols = [9, 10, 11];
  for (let r = 1; r <= data.length; r++) {
    for (const c of [0, 4]) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (ws[ref]) { ws[ref].t = 's'; ws[ref].v = String(ws[ref].v); }
    }
    for (const c of moneyCols) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = currencyFormat;
    }
  }
  ws['!cols'] = [12, 14, 16, 28, 16, 18, 24, 15, 10, 14, 12, 16, 12, 12].map((wch) => ({ wch }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length, c: EMPLOYEE_EXPORT_HEADERS.length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');
  XLSX.writeFile(wb, employeeExportFileName(orgName, 'xlsx'));
}
