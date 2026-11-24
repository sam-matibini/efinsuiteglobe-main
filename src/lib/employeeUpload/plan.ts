// Turns parsed rows into an import plan: per-row action, issues, and the exact
// payload that will be written to public.employees.

import { ParsedUpload, parseDate, parseMoney } from './parse';
import { CountryRule, EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, MAX_ROWS, PAY_FREQUENCIES, getCountryRule } from './schema';

export type UploadMode = 'create' | 'update' | 'upsert';

export interface Issue {
  field?: string;
  message: string;
}

export interface RowPlan {
  rowNumber: number;
  employeeNumber: string;
  name: string;
  email: string;
  action: 'create' | 'update';
  existingId?: string;
  errors: Issue[];
  warnings: Issue[];
  /** Insert payload (create) or update patch (update). */
  payload: Record<string, unknown>;
  raw: Record<string, string>;
}

export interface ExistingEmployee {
  id: string;
  employee_number: string;
  email: string;
  statutory_profile?: Record<string, unknown> | null;
}

export interface JobSiteRef {
  id: string;
  name: string;
  code: string | null;
}

export interface PlanContext {
  organizationId: string;
  countryCode: string;
  mode: UploadMode;
  replaceBlanks: boolean;
  /** Organization's own jurisdiction, used when a row leaves State/Province blank. */
  orgJurisdiction?: string | null;
  existing: ExistingEmployee[];
  jobSites: JobSiteRef[];
  /** Injected for deterministic tests. */
  today?: Date;
}

export interface UploadPlan {
  country: CountryRule;
  rows: RowPlan[];
  fileErrors: string[];
  fileWarnings: string[];
  summary: { total: number; ready: number; withErrors: number; withWarnings: number; creates: number; updates: number };
}

// Columns that are NOT NULL on employees: never blanked by "replace blanks".
const NOT_NULL = new Set(['employee_number', 'first_name', 'last_name', 'email', 'hire_date', 'province', 'employment_type', 'pay_frequency', 'status', 'country']);
// Plain text columns copied as-is.
const TEXT_COLUMNS = [
  'first_name', 'last_name', 'preferred_name', 'nationality', 'phone', 'address_line1', 'address_line2', 'city',
  'postal_code', 'job_title', 'department', 'cost_centre', 'work_schedule', 'bank_institution', 'bank_transit',
  'bank_account', 'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
] as const;
const DATE_COLUMNS = ['date_of_birth', 'hire_date', 'termination_date', 'payroll_start_date'] as const;
// Kept in employees.statutory_profile (jsonb).
const PROFILE_COLUMNS: Record<string, string> = {
  tax_id: 'tax_id', gender: 'gender', middle_name: 'middle_name', pension_pfa: 'pension_fund_administrator',
  rsa_number: 'rsa_number', bank_account_name: 'bank_account_name',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ENUM_SYNONYMS: Record<string, string> = {
  fulltime: 'full_time', permanent: 'full_time', parttime: 'part_time', contractor: 'contract', temp: 'temporary',
  biweekly: 'bi_weekly', fortnightly: 'bi_weekly', semimonthly: 'semi_monthly', twice_monthly: 'semi_monthly',
  monthly: 'monthly', weekly: 'weekly', onleave: 'on_leave', leave: 'on_leave', inactive: 'terminated',
};

function enumValue(v: string): string {
  const s = v.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ENUM_SYNONYMS[s] ?? ENUM_SYNONYMS[s.replace(/_/g, '')] ?? s;
}

function digitsOnly(v: string): string {
  return v.replace(/\D/g, '');
}

export function resolveJurisdiction(value: string, rule: CountryRule): string | null {
  const v = value.trim();
  if (!v) return null;
  if (rule.jurisdictions.length === 0) return v.toUpperCase();
  const lower = v.toLowerCase().replace(/\s+state$/, '');
  const hit = rule.jurisdictions.find(
    (j) => j.code.toLowerCase() === lower || j.name.toLowerCase() === lower || j.name.toLowerCase().replace(/\s*\(.*\)$/, '') === lower,
  );
  return hit?.code ?? null;
}

export function buildPlan(parsed: ParsedUpload, ctx: PlanContext): UploadPlan {
  const rule = getCountryRule(ctx.countryCode);
  const fileErrors = [...parsed.fileErrors];
  const fileWarnings = [...parsed.fileWarnings];
  if (parsed.rows.length > MAX_ROWS) fileErrors.push(`The file has ${parsed.rows.length} rows; the maximum is ${MAX_ROWS}.`);

  const presentColumns = new Set(parsed.headers.map((h) => h.key).filter(Boolean) as string[]);
  const byNumber = new Map(ctx.existing.map((e) => [e.employee_number.trim().toLowerCase(), e]));
  const byEmail = new Map(ctx.existing.map((e) => [e.email.trim().toLowerCase(), e]));
  const jobSiteLookup = new Map<string, string>();
  for (const s of ctx.jobSites) {
    jobSiteLookup.set(s.name.trim().toLowerCase(), s.id);
    if (s.code) jobSiteLookup.set(s.code.trim().toLowerCase(), s.id);
  }
  const orgJurisdiction = ctx.orgJurisdiction ? resolveJurisdiction(ctx.orgJurisdiction, rule) : null;

  const usedNumbers = new Set(byNumber.keys());
  const seenNumbers = new Map<string, number>();
  const seenEmails = new Map<string, number>();
  const seenNins = new Map<string, number>();
  const today = ctx.today ?? new Date();
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  let seq = 0;
  const nextNumber = () => {
    let n: string;
    do n = `EMP-${stamp}-${String(++seq).padStart(4, '0')}`;
    while (usedNumbers.has(n.toLowerCase()));
    usedNumbers.add(n.toLowerCase());
    return n;
  };

  const rows: RowPlan[] = parsed.rows.map(({ rowNumber, values }) => {
    const v = (k: string) => (values[k] ?? '').trim();
    const errors: Issue[] = [];
    const warnings: Issue[] = [];
    const err = (field: string, message: string) => errors.push({ field, message });
    const warn = (field: string, message: string) => warnings.push({ field, message });

    // ---- identity & action
    let employeeNumber = v('employee_number');
    const existing = employeeNumber ? byNumber.get(employeeNumber.toLowerCase()) : undefined;
    let action: RowPlan['action'] = 'create';
    if (ctx.mode === 'create') {
      if (existing) err('employee_number', `Employee ID ${employeeNumber} already exists. Use Update or Upsert mode to change it.`);
    } else if (ctx.mode === 'update') {
      if (!employeeNumber) err('employee_number', 'Employee ID is required in Update mode.');
      else if (!existing) err('employee_number', `No employee with ID ${employeeNumber} exists.`);
      action = 'update';
    } else if (existing) {
      action = 'update';
    } else if (!employeeNumber) {
      warn('employee_number', 'No Employee ID — a new employee will be created with a generated ID.');
    }
    if (employeeNumber) {
      const key = employeeNumber.toLowerCase();
      if (seenNumbers.has(key)) err('employee_number', `Duplicate Employee ID — also on row ${seenNumbers.get(key)}.`);
      else seenNumbers.set(key, rowNumber);
    }
    if (action === 'create' && !employeeNumber) employeeNumber = nextNumber();
    const isCreate = action === 'create';

    const payload: Record<string, unknown> = {};
    const setField = (col: string, value: unknown, present: boolean) => {
      if (value !== null && value !== undefined && value !== '') payload[col] = value;
      else if (!isCreate && ctx.replaceBlanks && present && !NOT_NULL.has(col)) payload[col] = null;
    };

    // ---- text columns
    for (const col of TEXT_COLUMNS) setField(col, v(col) || null, presentColumns.has(col));
    if (isCreate) {
      payload.organization_id = ctx.organizationId;
      payload.employee_number = employeeNumber;
    }

    // ---- required names / email
    if (isCreate && !v('first_name')) err('first_name', 'First name is required.');
    if (isCreate && !v('last_name')) err('last_name', 'Last name is required.');
    const email = v('email').toLowerCase();
    if (!email) {
      if (isCreate) err('email', 'Email is required.');
    } else if (!EMAIL_RE.test(email)) {
      err('email', `"${v('email')}" is not a valid email address.`);
    } else {
      payload.email = email;
      if (seenEmails.has(email)) err('email', `Duplicate email — also on row ${seenEmails.get(email)}.`);
      else seenEmails.set(email, rowNumber);
      const owner = byEmail.get(email);
      if (owner && owner.id !== existing?.id) err('email', `Email is already used by employee ${owner.employee_number}.`);
    }

    // ---- dates
    const dates: Record<string, string | null> = {};
    for (const col of DATE_COLUMNS) {
      const raw = v(col);
      if (!raw) { dates[col] = null; setField(col, null, presentColumns.has(col)); continue; }
      const iso = parseDate(raw, rule.dateOrder);
      if (!iso) err(col, `${col.replace(/_/g, ' ')} "${raw}" is not a valid date. Use YYYY-MM-DD.`);
      dates[col] = iso;
      setField(col, iso, true);
    }
    if (isCreate && !v('hire_date')) err('hire_date', 'Hire date is required.');
    if (dates.hire_date && dates.termination_date && dates.termination_date < dates.hire_date) {
      err('termination_date', 'Termination date is before hire date.');
    }
    if (dates.date_of_birth && dates.hire_date && dates.date_of_birth >= dates.hire_date) {
      err('date_of_birth', 'Date of birth is on or after the hire date.');
    }

    // ---- enums
    const enumField = (col: string, allowed: readonly string[], dflt: string, label: string) => {
      const raw = v(col);
      if (!raw) { if (isCreate) payload[col] = dflt; return; }
      const val = enumValue(raw);
      if (!allowed.includes(val)) err(col, `${label} "${raw}" is not allowed. Use one of: ${allowed.join(', ')}.`);
      else payload[col] = val;
    };
    enumField('employment_type', EMPLOYMENT_TYPES, 'full_time', 'Employment type');
    enumField('pay_frequency', PAY_FREQUENCIES, 'monthly', 'Pay frequency');
    enumField('status', EMPLOYEE_STATUSES, 'active', 'Status');
    if (payload.status === 'terminated' && !dates.termination_date && isCreate) {
      warn('termination_date', 'Status is terminated but no termination date was given.');
    }

    // ---- jurisdiction (employees.province, NOT NULL)
    const rawJur = v('jurisdiction');
    if (rawJur) {
      const code = resolveJurisdiction(rawJur, rule);
      if (!code) err('jurisdiction', `${rule.jurisdictionLabel} "${rawJur}" is not recognised for ${rule.name}. See the Reference sheet.`);
      else payload.province = code;
    } else if (isCreate) {
      if (orgJurisdiction) payload.province = orgJurisdiction;
      else err('jurisdiction', `${rule.jurisdictionLabel} is required.`);
    }
    payload.country = v('country') ? v('country') : isCreate ? rule.code : undefined;
    if (payload.country === undefined) delete payload.country;

    // ---- national ID
    const nationalId = v('national_id');
    if (rule.requireNin11) {
      const nin = digitsOnly(nationalId);
      if (!nationalId) {
        if (isCreate) err('national_id', 'National ID (NIN) is required for Nigerian employees.');
      } else if (nin.length !== 11) {
        err('national_id', `NIN must be exactly 11 digits (got ${nin.length}). Format the column as Text to keep leading zeros.`);
      } else {
        payload.nin = nin;
        if (seenNins.has(nin)) err('national_id', `Duplicate NIN — also on row ${seenNins.get(nin)}.`);
        else seenNins.set(nin, rowNumber);
      }
    } else {
      setField('sin_encrypted', nationalId || null, presentColumns.has('national_id'));
    }

    // ---- pay
    const salary = v('annual_salary') ? parseMoney(v('annual_salary')) : null;
    const hourly = v('hourly_rate') ? parseMoney(v('hourly_rate')) : null;
    if (v('annual_salary') && salary === null) err('annual_salary', `Annual salary "${v('annual_salary')}" is not a number.`);
    if (v('hourly_rate') && hourly === null) err('hourly_rate', `Hourly rate "${v('hourly_rate')}" is not a number.`);
    if ((salary ?? 0) < 0) err('annual_salary', 'Annual salary cannot be negative.');
    if ((hourly ?? 0) < 0) err('hourly_rate', 'Hourly rate cannot be negative.');
    if (salary && hourly) err('annual_salary', 'Fill Annual Salary or Hourly Rate, not both.');
    if (salary != null) { payload.annual_salary = salary; if (!hourly) payload.hourly_rate = null; }
    if (hourly != null) { payload.hourly_rate = hourly; if (!salary) payload.annual_salary = null; }
    if (isCreate && salary == null && hourly == null) warn('annual_salary', 'No pay rate — the employee will be skipped by pay runs until one is set.');

    // ---- job site
    const site = v('job_site');
    if (site) {
      const id = jobSiteLookup.get(site.toLowerCase());
      if (!id) err('job_site', `Job site "${site}" does not exist${ctx.jobSites.length ? '' : ' (no active job sites are set up)'}.`);
      else payload.job_site_id = id;
    }

    // ---- statutory profile (merged with the existing profile on update)
    const profile: Record<string, unknown> = { ...(existing?.statutory_profile ?? {}) };
    let profileChanged = false;
    for (const [col, key] of Object.entries(PROFILE_COLUMNS)) {
      const val = v(col);
      if (val) { profile[key] = val; profileChanged = true; }
      else if (!isCreate && ctx.replaceBlanks && presentColumns.has(col) && key in profile) { delete profile[key]; profileChanged = true; }
    }
    if (rule.requireNin11 && v('tax_id') && !/^\d{8}-?\d{4}$|^\d{10,13}$/.test(v('tax_id').replace(/\s/g, ''))) {
      warn('tax_id', `TIN "${v('tax_id')}" does not look like a Nigerian TIN.`);
    }
    if (isCreate || profileChanged) payload.statutory_profile = profile;

    for (const col of rule.recommended) {
      if (isCreate && !v(col)) warn(col, `${col === 'tax_id' ? 'Tax ID (TIN)' : col.replace(/_/g, ' ')} is empty.`);
    }
    if (v('bank_account') && !v('bank_institution')) warn('bank_institution', 'Account number given without a bank name.');

    if (!isCreate && Object.keys(payload).length === 0) warn('employee_number', 'Nothing to update on this row.');

    return {
      rowNumber,
      employeeNumber,
      name: [v('first_name'), v('last_name')].filter(Boolean).join(' '),
      email,
      action,
      existingId: existing?.id,
      errors,
      warnings,
      payload,
      raw: values,
    };
  });

  const ready = rows.filter((r) => r.errors.length === 0);
  return {
    country: rule,
    rows,
    fileErrors,
    fileWarnings,
    summary: {
      total: rows.length,
      ready: fileErrors.length ? 0 : ready.length,
      withErrors: rows.length - ready.length,
      withWarnings: ready.filter((r) => r.warnings.length > 0).length,
      creates: ready.filter((r) => r.action === 'create').length,
      updates: ready.filter((r) => r.action === 'update').length,
    },
  };
}
