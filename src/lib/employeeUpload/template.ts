import * as XLSX from 'xlsx';
import { COLUMNS, EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, PAY_FREQUENCIES, TEMPLATE_VERSION, getCountryRule } from './schema';

export interface TemplateOptions {
  countryCode: string;
  jobSites?: { name: string; code: string | null }[];
  departments?: string[];
}

function exampleRow(countryCode: string): Record<string, string | number> {
  const rule = getCountryRule(countryCode);
  const jur = rule.jurisdictions.find((j) => ['LA', 'ON', 'CA', 'ENG'].includes(j.code)) ?? rule.jurisdictions[0];
  const ng = rule.code === 'NG';
  return {
    employee_number: 'EMP-0001',
    first_name: 'Amina',
    middle_name: 'Grace',
    last_name: 'Okafor',
    preferred_name: 'Amina',
    email: 'amina.okafor@example.com',
    phone: ng ? '+2348000000000' : '',
    date_of_birth: '1990-05-15',
    gender: 'Female',
    nationality: rule.name,
    national_id: ng ? '12345678901' : '',
    tax_id: ng ? '12345678-0001' : '',
    address_line1: '12 Example Street',
    city: ng ? 'Ikeja' : '',
    jurisdiction: jur?.code ?? '',
    country: rule.code,
    employment_type: 'full_time',
    hire_date: '2026-01-01',
    job_title: 'Accountant',
    department: 'Finance',
    pay_frequency: 'monthly',
    annual_salary: ng ? 6000000 : 60000,
    status: 'active',
    bank_institution: ng ? 'Example Bank' : '',
    bank_account: ng ? '0123456789' : '',
    bank_account_name: 'Amina Okafor',
    pension_pfa: ng ? 'Example Pensions' : '',
    rsa_number: ng ? 'PEN100000000001' : '',
  };
}

export function buildTemplateWorkbook(opts: TemplateOptions): XLSX.WorkBook {
  const rule = getCountryRule(opts.countryCode);
  const wb = XLSX.utils.book_new();

  const required = ['Employee ID (Update/Upsert only)', 'First Name', 'Last Name', 'Email', 'Hire Date', rule.jurisdictionLabel + ' (or the organization default)'];
  if (rule.requireNin11) required.push('National ID (NIN) — exactly 11 digits');
  const instructions: (string | number)[][] = [
    ['eFinsuite — Bulk Employee Upload'],
    [`Template ${TEMPLATE_VERSION} · ${rule.name} (${rule.code}) · currency ${rule.currency}`],
    [],
    ['How to use'],
    ['1. Fill one row per employee on the Employees sheet. Delete the example row.'],
    ['2. Keep the header row as it is. Columns you do not need can be left blank or removed.'],
    ['3. Dates: YYYY-MM-DD, or real Excel dates.'],
    ['4. ID and account number columns are formatted as Text so leading zeros are kept — paste values, not formulas.'],
    ['5. Upload the file, review the preview, then confirm. Rows with errors are skipped; everything else is imported.'],
    [],
    ['Required'],
    ...required.map((r) => [`• ${r}`]),
    [],
    ['Column', 'What to enter'],
    ...COLUMNS.map((c) => [c.header, c.help]),
  ];
  const wsI = XLSX.utils.aoa_to_sheet(instructions);
  wsI['!cols'] = [{ wch: 34 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsI, 'Instructions');

  const ex = exampleRow(rule.code);
  const ws = XLSX.utils.aoa_to_sheet([COLUMNS.map((c) => c.header), COLUMNS.map((c) => ex[c.key] ?? '')]);
  ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(14, c.header.length + 2) }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } as never;
  // Text format for ID-like columns (rows 2..1001) so Excel keeps leading zeros and long numbers.
  COLUMNS.forEach((c, ci) => {
    if (c.kind !== 'id') return;
    for (let r = 1; r <= 1000; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: ci });
      const cell = ws[addr] ?? { t: 's', v: '' };
      cell.t = 's';
      cell.v = cell.v == null ? '' : String(cell.v);
      cell.z = '@';
      ws[addr] = cell;
    }
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 1000, c: COLUMNS.length - 1 } });
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');

  const ref: (string | number)[][] = [
    ['Allowed values'],
    ['Employment Type', EMPLOYMENT_TYPES.join(', ')],
    ['Pay Frequency', PAY_FREQUENCIES.join(', ')],
    ['Status', EMPLOYEE_STATUSES.join(', ')],
    [],
    [`${rule.jurisdictionLabel} — code`, 'Name'],
    ...rule.jurisdictions.map((j) => [j.code, j.name]),
  ];
  if (opts.jobSites?.length) ref.push([], ['Job Site', 'Code'], ...opts.jobSites.map((s) => [s.name, s.code ?? '']));
  if (opts.departments?.length) ref.push([], ['Departments'], ...opts.departments.map((d) => [d]));
  const wsR = XLSX.utils.aoa_to_sheet(ref);
  wsR['!cols'] = [{ wch: 28 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsR, 'Reference');
  return wb;
}

export function buildTemplateBlob(opts: TemplateOptions): Blob {
  const out = XLSX.write(buildTemplateWorkbook(opts), { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
