import * as XLSX from 'xlsx';
import {
  COMPENSATION_TYPES,
  DEDUCTION_TYPES,
  EMPLOYMENT_TYPES,
  PAY_FREQUENCIES,
  PAYMENT_METHODS,
  TEMPLATE_VERSION,
  getCountryRule,
} from './rules';

interface TemplateOptions {
  countryCode?: string;
  departments?: string[];
  divisions?: string[];
  locations?: string[];
  currencies?: string[];
}

export function generateEmployeeTemplate(opts: TemplateOptions = {}): Blob {
  const rule = getCountryRule(opts.countryCode);
  const wb = XLSX.utils.book_new();

  // --- Instructions
  const instructions = [
    ['eFinsuite — Bulk Employee Upload Template'],
    [`Template Version: ${TEMPLATE_VERSION}`],
    [`Country: ${rule.countryName} (${rule.countryCode})`],
    [`Currency default: ${rule.currency}`],
    [`Date format: ${rule.dateFormat}`],
    [],
    ['Sheets:'],
    ['  1. Employees — master data (one row per employee).'],
    ['  2. Compensation — salary, allowances, bonuses (multiple rows per employee).'],
    ['  3. Deductions — statutory and voluntary deductions.'],
    ['  4. Payment — bank / payment details (account numbers are encrypted on import).'],
    ['  5. Reference — allowed values for departments, divisions, currencies, etc.'],
    [],
    ['Required fields per country vary. See Reference sheet for allowed values.'],
    ['Do NOT rename column headers. Blank cells in Update mode preserve existing values.'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), 'Instructions');

  // --- Employees
  const employeeHeaders = [
    'Employee ID', 'First Name', 'Middle Name', 'Last Name', 'Preferred Name',
    'Date of Birth', 'Gender', 'Nationality',
    'National ID', 'Tax ID',
    'Email', 'Phone',
    'Address Line 1', 'Address Line 2', 'City', 'State/Province', 'Country', 'Postal Code',
    'Employment Type', 'Hire Date', 'Termination Date',
    'Job Title', 'Department', 'Division', 'Location', 'Manager Email', 'Cost Centre',
    'Work Schedule', 'Pay Frequency', 'Payroll Start Date',
    'Status',
  ];
  const employeeExample = [
    'EMP-0001', 'Amina', 'Grace', 'Okafor', 'Amina',
    '1990-05-15', 'Female', rule.countryName,
    '', '',
    'amina.okafor@example.com', '+234 800 000 0000',
    '12 Example Street', '', 'Lagos', rule.countryCode === 'NG' ? 'LA' : '', rule.countryCode, '100001',
    'full_time', '2026-01-01', '',
    'Accountant', 'Finance', '', 'HQ', '', 'CC-100',
    'Mon-Fri 9-5', 'monthly', '2026-01-01',
    'active',
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([employeeHeaders, employeeExample]), 'Employees');

  // --- Compensation
  const compHeaders = ['Employee ID', 'Compensation Type', 'Amount', 'Currency', 'Frequency', 'Taxable', 'Effective Date', 'End Date'];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      compHeaders,
      ['EMP-0001', 'basic_salary', 500000, rule.currency, 'monthly', 'Yes', '2026-01-01', ''],
      ['EMP-0001', 'housing_allowance', 150000, rule.currency, 'monthly', 'Yes', '2026-01-01', ''],
      ['EMP-0001', 'transport_allowance', 100000, rule.currency, 'monthly', 'Yes', '2026-01-01', ''],
    ]),
    'Compensation',
  );

  // --- Deductions
  const dedHeaders = ['Employee ID', 'Deduction Type', 'Category', 'Amount', 'Currency', 'Frequency', 'Start Date', 'End Date'];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      dedHeaders,
      ['EMP-0001', 'pension', 'statutory', 64000, rule.currency, 'monthly', '2026-01-01', ''],
      ['EMP-0001', 'loan_repayment', 'voluntary', 50000, rule.currency, 'monthly', '2026-01-01', '2026-12-31'],
    ]),
    'Deductions',
  );

  // --- Payment
  const payHeaders = ['Employee ID', 'Payment Method', 'Bank Name', 'Account Name', 'Account Number', 'Currency', 'Routing Number', 'Transit Number', 'Institution Number', 'IBAN', 'SWIFT', 'Is Primary'];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      payHeaders,
      ['EMP-0001', 'bank_transfer', 'Example Bank', 'Amina Okafor', '1234567890', rule.currency, '', '', '', '', '', 'Yes'],
    ]),
    'Payment',
  );

  // --- Reference
  const ref: (string | number)[][] = [
    ['Section', 'Allowed Values'],
    ['Employment Type', EMPLOYMENT_TYPES.join(', ')],
    ['Pay Frequency', PAY_FREQUENCIES.join(', ')],
    ['Payment Method', PAYMENT_METHODS.join(', ')],
    ['Compensation Type', COMPENSATION_TYPES.join(', ')],
    ['Deduction Type', DEDUCTION_TYPES.join(', ')],
    ['Deduction Category', 'statutory, voluntary'],
    ['Status', 'active, on_leave, terminated, onboarding'],
    ['Currency default', rule.currency],
    ['Country statutory deductions', rule.statutoryDeductions.join(', ')],
  ];
  if (opts.departments?.length) ref.push(['Departments', opts.departments.join(', ')]);
  if (opts.divisions?.length) ref.push(['Divisions', opts.divisions.join(', ')]);
  if (opts.locations?.length) ref.push(['Locations', opts.locations.join(', ')]);
  if (opts.currencies?.length) ref.push(['Currencies', opts.currencies.join(', ')]);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ref), 'Reference');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
