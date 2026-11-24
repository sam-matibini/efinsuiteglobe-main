// Bulk employee upload — column definitions and country rules.
//
// One sheet, one row per employee. Every column maps to a real column on
// public.employees (or its statutory_profile jsonb), i.e. the same places the
// Add/Edit employee dialogs, pay runs and payroll payments read from.

import { COUNTRY_LOCALIZATIONS, CountryLocalization, getCountryLocalization } from '@/data/countryLocalizations';

export const TEMPLATE_VERSION = 'v2';
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 5000;

// Must match the public.employment_type / pay_frequency / employee_status enums.
export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'temporary'] as const;
export const PAY_FREQUENCIES = ['weekly', 'bi_weekly', 'semi_monthly', 'monthly'] as const;
export const EMPLOYEE_STATUSES = ['active', 'on_leave', 'terminated', 'onboarding'] as const;

export type ColumnKind = 'text' | 'id' | 'email' | 'date' | 'money' | 'enum' | 'bool';

export interface ColumnDef {
  key: string;
  header: string;
  kind: ColumnKind;
  aliases?: string[];
  options?: readonly string[];
  help: string;
}

export const COLUMNS: ColumnDef[] = [
  { key: 'employee_number', header: 'Employee ID', kind: 'id', aliases: ['employee number', 'emp id', 'staff id'], help: 'Unique per organization. Left blank on create, one is generated. Required for Update/Upsert.' },
  { key: 'first_name', header: 'First Name', kind: 'text', help: 'Required.' },
  { key: 'middle_name', header: 'Middle Name', kind: 'text', help: 'Optional (kept in statutory profile).' },
  { key: 'last_name', header: 'Last Name', kind: 'text', aliases: ['surname'], help: 'Required.' },
  { key: 'preferred_name', header: 'Preferred Name', kind: 'text', help: 'Optional.' },
  { key: 'email', header: 'Email', kind: 'email', aliases: ['email address', 'work email'], help: 'Required. Unique per organization.' },
  { key: 'phone', header: 'Phone', kind: 'id', aliases: ['phone number', 'mobile'], help: 'Optional.' },
  { key: 'date_of_birth', header: 'Date of Birth', kind: 'date', aliases: ['dob'], help: 'YYYY-MM-DD or an Excel date.' },
  { key: 'gender', header: 'Gender', kind: 'text', help: 'Optional (kept in statutory profile).' },
  { key: 'nationality', header: 'Nationality', kind: 'text', help: 'Optional.' },
  { key: 'national_id', header: 'National ID', kind: 'id', aliases: ['nin', 'national id (nin)', 'national identification number', 'sin', 'ssn'], help: 'Nigeria: NIN, exactly 11 digits (required). Other countries: SIN/SSN/national ID.' },
  { key: 'tax_id', header: 'Tax ID', kind: 'id', aliases: ['tin', 'tax identification number', 'tax id (tin)'], help: 'Nigeria: TIN. Stored in the statutory profile.' },
  { key: 'address_line1', header: 'Address Line 1', kind: 'text', help: 'Optional.' },
  { key: 'address_line2', header: 'Address Line 2', kind: 'text', help: 'Optional.' },
  { key: 'city', header: 'City', kind: 'text', help: 'Optional.' },
  { key: 'jurisdiction', header: 'State/Province', kind: 'text', aliases: ['state', 'province', 'region', 'state of residence', 'jurisdiction', 'location'], help: 'Tax jurisdiction — code or name from the Reference sheet (e.g. LA or Lagos). Blank uses the organization\'s.' },
  { key: 'postal_code', header: 'Postal Code', kind: 'id', aliases: ['zip code', 'zip', 'postcode'], help: 'Optional.' },
  { key: 'country', header: 'Country', kind: 'text', help: 'Optional. Defaults to the upload country.' },
  { key: 'employment_type', header: 'Employment Type', kind: 'enum', options: EMPLOYMENT_TYPES, help: `One of: ${EMPLOYMENT_TYPES.join(', ')}. Default full_time.` },
  { key: 'hire_date', header: 'Hire Date', kind: 'date', aliases: ['start date', 'date of hire', 'date employed'], help: 'Required.' },
  { key: 'termination_date', header: 'Termination Date', kind: 'date', help: 'Optional.' },
  { key: 'job_title', header: 'Job Title', kind: 'text', aliases: ['position', 'designation'], help: 'Optional.' },
  { key: 'department', header: 'Department', kind: 'text', help: 'Optional.' },
  { key: 'job_site', header: 'Job Site', kind: 'text', aliases: ['site', 'branch', 'work location'], help: 'Optional. Name or code of an active job site (see Reference).' },
  { key: 'cost_centre', header: 'Cost Centre', kind: 'text', aliases: ['cost center'], help: 'Optional.' },
  { key: 'work_schedule', header: 'Work Schedule', kind: 'text', help: 'Optional.' },
  { key: 'pay_frequency', header: 'Pay Frequency', kind: 'enum', aliases: ['payroll frequency'], options: PAY_FREQUENCIES, help: `One of: ${PAY_FREQUENCIES.join(', ')}. Default monthly.` },
  { key: 'annual_salary', header: 'Annual Salary', kind: 'money', aliases: ['gross annual salary', 'salary'], help: 'Gross annual salary. Fill this OR Hourly Rate.' },
  { key: 'hourly_rate', header: 'Hourly Rate', kind: 'money', help: 'For hourly staff. Fill this OR Annual Salary.' },
  { key: 'payroll_start_date', header: 'Payroll Start Date', kind: 'date', help: 'Optional.' },
  { key: 'status', header: 'Status', kind: 'enum', options: EMPLOYEE_STATUSES, help: `One of: ${EMPLOYEE_STATUSES.join(', ')}. Default active.` },
  { key: 'bank_institution', header: 'Bank Name', kind: 'text', aliases: ['bank', 'bank institution', 'institution number', 'bank code'], help: 'Bank name or institution number.' },
  { key: 'bank_transit', header: 'Bank Branch / Transit', kind: 'id', aliases: ['transit number', 'sort code', 'branch code', 'routing number'], help: 'Transit, sort or branch code.' },
  { key: 'bank_account', header: 'Account Number', kind: 'id', aliases: ['bank account', 'account no', 'nuban'], help: 'Format the column as Text to keep leading zeros.' },
  { key: 'bank_account_name', header: 'Account Name', kind: 'text', help: 'Optional (kept in statutory profile).' },
  { key: 'pension_pfa', header: 'Pension Fund Administrator', kind: 'text', aliases: ['pfa'], help: 'Nigeria: PFA name.' },
  { key: 'rsa_number', header: 'RSA PIN', kind: 'id', aliases: ['rsa number', 'rsa'], help: 'Nigeria: Retirement Savings Account PIN.' },
  { key: 'emergency_contact_name', header: 'Emergency Contact Name', kind: 'text', help: 'Optional.' },
  { key: 'emergency_contact_phone', header: 'Emergency Contact Phone', kind: 'id', help: 'Optional.' },
  { key: 'emergency_contact_relationship', header: 'Emergency Contact Relationship', kind: 'text', help: 'Optional.' },
];

export const COLUMN_BY_KEY = new Map(COLUMNS.map((c) => [c.key, c]));

function normalizeLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

const HEADER_LOOKUP = (() => {
  const m = new Map<string, string>();
  for (const c of COLUMNS) {
    m.set(normalizeLabel(c.header), c.key);
    m.set(c.key, c.key);
    for (const a of c.aliases ?? []) m.set(normalizeLabel(a), c.key);
  }
  return m;
})();

/** Maps a sheet header to a column key, or null when the column is not recognised. */
export function headerToKey(header: string): string | null {
  const n = normalizeLabel(header);
  return HEADER_LOOKUP.get(n) ?? HEADER_LOOKUP.get(n.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')) ?? null;
}

export interface CountryRule {
  code: string;
  name: string;
  currency: string;
  jurisdictionLabel: string;
  jurisdictions: { code: string; name: string }[];
  /** Date order for ambiguous strings like 03/04/2026. */
  dateOrder: 'DMY' | 'MDY';
  nationalIdLabel: string;
  /** Enforced by the database for Nigerian organizations (trg_enforce_nigeria_nin). */
  requireNin11: boolean;
  /** Fields that should normally be present; missing ones are warnings. */
  recommended: string[];
}

const MDY_COUNTRIES = new Set(['US', 'PH', 'BZ', 'FM', 'MH', 'PW']);

export function getCountryRule(code: string): CountryRule {
  const loc: CountryLocalization = getCountryLocalization(code.toUpperCase());
  const cc = loc.code.toUpperCase();
  return {
    code: cc,
    name: loc.name,
    currency: loc.currency,
    jurisdictionLabel: loc.jurisdictionLabel || 'State/Province',
    jurisdictions: loc.jurisdictions ?? [],
    dateOrder: MDY_COUNTRIES.has(cc) ? 'MDY' : 'DMY',
    nationalIdLabel: cc === 'NG' ? 'National ID (NIN)' : cc === 'CA' ? 'SIN' : cc === 'US' ? 'SSN' : 'National ID',
    requireNin11: cc === 'NG',
    recommended: cc === 'NG' ? ['tax_id', 'bank_account'] : [],
  };
}

export function availableCountries(): { code: string; name: string; currency: string }[] {
  return Object.values(COUNTRY_LOCALIZATIONS)
    .map((c) => ({ code: c.code, name: c.name, currency: c.currency }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolves an organization's country (stored as a code or a name) to a code. */
export function resolveCountryCode(country?: string | null): string | null {
  if (!country) return null;
  const v = country.trim();
  if (COUNTRY_LOCALIZATIONS[v.toUpperCase()]) return v.toUpperCase();
  const byName = Object.values(COUNTRY_LOCALIZATIONS).find((c) => c.name.toLowerCase() === v.toLowerCase());
  return byName?.code ?? null;
}
