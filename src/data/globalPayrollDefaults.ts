// Global payroll tax deduction defaults for all supported countries

export interface PayrollDeductionConfig {
  code: string;
  name: string;
  description: string;
  employeeRate: number;
  employerRate?: number;
  maxEarnings?: number;
  maxContribution?: number;
  isEmployeePortion: boolean;
  inputType: 'rate' | 'amount' | 'boolean';
}

export interface TaxCreditConfig {
  code: string;
  name: string;
  defaultAmount: number;
  description?: string;
}

export interface CountryPayrollConfig {
  taxFormName: string;
  taxFormDescription: string;
  nationalIdLabel: string;
  nationalIdPlaceholder: string;
  nationalIdPattern?: RegExp;
  federalDeductions: PayrollDeductionConfig[];
  jurisdictionalDeductions: PayrollDeductionConfig[];
  federalTaxCredits: TaxCreditConfig[];
  jurisdictionalTaxCredits: TaxCreditConfig[];
  autoPopulateLabel: string;
  autoPopulateSource: string;
  currencySymbol: string;
  currencyCode: string;
}

// 2025 Canadian Tax Data (Source: CRA T4032, TD1)
const CANADA_CONFIG: CountryPayrollConfig = {
  taxFormName: 'TD1 Tax Credits',
  taxFormDescription: '2025 Federal and Provincial tax credits',
  nationalIdLabel: 'Social Insurance Number (SIN)',
  nationalIdPlaceholder: '123-456-789',
  nationalIdPattern: /^\d{3}-?\d{3}-?\d{3}$/,
  autoPopulateLabel: 'Auto-populate with CRA Defaults',
  autoPopulateSource: 'CRA',
  currencySymbol: '$',
  currencyCode: 'CAD',
  federalDeductions: [
    { code: 'CPP', name: 'CPP', description: 'Canada Pension Plan', employeeRate: 5.95, employerRate: 5.95, maxEarnings: 71300, maxContribution: 4034.10, isEmployeePortion: true, inputType: 'rate' },
    { code: 'EI', name: 'EI', description: 'Employment Insurance', employeeRate: 1.64, employerRate: 2.296, maxEarnings: 65700, maxContribution: 1077.48, isEmployeePortion: true, inputType: 'rate' },
  ],
  jurisdictionalDeductions: [],
  federalTaxCredits: [
    { code: 'BPA', name: 'Basic Personal Amount', defaultAmount: 16129 },
    { code: 'CEA', name: 'Canada Employment Amount', defaultAmount: 1368 },
    { code: 'AGE', name: 'Age Amount (65+)', defaultAmount: 0 },
    { code: 'DIS', name: 'Disability Amount', defaultAmount: 0 },
    { code: 'SPOUSE', name: 'Spouse/Common-law Partner', defaultAmount: 0 },
    { code: 'TUITION', name: 'Tuition (Full-time)', defaultAmount: 0 },
    { code: 'OTHER', name: 'Other Tax Credits', defaultAmount: 0 },
    { code: 'ADDL_TAX', name: 'Additional Tax to Deduct', defaultAmount: 0 },
  ],
  jurisdictionalTaxCredits: [
    { code: 'BPA', name: 'Basic Personal Amount', defaultAmount: 11865 },
    { code: 'AGE', name: 'Age Amount (65+)', defaultAmount: 0 },
    { code: 'DIS', name: 'Disability Amount', defaultAmount: 0 },
    { code: 'SPOUSE', name: 'Spouse/Common-law Partner', defaultAmount: 0 },
    { code: 'TUITION', name: 'Tuition (Full-time)', defaultAmount: 0 },
    { code: 'OTHER', name: 'Other Tax Credits', defaultAmount: 0 },
    { code: 'ADDL_TAX', name: 'Additional Tax to Deduct', defaultAmount: 0 },
  ],
};

// 2025 US Tax Data
const US_CONFIG: CountryPayrollConfig = {
  taxFormName: 'W-4 Withholding',
  taxFormDescription: '2025 Federal and State withholding elections',
  nationalIdLabel: 'Social Security Number (SSN)',
  nationalIdPlaceholder: '123-45-6789',
  nationalIdPattern: /^\d{3}-?\d{2}-?\d{4}$/,
  autoPopulateLabel: 'Apply IRS Defaults',
  autoPopulateSource: 'IRS',
  currencySymbol: '$',
  currencyCode: 'USD',
  federalDeductions: [
    { code: 'FICA-SS', name: 'Social Security', description: 'OASDI', employeeRate: 6.2, employerRate: 6.2, maxEarnings: 176100, maxContribution: 10918.20, isEmployeePortion: true, inputType: 'rate' },
    { code: 'FICA-MED', name: 'Medicare', description: 'Hospital Insurance', employeeRate: 1.45, employerRate: 1.45, isEmployeePortion: true, inputType: 'rate' },
    { code: 'FICA-MED-ADD', name: 'Additional Medicare', description: 'High earner (>$200k)', employeeRate: 0.9, isEmployeePortion: true, inputType: 'rate' },
  ],
  jurisdictionalDeductions: [
    { code: 'SIT', name: 'State Income Tax', description: 'State withholding', employeeRate: 0, isEmployeePortion: true, inputType: 'rate' },
    { code: 'SDI', name: 'State Disability', description: 'Where applicable', employeeRate: 0, isEmployeePortion: true, inputType: 'rate' },
  ],
  federalTaxCredits: [
    { code: 'FILING_STATUS', name: 'Filing Status', defaultAmount: 1, description: '1=Single, 2=Married, 3=Head of Household' },
    { code: 'ALLOWANCES', name: 'Federal Allowances', defaultAmount: 0 },
    { code: 'ADDL_WITHHOLD', name: 'Additional Withholding ($)', defaultAmount: 0 },
    { code: 'EXEMPT', name: 'Claim Exempt', defaultAmount: 0, description: '1=Yes, 0=No' },
  ],
  jurisdictionalTaxCredits: [
    { code: 'STATE_ALLOWANCES', name: 'State Allowances', defaultAmount: 0 },
    { code: 'STATE_ADDL', name: 'Additional State Withholding ($)', defaultAmount: 0 },
  ],
};

// 2025 Zambia Tax Data
const ZAMBIA_CONFIG: CountryPayrollConfig = {
  taxFormName: 'Payroll Deductions',
  taxFormDescription: '2025 ZRA statutory deductions',
  nationalIdLabel: 'National Registration Card (NRC)',
  nationalIdPlaceholder: '123456/78/9',
  autoPopulateLabel: 'Apply ZRA Defaults',
  autoPopulateSource: 'ZRA',
  currencySymbol: 'K',
  currencyCode: 'ZMW',
  federalDeductions: [
    { code: 'NAPSA', name: 'NAPSA', description: 'Pension (5% employee / 5% employer)', employeeRate: 5, employerRate: 5, maxEarnings: 332460, maxContribution: 16623, isEmployeePortion: true, inputType: 'rate' },
    { code: 'NHIMA', name: 'NHIMA', description: 'Health Insurance (1% / 1%)', employeeRate: 1, employerRate: 1, isEmployeePortion: true, inputType: 'rate' },
  ],
  jurisdictionalDeductions: [],
  federalTaxCredits: [
    { code: 'TAX_EXEMPT', name: 'Tax Exempt Income (Monthly)', defaultAmount: 5100, description: 'First K5,100 exempt' },
    { code: 'DISABILITY', name: 'Disability Exemption', defaultAmount: 0, description: 'K500/month if applicable' },
  ],
  jurisdictionalTaxCredits: [],
};

// 2025 Kenya Tax Data
const KENYA_CONFIG: CountryPayrollConfig = {
  taxFormName: 'Payroll Deductions',
  taxFormDescription: '2025 KRA statutory deductions',
  nationalIdLabel: 'National ID / KRA PIN',
  nationalIdPlaceholder: 'A123456789B',
  autoPopulateLabel: 'Apply KRA Defaults',
  autoPopulateSource: 'KRA',
  currencySymbol: 'KSh',
  currencyCode: 'KES',
  federalDeductions: [
    { code: 'NSSF-TI', name: 'NSSF Tier I', description: 'Pension (6% / 6%)', employeeRate: 6, employerRate: 6, maxEarnings: 7000, isEmployeePortion: true, inputType: 'rate' },
    { code: 'NSSF-TII', name: 'NSSF Tier II', description: 'Pension (6% / 6%)', employeeRate: 6, employerRate: 6, maxEarnings: 36000, isEmployeePortion: true, inputType: 'rate' },
    { code: 'SHIF', name: 'SHIF', description: 'Health (2.75% employee)', employeeRate: 2.75, isEmployeePortion: true, inputType: 'rate' },
    { code: 'AHL', name: 'Affordable Housing', description: 'Housing levy (1.5% / 1.5%)', employeeRate: 1.5, employerRate: 1.5, isEmployeePortion: true, inputType: 'rate' },
  ],
  jurisdictionalDeductions: [],
  federalTaxCredits: [
    { code: 'PERSONAL_RELIEF', name: 'Personal Relief (Monthly)', defaultAmount: 2400, description: 'KES 2,400/month' },
    { code: 'INSURANCE_RELIEF', name: 'Insurance Relief', defaultAmount: 0, description: '15% of premiums, max KES 5,000/month' },
    { code: 'DISABILITY_EXEMPT', name: 'Disability Exemption', defaultAmount: 0, description: 'First KES 150,000/month if applicable' },
  ],
  jurisdictionalTaxCredits: [],
};

// 2025 Burundi Tax Data
const BURUNDI_CONFIG: CountryPayrollConfig = {
  taxFormName: 'Déductions Paie',
  taxFormDescription: '2025 OBR déductions obligatoires',
  nationalIdLabel: 'Numéro CNI',
  nationalIdPlaceholder: '12345678',
  autoPopulateLabel: 'Appliquer Défauts OBR',
  autoPopulateSource: 'OBR',
  currencySymbol: 'FBu',
  currencyCode: 'BIF',
  federalDeductions: [
    { code: 'INSS-PEN', name: 'INSS Pension', description: 'Pension (4% / 6%)', employeeRate: 4, employerRate: 6, isEmployeePortion: true, inputType: 'rate' },
    { code: 'MFP', name: 'MFP', description: 'Health (3% / 3%)', employeeRate: 3, employerRate: 3, isEmployeePortion: true, inputType: 'rate' },
    { code: 'ONPR', name: 'ONPR', description: 'Pension (4% / 6%)', employeeRate: 4, employerRate: 6, isEmployeePortion: true, inputType: 'rate' },
  ],
  jurisdictionalDeductions: [],
  federalTaxCredits: [
    { code: 'TAX_EXEMPT', name: 'Revenu Exonéré (Mensuel)', defaultAmount: 150000, description: 'Premiers 150,000 FBu exonérés' },
  ],
  jurisdictionalTaxCredits: [],
};

export const COUNTRY_PAYROLL_CONFIG: Record<string, CountryPayrollConfig> = {
  CA: CANADA_CONFIG,
  US: US_CONFIG,
  ZM: ZAMBIA_CONFIG,
  KE: KENYA_CONFIG,
  BI: BURUNDI_CONFIG,
};

// Get provincial/state BPA defaults for Canada (Source: CRA TD1 2025)
export const CANADIAN_PROVINCIAL_BPA: Record<string, number> = {
  AB: 22323,
  BC: 12932,
  MB: 15969,
  NB: 13044,
  NL: 10818,
  NS: 11481,
  NT: 17373,
  NU: 18767,
  ON: 11865,
  PE: 13500,
  QC: 18056,
  SK: 19491,
  YT: 16129,
};

export function getCountryPayrollConfig(countryCode: string): CountryPayrollConfig {
  return COUNTRY_PAYROLL_CONFIG[countryCode] || US_CONFIG;
}

export function getProvincialBPA(provinceCode: string): number {
  return CANADIAN_PROVINCIAL_BPA[provinceCode] || 12989;
}
