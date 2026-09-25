import * as XLSX from 'xlsx';

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface ParsedFile {
  employees: ParsedSheet;
  compensation: ParsedSheet;
  deductions: ParsedSheet;
  payment: ParsedSheet;
  fileName: string;
  fileSize: number;
}

const HEADER_ALIASES: Record<string, string> = {
  'employee id': 'employee_id',
  'emp id': 'employee_id',
  'employee number': 'employee_id',
  'first name': 'first_name',
  'middle name': 'middle_name',
  'last name': 'last_name',
  'preferred name': 'preferred_name',
  'date of birth': 'date_of_birth',
  'dob': 'date_of_birth',
  gender: 'gender',
  nationality: 'nationality',
  'national id': 'national_id',
  'nin': 'national_id',
  'tax id': 'tax_id',
  'tin': 'tax_id',
  'tax identification number': 'tax_id',
  email: 'email',
  'email address': 'email',
  phone: 'phone',
  'phone number': 'phone',
  'address line 1': 'address_line1',
  'address line 2': 'address_line2',
  city: 'city',
  'state/province': 'region',
  state: 'region',
  province: 'region',
  region: 'region',
  country: 'country',
  'postal code': 'postal_code',
  'zip code': 'postal_code',
  'employment type': 'employment_type',
  'hire date': 'hire_date',
  'start date': 'start_date',
  'end date': 'end_date',
  'effective date': 'effective_date',
  'termination date': 'termination_date',
  'job title': 'job_title',
  department: 'department',
  division: 'division',
  location: 'location',
  'manager email': 'manager_email',
  manager: 'manager_email',
  'cost centre': 'cost_centre',
  'cost center': 'cost_centre',
  'work schedule': 'work_schedule',
  'pay frequency': 'pay_frequency',
  'payroll frequency': 'pay_frequency',
  'payroll start date': 'payroll_start_date',
  status: 'status',
  'compensation type': 'compensation_type',
  amount: 'amount',
  currency: 'currency',
  frequency: 'frequency',
  taxable: 'taxable',
  'deduction type': 'deduction_type',
  category: 'category',
  'payment method': 'payment_method',
  'bank name': 'bank_name',
  'account name': 'account_name',
  'account number': 'account_number',
  'routing number': 'routing_number',
  'transit number': 'transit_number',
  'institution number': 'institution_number',
  iban: 'iban',
  swift: 'swift',
  'is primary': 'is_primary',
};

function normalizeHeader(h: string): string {
  const key = String(h ?? '').trim().toLowerCase();
  return HEADER_ALIASES[key] ?? key.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function sheetToRows(ws: XLSX.WorkSheet | undefined): ParsedSheet {
  if (!ws) return { headers: [], rows: [] };
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false });
  if (raw.length === 0) return { headers: [], rows: [] };
  const originalHeaders = Object.keys(raw[0]);
  const headers = originalHeaders.map(normalizeHeader);
  const rows = raw.map((r) => {
    const out: Record<string, unknown> = {};
    originalHeaders.forEach((h, i) => {
      const val = r[h];
      out[headers[i]] = typeof val === 'string' ? val.trim() : val;
    });
    return out;
  });
  return { headers, rows };
}

export async function parseEmployeeFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });

  const lookup = (name: string) =>
    wb.SheetNames.find((n) => n.toLowerCase() === name.toLowerCase());

  return {
    employees: sheetToRows(wb.Sheets[lookup('Employees') ?? '']),
    compensation: sheetToRows(wb.Sheets[lookup('Compensation') ?? '']),
    deductions: sheetToRows(wb.Sheets[lookup('Deductions') ?? '']),
    payment: sheetToRows(wb.Sheets[lookup('Payment') ?? lookup('Payment Information') ?? '']),
    fileName: file.name,
    fileSize: file.size,
  };
}

export async function computeFileHash(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
