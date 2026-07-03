// Client-side template generator for Bulk Journal Entry imports.
// Mirrors the settlement-template approach so the download never routes
// through an auth-protected URL.
import * as XLSX from 'xlsx';

export const JE_TEMPLATE_HEADERS = [
  'entry_number',
  'entry_date',
  'description',
  'reference',
  'currency',
  'line_number',
  'account_code',
  'line_description',
  'debit',
  'credit',
  'department_code',
  'project_code',
  'location_code',
  'customer_code',
  'vendor_code',
  'tax_code',
] as const;

const SAMPLES: (string | number)[][] = [
  ['JE-001', '2026-06-15', 'Office rent — June', 'RENT-JUN', 'CAD', 1, '6010', 'Office rent expense', 2500, 0, 'OPS', '', '', '', 'LANDLORD-ACME', ''],
  ['JE-001', '2026-06-15', 'Office rent — June', 'RENT-JUN', 'CAD', 2, '1010', 'Cash — operating', 0, 2500, 'OPS', '', '', '', '', ''],
  ['JE-002', '2026-06-16', 'Consulting revenue — Acme', 'INV-1042', 'CAD', 1, '1200', 'Accounts Receivable', 5650, 0, 'SVC', '', '', 'ACME', '', 'HST'],
  ['JE-002', '2026-06-16', 'Consulting revenue — Acme', 'INV-1042', 'CAD', 2, '4000', 'Consulting revenue', 0, 5000, 'SVC', '', '', 'ACME', '', ''],
  ['JE-002', '2026-06-16', 'Consulting revenue — Acme', 'INV-1042', 'CAD', 3, '2310', 'HST collected', 0, 650, 'SVC', '', '', 'ACME', '', 'HST'],
];

const README_ROWS: (string | number)[][] = [
  ['Field', 'Required', 'Format', 'Notes'],
  ['entry_number', 'Yes', 'Text', 'Groups lines into one journal entry. Each unique entry_number becomes one JE.'],
  ['entry_date', 'Yes', 'YYYY-MM-DD', 'Posting date. Must fall in an open fiscal period.'],
  ['description', 'No', 'Text', 'Header memo for the entry (taken from first line of the group).'],
  ['reference', 'No', 'Text', 'Optional reference; if blank the system assigns the next JE number.'],
  ['currency', 'No', 'ISO 4217', 'Defaults to organization base currency. Multi-currency lines should also set exchange_rate (not in this template — use the single-JE form).'],
  ['line_number', 'No', 'Integer', 'Line ordering within the entry.'],
  ['account_code', 'Yes', 'Text', 'Must match an active Chart of Accounts code.'],
  ['line_description', 'No', 'Text', 'Per-line memo.'],
  ['debit', 'Yes*', 'Number', 'Debit amount. Leave blank or 0 if this is a credit line.'],
  ['credit', 'Yes*', 'Number', 'Credit amount. Leave blank or 0 if this is a debit line.'],
  ['department_code', 'No', 'Text', 'Division / department code. Falls back to entry-level division if blank.'],
  ['project_code', 'No', 'Text', 'Project dimension.'],
  ['location_code', 'No', 'Text', 'Location dimension.'],
  ['customer_code', 'No', 'Text', 'Customer ref for AR / revenue lines.'],
  ['vendor_code', 'No', 'Text', 'Vendor ref for AP / expense lines.'],
  ['tax_code', 'No', 'Text', 'Optional tax code (HST, GST, PST, EXEMPT, ZR-EXP, etc.).'],
  [],
  ['Rules', '', '', ''],
  ['Balance', '', '', 'For every entry_number, Σ debit must equal Σ credit (within 2¢).'],
  ['Sign', '', '', 'Use positive numbers only. Each line is either a debit or a credit, not both.'],
  ['Period', '', '', 'Entries whose entry_date falls in a closed period are rejected at posting.'],
  ['Mode', '', '', 'Imported entries are created as draft, validated, then optionally posted in bulk.'],
];

export function downloadJournalEntryTemplateXlsx() {
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([JE_TEMPLATE_HEADERS as unknown as string[], ...SAMPLES]);
  ws['!cols'] = JE_TEMPLATE_HEADERS.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, 'JournalEntries');

  const readme = XLSX.utils.aoa_to_sheet(README_ROWS);
  readme['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 14 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, readme, 'README');

  XLSX.writeFile(wb, 'journal-entry-import-template.xlsx');
}

function toCsvCell(v: string | number | undefined | null): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const JE_TEMPLATE_CSV = [JE_TEMPLATE_HEADERS as unknown as string[], ...SAMPLES]
  .map((row) => row.map(toCsvCell).join(','))
  .join('\r\n');

export function downloadJournalEntryTemplateCsv() {
  const blob = new Blob(['\ufeff' + JE_TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'journal-entry-import-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
