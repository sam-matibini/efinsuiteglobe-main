// Country-aware bulk employee import rules.
// Rates are NOT hard-coded on employee records — statutory rates continue
// to be resolved at pay-run time by globalPayrollCalculator.

export interface CountryImportRule {
  countryCode: string;
  countryName: string;
  currency: string;
  dateFormat: string;
  regionField: 'province' | 'state' | 'region';
  requiredIdentifiers: {
    key: 'national_id' | 'tax_id' | 'sin';
    label: string;
    optional?: boolean;
  }[];
  statutoryDeductions: string[];
  statutoryFields: string[]; // additional fields stored in statutory_profile jsonb
}

export const COMPENSATION_TYPES = [
  'basic_salary',
  'housing_allowance',
  'transport_allowance',
  'medical_allowance',
  'meal_allowance',
  'bonus',
  'commission',
  'overtime',
  'shift_allowance',
  'other',
] as const;

export const DEDUCTION_TYPES = [
  'paye',
  'income_tax',
  'pension',
  'social_security',
  'health_insurance',
  'union_dues',
  'loan_repayment',
  'garnishment',
  'insurance',
  'other',
] as const;

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'temporary', 'casual', 'intern'] as const;
export const PAY_FREQUENCIES = ['weekly', 'bi_weekly', 'semi_monthly', 'monthly'] as const;
export const PAYMENT_METHODS = ['bank_transfer', 'cheque', 'cash', 'mobile_money'] as const;

export const COUNTRY_IMPORT_RULES: Record<string, CountryImportRule> = {
  CA: {
    countryCode: 'CA',
    countryName: 'Canada',
    currency: 'CAD',
    dateFormat: 'YYYY-MM-DD',
    regionField: 'province',
    requiredIdentifiers: [{ key: 'sin', label: 'SIN', optional: true }],
    statutoryDeductions: ['cpp', 'ei', 'income_tax'],
    statutoryFields: ['td1_federal_amount', 'td1_provincial_amount'],
  },
  US: {
    countryCode: 'US',
    countryName: 'United States',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    regionField: 'state',
    requiredIdentifiers: [{ key: 'tax_id', label: 'SSN' }],
    statutoryDeductions: ['federal_income_tax', 'state_income_tax', 'social_security', 'medicare'],
    statutoryFields: ['w4_filing_status', 'w4_allowances', 'state_withholding'],
  },
  NG: {
    countryCode: 'NG',
    countryName: 'Nigeria',
    currency: 'NGN',
    dateFormat: 'YYYY-MM-DD',
    regionField: 'state',
    requiredIdentifiers: [
      { key: 'tax_id', label: 'Tax Identification Number (TIN)' },
      { key: 'national_id', label: 'National ID (NIN)', optional: true },
    ],
    statutoryDeductions: ['paye', 'pension'],
    statutoryFields: [
      'state_of_residence',
      'paye_jurisdiction',
      'pension_applicable',
      'pension_employee_rate',
      'pension_employer_rate',
      'pension_fund_administrator',
      'rsa_number',
      'nsitf_applicable',
    ],
  },
  GB: {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    currency: 'GBP',
    dateFormat: 'DD/MM/YYYY',
    regionField: 'region',
    requiredIdentifiers: [{ key: 'tax_id', label: 'National Insurance Number' }],
    statutoryDeductions: ['paye', 'ni'],
    statutoryFields: ['tax_code', 'ni_category'],
  },
};

export function getCountryRule(code?: string | null): CountryImportRule {
  if (code && COUNTRY_IMPORT_RULES[code.toUpperCase()]) return COUNTRY_IMPORT_RULES[code.toUpperCase()];
  return COUNTRY_IMPORT_RULES.CA;
}

export const TEMPLATE_VERSION = 'v1';
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ROWS_PER_BATCH = 5000;
