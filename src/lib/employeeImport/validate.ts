import { ParsedFile } from './parser';
import { COMPENSATION_TYPES, DEDUCTION_TYPES, EMPLOYMENT_TYPES, MAX_ROWS_PER_BATCH, PAYMENT_METHODS, PAY_FREQUENCIES, getCountryRule } from './rules';

export type Severity = 'error' | 'warning';
export interface Issue {
  code: string;
  message: string;
  severity: Severity;
  field?: string;
}

export interface ValidatedRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  employeeNumber?: string;
  errors: Issue[];
  warnings: Issue[];
  matchType: 'new' | 'update_by_id' | 'duplicate_suspect' | 'not_found';
  isValid: boolean;
}

export interface ValidationResult {
  employees: ValidatedRow[];
  compensation: ValidatedRow[];
  deductions: ValidatedRow[];
  payment: ValidatedRow[];
  fileErrors: Issue[];
  summary: {
    totalRows: number;
    validRows: number;
    warningRows: number;
    errorRows: number;
    newEmployees: number;
    updates: number;
    duplicateSuspects: number;
  };
}

export interface ExistingEmployeeIndex {
  byNumber: Map<string, { id: string; first_name: string; last_name: string; email: string; date_of_birth?: string | null }>;
  byEmail: Map<string, string>;
}

interface Options {
  mode: 'create' | 'update' | 'upsert';
  countryCode?: string;
  existing: ExistingEmployeeIndex;
  departments: Set<string>;
  divisions: Set<string>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toStr(v: unknown): string {
  return v == null ? '' : String(v).trim();
}
function toBool(v: unknown): boolean {
  const s = toStr(v).toLowerCase();
  return ['yes', 'true', 'y', '1'].includes(s);
}
function toNum(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function isValidDate(v: unknown): boolean {
  if (!v) return false;
  const d = new Date(v as string);
  return !isNaN(d.getTime());
}

export function validateImport(parsed: ParsedFile, opts: Options): ValidationResult {
  const rule = getCountryRule(opts.countryCode);
  const fileErrors: Issue[] = [];

  const totalRows = parsed.employees.rows.length + parsed.compensation.rows.length + parsed.deductions.rows.length + parsed.payment.rows.length;
  if (totalRows > MAX_ROWS_PER_BATCH) {
    fileErrors.push({ code: 'too_many_rows', severity: 'error', message: `File has ${totalRows} rows; max is ${MAX_ROWS_PER_BATCH}.` });
  }
  if (parsed.employees.headers.length === 0) {
    fileErrors.push({ code: 'missing_sheet', severity: 'error', message: 'Employees sheet is missing or empty.' });
  }

  const seenIds = new Set<string>();
  const uploadedEmployeeIds = new Set<string>();
  let newCount = 0;
  let updateCount = 0;
  let dupCount = 0;

  const empRows: ValidatedRow[] = parsed.employees.rows.map((raw, i) => {
    const rowNumber = i + 2; // header is row 1
    const errors: Issue[] = [];
    const warnings: Issue[] = [];
    const employeeNumber = toStr(raw.employee_id);
    const firstName = toStr(raw.first_name);
    const lastName = toStr(raw.last_name);
    const email = toStr(raw.email);
    const employmentType = toStr(raw.employment_type).toLowerCase();
    const payFrequency = toStr(raw.pay_frequency).toLowerCase();
    const hireDate = toStr(raw.hire_date);
    const terminationDate = toStr(raw.termination_date);
    const country = toStr(raw.country) || rule.countryCode;

    if (!firstName) errors.push({ code: 'first_name_required', field: 'first_name', severity: 'error', message: 'First name is required.' });
    if (!lastName) errors.push({ code: 'last_name_required', field: 'last_name', severity: 'error', message: 'Last name is required.' });
    if (!email) errors.push({ code: 'email_required', field: 'email', severity: 'error', message: 'Email is required.' });
    else if (!EMAIL_RE.test(email)) errors.push({ code: 'email_invalid', field: 'email', severity: 'error', message: 'Email format is invalid.' });
    if (!hireDate) errors.push({ code: 'hire_date_required', field: 'hire_date', severity: 'error', message: 'Hire date is required.' });
    else if (!isValidDate(hireDate)) errors.push({ code: 'hire_date_invalid', field: 'hire_date', severity: 'error', message: 'Hire date is not a valid date.' });
    if (terminationDate && isValidDate(terminationDate) && isValidDate(hireDate) && new Date(terminationDate) < new Date(hireDate)) {
      errors.push({ code: 'termination_before_hire', field: 'termination_date', severity: 'error', message: 'Termination date is before hire date.' });
    }
    if (employmentType && !EMPLOYMENT_TYPES.includes(employmentType as typeof EMPLOYMENT_TYPES[number])) {
      warnings.push({ code: 'employment_type_unknown', field: 'employment_type', severity: 'warning', message: `Unknown employment type "${employmentType}".` });
    }
    if (payFrequency && !PAY_FREQUENCIES.includes(payFrequency as typeof PAY_FREQUENCIES[number])) {
      warnings.push({ code: 'pay_frequency_unknown', field: 'pay_frequency', severity: 'warning', message: `Unknown pay frequency "${payFrequency}".` });
    }
    const dept = toStr(raw.department);
    if (dept && opts.departments.size > 0 && !opts.departments.has(dept)) {
      warnings.push({ code: 'department_unknown', field: 'department', severity: 'warning', message: `Department "${dept}" does not exist yet.` });
    }
    const div = toStr(raw.division);
    if (div && opts.divisions.size > 0 && !opts.divisions.has(div)) {
      warnings.push({ code: 'division_unknown', field: 'division', severity: 'warning', message: `Division "${div}" does not exist yet.` });
    }
    for (const req of rule.requiredIdentifiers) {
      if (req.optional) continue;
      const key = req.key === 'sin' ? 'national_id' : req.key;
      if (!toStr(raw[key])) errors.push({ code: `${req.key}_required`, field: key, severity: 'error', message: `${req.label} is required for ${rule.countryName}.` });
    }
    if (!toStr(raw.phone)) warnings.push({ code: 'phone_missing', field: 'phone', severity: 'warning', message: 'Phone is empty.' });

    // duplicate within file
    if (employeeNumber) {
      if (seenIds.has(employeeNumber)) errors.push({ code: 'duplicate_in_file', field: 'employee_id', severity: 'error', message: 'Duplicate Employee ID within upload file.' });
      seenIds.add(employeeNumber);
      uploadedEmployeeIds.add(employeeNumber);
    }

    // match against existing
    let matchType: ValidatedRow['matchType'] = 'new';
    if (employeeNumber && opts.existing.byNumber.has(employeeNumber)) {
      if (opts.mode === 'create') errors.push({ code: 'already_exists', field: 'employee_id', severity: 'error', message: `Employee ${employeeNumber} already exists (mode: create).` });
      matchType = 'update_by_id';
    } else if (!employeeNumber && opts.mode !== 'create') {
      errors.push({ code: 'employee_id_required_for_update', field: 'employee_id', severity: 'error', message: 'Employee ID is required in update/upsert mode.' });
      matchType = 'not_found';
    } else {
      // secondary duplicate match by email or (firstname+lastname+dob)
      const dob = toStr(raw.date_of_birth);
      const emailLower = email.toLowerCase();
      if (emailLower && opts.existing.byEmail.has(emailLower)) {
        warnings.push({ code: 'possible_duplicate_email', field: 'email', severity: 'warning', message: `An existing employee already uses this email.` });
        matchType = 'duplicate_suspect';
      } else if (firstName && lastName && dob) {
        for (const [, e] of opts.existing.byNumber) {
          if (
            e.first_name?.toLowerCase() === firstName.toLowerCase() &&
            e.last_name?.toLowerCase() === lastName.toLowerCase() &&
            e.date_of_birth === dob
          ) {
            warnings.push({ code: 'possible_duplicate_person', severity: 'warning', message: `Possible duplicate of existing employee ${e.first_name} ${e.last_name}.` });
            matchType = 'duplicate_suspect';
            break;
          }
        }
      }
    }

    if (matchType === 'new') newCount++;
    else if (matchType === 'update_by_id') updateCount++;
    else if (matchType === 'duplicate_suspect') dupCount++;

    return { rowNumber, raw: { ...raw, country }, employeeNumber, errors, warnings, matchType, isValid: errors.length === 0 };
  });

  const validateChildSheet = (
    sheet: 'compensation' | 'deductions' | 'payment',
    rows: Record<string, unknown>[],
  ): ValidatedRow[] =>
    rows.map((raw, i) => {
      const rowNumber = i + 2;
      const errors: Issue[] = [];
      const warnings: Issue[] = [];
      const employeeNumber = toStr(raw.employee_id);
      if (!employeeNumber) errors.push({ code: 'employee_id_required', field: 'employee_id', severity: 'error', message: 'Employee ID is required.' });
      else if (!uploadedEmployeeIds.has(employeeNumber) && !opts.existing.byNumber.has(employeeNumber)) {
        errors.push({ code: 'employee_not_found', field: 'employee_id', severity: 'error', message: `Employee ${employeeNumber} not found in file or database.` });
      }
      if (sheet === 'compensation') {
        const t = toStr(raw.compensation_type).toLowerCase();
        if (!t) errors.push({ code: 'compensation_type_required', severity: 'error', message: 'Compensation type is required.' });
        else if (!COMPENSATION_TYPES.includes(t as typeof COMPENSATION_TYPES[number])) warnings.push({ code: 'compensation_type_unknown', severity: 'warning', message: `Unknown compensation type "${t}".` });
        const amt = toNum(raw.amount);
        if (amt == null) errors.push({ code: 'amount_invalid', severity: 'error', message: 'Amount is missing or not numeric.' });
        else if (amt < 0) errors.push({ code: 'amount_negative', severity: 'error', message: 'Amount cannot be negative.' });
      } else if (sheet === 'deductions') {
        const t = toStr(raw.deduction_type).toLowerCase();
        if (!t) errors.push({ code: 'deduction_type_required', severity: 'error', message: 'Deduction type is required.' });
        else if (!DEDUCTION_TYPES.includes(t as typeof DEDUCTION_TYPES[number])) warnings.push({ code: 'deduction_type_unknown', severity: 'warning', message: `Unknown deduction type "${t}".` });
        const amt = toNum(raw.amount);
        if (amt == null || amt < 0) errors.push({ code: 'amount_invalid', severity: 'error', message: 'Amount must be a non-negative number.' });
      } else if (sheet === 'payment') {
        const method = toStr(raw.payment_method).toLowerCase() || 'bank_transfer';
        if (!PAYMENT_METHODS.includes(method as typeof PAYMENT_METHODS[number])) warnings.push({ code: 'payment_method_unknown', severity: 'warning', message: `Unknown payment method "${method}".` });
        if (method === 'bank_transfer') {
          if (!toStr(raw.account_number)) errors.push({ code: 'account_number_required', severity: 'error', message: 'Account number required for bank transfer.' });
          if (!toStr(raw.bank_name)) warnings.push({ code: 'bank_name_missing', severity: 'warning', message: 'Bank name is empty.' });
        }
      }
      return { rowNumber, raw, employeeNumber, errors, warnings, matchType: 'new', isValid: errors.length === 0 };
    });

  const compRows = validateChildSheet('compensation', parsed.compensation.rows);
  const dedRows = validateChildSheet('deductions', parsed.deductions.rows);
  const payRows = validateChildSheet('payment', parsed.payment.rows);

  const allRows = [...empRows, ...compRows, ...dedRows, ...payRows];
  const validRows = allRows.filter((r) => r.isValid).length;
  const errorRows = allRows.filter((r) => r.errors.length > 0).length;
  const warningRows = allRows.filter((r) => r.warnings.length > 0 && r.errors.length === 0).length;

  return {
    employees: empRows,
    compensation: compRows,
    deductions: dedRows,
    payment: payRows,
    fileErrors,
    summary: {
      totalRows: allRows.length,
      validRows,
      warningRows,
      errorRows,
      newEmployees: newCount,
      updates: updateCount,
      duplicateSuspects: dupCount,
    },
  };
}
