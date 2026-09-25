// Global Multi-Jurisdiction Types for EFINSUITE Globe

export interface Country {
  id: string;
  code: string;
  codeAlpha3: string | null;
  name: string;
  defaultCurrency: string;
  accountingStandard: string;
  fiscalYearType: string;
  defaultFiscalMonth: number;
  taxRegimeType: string | null;
  payrollRegimeType: string | null;
  phoneCode: string | null;
  dateFormat: string;
  numberFormat: string;
  timeFormat: string;           // '12h' or '24h'
  defaultTimezone: string | null; // IANA timezone (e.g., 'America/Toronto')
  isActive: boolean;
}

export interface Jurisdiction {
  id: string;
  countryId: string;
  code: string;
  name: string;
  jurisdictionType: string;
  parentJurisdictionId: string | null;
  taxZoneCode: string | null;
  isActive: boolean;
}

export interface TaxType {
  id: string;
  countryId: string;
  code: string;
  name: string;
  taxCategory: 'sales' | 'payroll' | 'withholding' | 'property';
  isRecoverable: boolean;
  isCompound: boolean;
  calculationMethod: 'percentage' | 'flat' | 'tiered';
  appliesTo: string;
  isActive: boolean;
}

export interface TaxRate {
  id: string;
  taxTypeId: string;
  jurisdictionId: string | null;
  rate: number;
  rateName: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  thresholdMin: number | null;
  thresholdMax: number | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface PayrollDeductionType {
  id: string;
  countryId: string;
  code: string;
  name: string;
  deductionCategory: 'statutory' | 'voluntary' | 'employer' | 'both';
  calculationMethod: 'percentage' | 'tiered' | 'flat' | 'formula';
  isEmployerContribution: boolean;
  isEmployeeDeduction: boolean;
  isTaxableBenefit: boolean;
  isTaxDeductible: boolean;
  maxAnnualAmount: number | null;
  maxPensionableEarnings: number | null;
  exemptionAmount: number | null;
  isActive: boolean;
}

export interface PayrollRateBracket {
  id: string;
  deductionTypeId: string;
  jurisdictionId: string | null;
  bracketMin: number;
  bracketMax: number | null;
  rate: number;
  employerRate: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

export interface OrganizationJurisdiction {
  id: string;
  organizationId: string;
  countryId: string;
  isPrimary: boolean;
  isActive: boolean;
  taxRegistrationNumber: string | null;
  payrollRegistrationNumber: string | null;
  employerAccountNumber: string | null;
  fiscalYearEndMonth: number | null;
  reportingCurrency: string | null;
  accountingStandard: string | null;
  setupCompletedAt: string | null;
  aiSetupConfidence: number | null;
}

export interface OrganizationTaxSetting {
  id: string;
  organizationId: string;
  taxTypeId: string;
  isEnabled: boolean;
  registrationNumber: string | null;
  reportingFrequency: 'monthly' | 'quarterly' | 'annual';
  nextFilingDue: string | null;
  isRegistered: boolean;
}

export interface OrganizationPayrollSetting {
  id: string;
  organizationId: string;
  deductionTypeId: string;
  isEnabled: boolean;
  employerRegistrationNumber: string | null;
  remittanceFrequency: string;
  nextRemittanceDue: string | null;
}

export interface JurisdictionDetection {
  countryId: string;
  countryCode: string;
  countryName: string;
  jurisdictionId?: string;
  jurisdictionCode?: string;
  jurisdictionName?: string;
  confidence: number;
  currency: string;
  accountingStandard: string;
  taxTypes: Array<{
    id: string;
    code: string;
    name: string;
    defaultRate: number;
  }>;
  payrollDeductions: Array<{
    id: string;
    code: string;
    name: string;
  }>;
}

export interface AISetupLog {
  id: string;
  organizationId: string;
  setupType: 'jurisdiction' | 'tax' | 'payroll' | 'coa';
  detectedValue: JurisdictionDetection;
  appliedValue: JurisdictionDetection;
  confidenceScore: number;
  wasOverridden: boolean;
  overrideReason: string | null;
  overriddenBy: string | null;
  createdAt: string;
}

// Supported country codes (67 countries across all regions)
export type SupportedCountryCode = 
  // North America
  | 'CA' | 'US' | 'MX'
  // South America
  | 'AR' | 'BR' | 'CL' | 'CO' | 'PE'
  // Europe
  | 'GB' | 'DE' | 'FR' | 'IT' | 'ES' | 'PT' | 'NL' | 'BE' | 'AT' | 'CH' | 'IE' | 'PL' | 'CZ' | 'SE' | 'NO' | 'DK' | 'FI'
  | 'TR' | 'RO' | 'HU' | 'GR' | 'HR' | 'UA'
  // Asia-Pacific
  | 'AU' | 'NZ' | 'JP' | 'KR' | 'CN' | 'HK' | 'SG' | 'MY' | 'TH' | 'ID' | 'PH' | 'VN' | 'IN'
  // South Asia
  | 'PK' | 'BD' | 'LK' | 'NP'
  // Middle East
  | 'AE' | 'SA' | 'QA' | 'KW' | 'OM' | 'BH' | 'IL'
  // Africa
  | 'ZA' | 'NG' | 'EG' | 'MA' | 'GH' | 'KE' | 'TZ' | 'UG' | 'RW' | 'ET' | 'ZM' | 'BI';

export const SUPPORTED_COUNTRIES: Record<SupportedCountryCode, { name: string; currency: string; flag: string; region: string }> = {
  // North America
  CA: { name: 'Canada', currency: 'CAD', flag: '🇨🇦', region: 'North America' },
  US: { name: 'United States', currency: 'USD', flag: '🇺🇸', region: 'North America' },
  MX: { name: 'Mexico', currency: 'MXN', flag: '🇲🇽', region: 'North America' },
  // South America
  AR: { name: 'Argentina', currency: 'ARS', flag: '🇦🇷', region: 'South America' },
  BR: { name: 'Brazil', currency: 'BRL', flag: '🇧🇷', region: 'South America' },
  CL: { name: 'Chile', currency: 'CLP', flag: '🇨🇱', region: 'South America' },
  CO: { name: 'Colombia', currency: 'COP', flag: '🇨🇴', region: 'South America' },
  PE: { name: 'Peru', currency: 'PEN', flag: '🇵🇪', region: 'South America' },
  // Europe
  GB: { name: 'United Kingdom', currency: 'GBP', flag: '🇬🇧', region: 'Europe' },
  DE: { name: 'Germany', currency: 'EUR', flag: '🇩🇪', region: 'Europe' },
  FR: { name: 'France', currency: 'EUR', flag: '🇫🇷', region: 'Europe' },
  IT: { name: 'Italy', currency: 'EUR', flag: '🇮🇹', region: 'Europe' },
  ES: { name: 'Spain', currency: 'EUR', flag: '🇪🇸', region: 'Europe' },
  PT: { name: 'Portugal', currency: 'EUR', flag: '🇵🇹', region: 'Europe' },
  NL: { name: 'Netherlands', currency: 'EUR', flag: '🇳🇱', region: 'Europe' },
  BE: { name: 'Belgium', currency: 'EUR', flag: '🇧🇪', region: 'Europe' },
  AT: { name: 'Austria', currency: 'EUR', flag: '🇦🇹', region: 'Europe' },
  CH: { name: 'Switzerland', currency: 'CHF', flag: '🇨🇭', region: 'Europe' },
  IE: { name: 'Ireland', currency: 'EUR', flag: '🇮🇪', region: 'Europe' },
  PL: { name: 'Poland', currency: 'PLN', flag: '🇵🇱', region: 'Europe' },
  CZ: { name: 'Czech Republic', currency: 'CZK', flag: '🇨🇿', region: 'Europe' },
  SE: { name: 'Sweden', currency: 'SEK', flag: '🇸🇪', region: 'Europe' },
  NO: { name: 'Norway', currency: 'NOK', flag: '🇳🇴', region: 'Europe' },
  DK: { name: 'Denmark', currency: 'DKK', flag: '🇩🇰', region: 'Europe' },
  FI: { name: 'Finland', currency: 'EUR', flag: '🇫🇮', region: 'Europe' },
  TR: { name: 'Turkey', currency: 'TRY', flag: '🇹🇷', region: 'Europe' },
  RO: { name: 'Romania', currency: 'RON', flag: '🇷🇴', region: 'Europe' },
  HU: { name: 'Hungary', currency: 'HUF', flag: '🇭🇺', region: 'Europe' },
  GR: { name: 'Greece', currency: 'EUR', flag: '🇬🇷', region: 'Europe' },
  HR: { name: 'Croatia', currency: 'EUR', flag: '🇭🇷', region: 'Europe' },
  UA: { name: 'Ukraine', currency: 'UAH', flag: '🇺🇦', region: 'Europe' },
  // Asia-Pacific
  AU: { name: 'Australia', currency: 'AUD', flag: '🇦🇺', region: 'Asia-Pacific' },
  NZ: { name: 'New Zealand', currency: 'NZD', flag: '🇳🇿', region: 'Asia-Pacific' },
  JP: { name: 'Japan', currency: 'JPY', flag: '🇯🇵', region: 'Asia-Pacific' },
  KR: { name: 'South Korea', currency: 'KRW', flag: '🇰🇷', region: 'Asia-Pacific' },
  CN: { name: 'China', currency: 'CNY', flag: '🇨🇳', region: 'Asia-Pacific' },
  HK: { name: 'Hong Kong', currency: 'HKD', flag: '🇭🇰', region: 'Asia-Pacific' },
  SG: { name: 'Singapore', currency: 'SGD', flag: '🇸🇬', region: 'Asia-Pacific' },
  MY: { name: 'Malaysia', currency: 'MYR', flag: '🇲🇾', region: 'Asia-Pacific' },
  TH: { name: 'Thailand', currency: 'THB', flag: '🇹🇭', region: 'Asia-Pacific' },
  ID: { name: 'Indonesia', currency: 'IDR', flag: '🇮🇩', region: 'Asia-Pacific' },
  PH: { name: 'Philippines', currency: 'PHP', flag: '🇵🇭', region: 'Asia-Pacific' },
  VN: { name: 'Vietnam', currency: 'VND', flag: '🇻🇳', region: 'Asia-Pacific' },
  IN: { name: 'India', currency: 'INR', flag: '🇮🇳', region: 'South Asia' },
  PK: { name: 'Pakistan', currency: 'PKR', flag: '🇵🇰', region: 'South Asia' },
  BD: { name: 'Bangladesh', currency: 'BDT', flag: '🇧🇩', region: 'South Asia' },
  LK: { name: 'Sri Lanka', currency: 'LKR', flag: '🇱🇰', region: 'South Asia' },
  NP: { name: 'Nepal', currency: 'NPR', flag: '🇳🇵', region: 'South Asia' },
  // Middle East
  AE: { name: 'United Arab Emirates', currency: 'AED', flag: '🇦🇪', region: 'Middle East' },
  SA: { name: 'Saudi Arabia', currency: 'SAR', flag: '🇸🇦', region: 'Middle East' },
  QA: { name: 'Qatar', currency: 'QAR', flag: '🇶🇦', region: 'Middle East' },
  KW: { name: 'Kuwait', currency: 'KWD', flag: '🇰🇼', region: 'Middle East' },
  OM: { name: 'Oman', currency: 'OMR', flag: '🇴🇲', region: 'Middle East' },
  BH: { name: 'Bahrain', currency: 'BHD', flag: '🇧🇭', region: 'Middle East' },
  IL: { name: 'Israel', currency: 'ILS', flag: '🇮🇱', region: 'Middle East' },
  // Africa
  ZA: { name: 'South Africa', currency: 'ZAR', flag: '🇿🇦', region: 'Africa' },
  NG: { name: 'Nigeria', currency: 'NGN', flag: '🇳🇬', region: 'Africa' },
  EG: { name: 'Egypt', currency: 'EGP', flag: '🇪🇬', region: 'Africa' },
  MA: { name: 'Morocco', currency: 'MAD', flag: '🇲🇦', region: 'Africa' },
  GH: { name: 'Ghana', currency: 'GHS', flag: '🇬🇭', region: 'Africa' },
  KE: { name: 'Kenya', currency: 'KES', flag: '🇰🇪', region: 'Africa' },
  TZ: { name: 'Tanzania', currency: 'TZS', flag: '🇹🇿', region: 'Africa' },
  UG: { name: 'Uganda', currency: 'UGX', flag: '🇺🇬', region: 'Africa' },
  RW: { name: 'Rwanda', currency: 'RWF', flag: '🇷🇼', region: 'Africa' },
  ET: { name: 'Ethiopia', currency: 'ETB', flag: '🇪🇹', region: 'Africa' },
  ZM: { name: 'Zambia', currency: 'ZMW', flag: '🇿🇲', region: 'Africa' },
  BI: { name: 'Burundi', currency: 'BIF', flag: '🇧🇮', region: 'Africa' },
};

// Tax calculation result
export interface TaxCalculation {
  grossAmount: number;
  taxableAmount: number;
  taxes: Array<{
    taxTypeId: string;
    taxCode: string;
    taxName: string;
    rate: number;
    amount: number;
    isRecoverable: boolean;
  }>;
  totalTax: number;
  netAmount: number;
}

// Payroll calculation result
export interface PayrollCalculation {
  grossPay: number;
  employeeDeductions: Array<{
    deductionTypeId: string;
    code: string;
    name: string;
    amount: number;
  }>;
  employerContributions: Array<{
    deductionTypeId: string;
    code: string;
    name: string;
    amount: number;
  }>;
  totalEmployeeDeductions: number;
  totalEmployerContributions: number;
  netPay: number;
}
