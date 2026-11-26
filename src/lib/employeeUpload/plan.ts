// Turns parsed rows into an import plan: per-row action, issues, and the exact
// payload that will be written to public.employees.

import { ParsedUpload, parseDate, parseMoney } from './parse';
import { CountryRule, EMPLOYEE_STATUSES, EMPLOYMENT_TYPES, MAX_ROWS, PAY_FREQUENCIES, getCountryRule } from './schema';

export type UploadMode = 'create' | 'update' | 'upsert';

export interface Issue {
  field?: string;
  message: string;
  /**
   * Errors only: the row can still be imported safely if the user ignores it.
   * The payload already holds the "ignored" outcome (bad optional value left
   * out, a default applied, or the value kept as entered).
   */
  ignorable?: boolean;
  /** What happens to the row when this error is ignored. */
  ifIgnored?: string;
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
  /** Errors the user chose to ignore (set by applyIgnores). */
  ignored: Issue[];
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
    const soft = (field: string, message: string, ifIgnored: string) => errors.push({ field, message, ignorable: true, ifIgnored });
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
      const label = col.replace(/_/g, ' ');
      if (!iso && col === 'hire_date') err(col, `hire date "${raw}" is not a valid date. Use YYYY-MM-DD.`);
      else if (!iso) soft(col, `${label} "${raw}" is not a valid date. Use YYYY-MM-DD.`, `Imported without a ${label}.`);
      dates[col] = iso;
      setField(col, iso, true);
    }
    if (isCreate && !v('hire_date')) err('hire_date', 'Hire date is required.');
    if (dates.hire_date && dates.termination_date && dates.termination_date < dates.hire_date) {
      soft('termination_date', 'Termination date is before hire date.', 'Imported with the dates as entered.');
    }
    if (dates.date_of_birth && dates.hire_date && dates.date_of_birth >= dates.hire_date) {
      soft('date_of_birth', 'Date of birth is on or after the hire date.', 'Imported with the dates as entered.');
    }

    // ---- enums
    const enumField = (col: string, allowed: readonly string[], dflt: string, label: string) => {
      const raw = v(col);
      if (!raw) { if (isCreate) payload[col] = dflt; return; }
      const val = enumValue(raw);
      if (allowed.includes(val)) { payload[col] = val; return; }
      if (isCreate) payload[col] = dflt;
      soft(col, `${label} "${raw}" is not allowed. Use one of: ${allowed.join(', ')}.`,
        isCreate ? `Imported as ${dflt}.` : `${label} left unchanged.`);
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
      const msg = `${rule.jurisdictionLabel} "${rawJur}" is not recognised for ${rule.name}. See the Reference sheet.`;
      if (code) payload.province = code;
      else if (!isCreate) soft('jurisdiction', msg, `${rule.jurisdictionLabel} left unchanged.`);
      else if (orgJurisdiction) { payload.province = orgJurisdiction; soft('jurisdiction', msg, `Imported with the organization's ${rule.jurisdictionLabel.toLowerCase()} (${orgJurisdiction}).`); }
      else err('jurisdiction', msg);
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
        if (seenNins.has(nin)) soft('national_id', `Duplicate NIN — also on row ${seenNins.get(nin)}.`, 'Imported with this NIN even though another row uses it.');
        else seenNins.set(nin, rowNumber);
      }
    } else {
      setField('sin_encrypted', nationalId || null, presentColumns.has('national_id'));
    }

    // ---- pay
    const salary = v('annual_salary') ? parseMoney(v('annual_salary')) : null;
    const hourly = v('hourly_rate') ? parseMoney(v('hourly_rate')) : null;
    if (v('annual_salary') && salary === null) soft('annual_salary', `Annual salary "${v('annual_salary')}" is not a number.`, 'Imported without an annual salary.');
    if (v('hourly_rate') && hourly === null) soft('hourly_rate', `Hourly rate "${v('hourly_rate')}" is not a number.`, 'Imported without an hourly rate.');
    if ((salary ?? 0) < 0) soft('annual_salary', 'Annual salary cannot be negative.', 'Imported without an annual salary.');
    if ((hourly ?? 0) < 0) soft('hourly_rate', 'Hourly rate cannot be negative.', 'Imported without an hourly rate.');
    const goodSalary = salary != null && salary >= 0 ? salary : null;
    let goodHourly = hourly != null && hourly >= 0 ? hourly : null;
    if (goodSalary && goodHourly) {
      soft('hourly_rate', 'Fill Annual Salary or Hourly Rate, not both.', 'Imported with the annual salary only.');
      goodHourly = null;
    }
    if (goodSalary != null) { payload.annual_salary = goodSalary; payload.hourly_rate = null; }
    else if (goodHourly != null) { payload.hourly_rate = goodHourly; payload.annual_salary = null; }
    if (isCreate && salary == null && hourly == null) warn('annual_salary', 'No pay rate — the employee will be skipped by pay runs until one is set.');

    // ---- job site
    const site = v('job_site');
    if (site) {
      const id = jobSiteLookup.get(site.toLowerCase());
      if (!id) soft('job_site', `Job site "${site}" does not exist${ctx.jobSites.length ? '' : ' (no active job sites are set up)'}.`, 'Imported without a job site.');
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
      ignored: [],
      payload,
      raw: values,
    };
  });

  return { country: rule, rows, fileErrors, fileWarnings, summary: summarize(rows, fileErrors) };
}

function summarize(rows: RowPlan[], fileErrors: string[]): UploadPlan['summary'] {
  const ready = rows.filter((r) => r.errors.length === 0);
  return {
    total: rows.length,
    ready: fileErrors.length ? 0 : ready.length,
    withErrors: rows.length - ready.length,
    withWarnings: ready.filter((r) => r.warnings.length > 0).length,
    creates: ready.filter((r) => r.action === 'create').length,
    updates: ready.filter((r) => r.action === 'update').length,
  };
}

/** Stable key for one issue on one row, used to remember what the user ignored. */
export function issueKey(rowNumber: number, issue: Issue): string {
  return `${rowNumber}|${issue.field ?? ''}|${issue.message}`;
}

/** Whether an issue can be ignored: any warning, or an error marked ignorable. */
export function canIgnore(issue: Issue, kind: 'error' | 'warning'): boolean {
  return kind === 'warning' || !!issue.ignorable;
}

/** Every key "Ignore all" would add: ignorable errors and warnings on every row. */
export function allIgnorableKeys(plan: UploadPlan): string[] {
  const keys: string[] = [];
  for (const r of plan.rows) {
    for (const e of r.errors) if (e.ignorable) keys.push(issueKey(r.rowNumber, e));
    for (const w of r.warnings) keys.push(issueKey(r.rowNumber, w));
  }
  return keys;
}

/**
 * Returns the plan with the chosen issues moved from errors/warnings to
 * `ignored`. Only ignorable errors move, so a row with a must-fix error stays
 * blocked. Payloads need no change: they already hold the ignored outcome.
 */
export function applyIgnores(plan: UploadPlan, ignored: ReadonlySet<string>): UploadPlan {
  if (ignored.size === 0) return plan;
  const rows = plan.rows.map((r) => {
    const keep = (kind: 'error' | 'warning') => (i: Issue) => !(canIgnore(i, kind) && ignored.has(issueKey(r.rowNumber, i)));
    const errors = r.errors.filter(keep('error'));
    const warnings = r.warnings.filter(keep('warning'));
    if (errors.length === r.errors.length && warnings.length === r.warnings.length) return r;
    const moved = [...r.errors.filter((i) => !errors.includes(i)), ...r.warnings.filter((i) => !warnings.includes(i))];
    return { ...r, errors, warnings, ignored: [...r.ignored, ...moved] };
  });
  return { ...plan, rows, summary: summarize(rows, plan.fileErrors) };
}
