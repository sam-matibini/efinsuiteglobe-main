// Canadian Tax Data for 2025
// Source: CRA - Canada Revenue Agency
// Official 2025 values (2.7% indexation factor applied to 2024)

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface ProvinceTaxData {
  name: string;
  basicPersonalAmount: number;
  brackets: TaxBracket[];
  surtax?: { threshold: number; rate: number }[];
  healthPremium?: { threshold: number; amount: number }[];
}

// 2025 Federal Tax Brackets (CRA T4032)
export const FEDERAL_TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 57375, rate: 0.15 },
  { min: 57375, max: 114750, rate: 0.205 },
  { min: 114750, max: 177882, rate: 0.26 },
  { min: 177882, max: 253414, rate: 0.29 },
  { min: 253414, max: Infinity, rate: 0.33 }
];

// 2025 Federal Basic Personal Amount (CRA TD1)
export const FEDERAL_BASIC_PERSONAL_AMOUNT = 16129;
export const FEDERAL_CANADA_EMPLOYMENT_AMOUNT = 1368;

// 2025 CPP Rates (CRA T4032)
export const CPP_RATES = {
  rate: 0.0595, // 5.95%
  employerRate: 0.0595,
  maxPensionableEarnings: 71300,
  basicExemption: 3500,
  maxContribution: 4034.10,
  // CPP2 for earnings above first ceiling
  cpp2Rate: 0.04,
  cpp2MaxEarnings: 81200,
  cpp2MaxContribution: 396.00
};

// 2025 EI Rates (CRA)
export const EI_RATES = {
  employeeRate: 0.0164, // 1.64%
  employerRate: 0.02296, // 1.64 x 1.4 = 2.296%
  maxInsurableEarnings: 65700,
  maxEmployeePremium: 1077.48,
  maxEmployerPremium: 1508.47
};

// Quebec QPIP (for Quebec employees) - 2025 (Revenu Quebec)
export const QPIP_RATES = {
  employeeRate: 0.00494, // 0.494%
  employerRate: 0.00692, // 0.692%
  maxInsurableEarnings: 98000,
  maxEmployeePremium: 483.88,
  maxEmployerPremium: 678.16
};

// Provincial Tax Data - 2025 (CRA T4032 Provincial Tables / KPMG)
export const PROVINCIAL_TAX_DATA: Record<string, ProvinceTaxData> = {
  'AB': {
    name: 'Alberta',
    basicPersonalAmount: 22323,
    brackets: [
      { min: 0, max: 148269, rate: 0.10 },
      { min: 148269, max: 177922, rate: 0.12 },
      { min: 177922, max: 237230, rate: 0.13 },
      { min: 237230, max: 355845, rate: 0.14 },
      { min: 355845, max: Infinity, rate: 0.15 }
    ]
  },
  'BC': {
    name: 'British Columbia',
    basicPersonalAmount: 12932,
    brackets: [
      { min: 0, max: 47937, rate: 0.0506 },
      { min: 47937, max: 95875, rate: 0.077 },
      { min: 95875, max: 110076, rate: 0.105 },
      { min: 110076, max: 133664, rate: 0.1229 },
      { min: 133664, max: 181232, rate: 0.147 },
      { min: 181232, max: 252752, rate: 0.168 },
      { min: 252752, max: Infinity, rate: 0.205 }
    ]
  },
  'MB': {
    name: 'Manitoba',
    basicPersonalAmount: 15969,  // CRA 2025 PDOC / T4032
    brackets: [
      { min: 0, max: 47000, rate: 0.108 },
      { min: 47000, max: 100000, rate: 0.1275 },
      { min: 100000, max: Infinity, rate: 0.174 }
    ]
  },
  'NB': {
    name: 'New Brunswick',
    basicPersonalAmount: 13044,
    brackets: [
      { min: 0, max: 49958, rate: 0.094 },
      { min: 49958, max: 99916, rate: 0.14 },
      { min: 99916, max: 185064, rate: 0.16 },
      { min: 185064, max: Infinity, rate: 0.195 }
    ]
  },
  'NL': {
    name: 'Newfoundland and Labrador',
    basicPersonalAmount: 10818,
    brackets: [
      { min: 0, max: 43198, rate: 0.087 },
      { min: 43198, max: 86395, rate: 0.145 },
      { min: 86395, max: 154244, rate: 0.158 },
      { min: 154244, max: 215943, rate: 0.178 },
      { min: 215943, max: 275870, rate: 0.198 },
      { min: 275870, max: 551739, rate: 0.208 },
      { min: 551739, max: 1103478, rate: 0.213 },
      { min: 1103478, max: Infinity, rate: 0.218 }
    ]
  },
  'NS': {
    name: 'Nova Scotia',
    basicPersonalAmount: 11481,
    brackets: [
      { min: 0, max: 29590, rate: 0.0879 },
      { min: 29590, max: 59180, rate: 0.1495 },
      { min: 59180, max: 93000, rate: 0.1667 },
      { min: 93000, max: 150000, rate: 0.175 },
      { min: 150000, max: Infinity, rate: 0.21 }
    ]
  },
  'NT': {
    name: 'Northwest Territories',
    basicPersonalAmount: 17373,
    brackets: [
      { min: 0, max: 50597, rate: 0.059 },
      { min: 50597, max: 101198, rate: 0.086 },
      { min: 101198, max: 164525, rate: 0.122 },
      { min: 164525, max: Infinity, rate: 0.1405 }
    ]
  },
  'NU': {
    name: 'Nunavut',
    basicPersonalAmount: 18767,
    brackets: [
      { min: 0, max: 53268, rate: 0.04 },
      { min: 53268, max: 106537, rate: 0.07 },
      { min: 106537, max: 173205, rate: 0.09 },
      { min: 173205, max: Infinity, rate: 0.115 }
    ]
  },
  'ON': {
    name: 'Ontario',
    basicPersonalAmount: 11865,
    brackets: [
      { min: 0, max: 52886, rate: 0.0505 },
      { min: 52886, max: 105775, rate: 0.0915 },
      { min: 105775, max: 150000, rate: 0.1116 },
      { min: 150000, max: 220000, rate: 0.1216 },
      { min: 220000, max: Infinity, rate: 0.1316 }
    ],
    surtax: [
      { threshold: 5710, rate: 0.20 },
      { threshold: 7307, rate: 0.36 }
    ],
    healthPremium: [
      { threshold: 20000, amount: 0 },
      { threshold: 25000, amount: 300 },
      { threshold: 36000, amount: 450 },
      { threshold: 38500, amount: 600 },
      { threshold: 48000, amount: 750 },
      { threshold: 72000, amount: 900 },
      { threshold: 200000, amount: 750 },
      { threshold: Infinity, amount: 900 }
    ]
  },
  'PE': {
    name: 'Prince Edward Island',
    basicPersonalAmount: 13500,
    brackets: [
      { min: 0, max: 32656, rate: 0.098 },
      { min: 32656, max: 64313, rate: 0.138 },
      { min: 64313, max: 105000, rate: 0.167 },
      { min: 105000, max: 140000, rate: 0.1725 },
      { min: 140000, max: Infinity, rate: 0.18 }
    ]
  },
  'QC': {
    name: 'Quebec',
    basicPersonalAmount: 18056,
    brackets: [
      { min: 0, max: 51780, rate: 0.14 },
      { min: 51780, max: 103545, rate: 0.19 },
      { min: 103545, max: 126000, rate: 0.24 },
      { min: 126000, max: Infinity, rate: 0.2575 }
    ]
  },
  'SK': {
    name: 'Saskatchewan',
    basicPersonalAmount: 19491,
    brackets: [
      { min: 0, max: 52057, rate: 0.105 },
      { min: 52057, max: 148734, rate: 0.125 },
      { min: 148734, max: Infinity, rate: 0.145 }
    ]
  },
  'YT': {
    name: 'Yukon',
    basicPersonalAmount: 16129,
    brackets: [
      { min: 0, max: 57375, rate: 0.064 },
      { min: 57375, max: 114750, rate: 0.09 },
      { min: 114750, max: 177882, rate: 0.109 },
      { min: 177882, max: 500000, rate: 0.128 },
      { min: 500000, max: Infinity, rate: 0.15 }
    ]
  }
};

// TD1 Default Claim Amounts by Province (2025 - CRA TD1 Forms)
export const TD1_DEFAULTS: Record<string, {
  basicPersonalAmount: number;
  canadaEmploymentAmount: number;
  ageAmount?: number;
  disabilityAmount?: number;
}> = {
  'federal': {
    basicPersonalAmount: FEDERAL_BASIC_PERSONAL_AMOUNT, // $16,129
    canadaEmploymentAmount: FEDERAL_CANADA_EMPLOYMENT_AMOUNT, // $1,368
    ageAmount: 9028,
    disabilityAmount: 10138
  },
  'AB': {
    basicPersonalAmount: 22323,
    canadaEmploymentAmount: 0,
    ageAmount: 6608,
    disabilityAmount: 16635
  },
  'BC': {
    basicPersonalAmount: 12932,
    canadaEmploymentAmount: 0,
    ageAmount: 5557,
    disabilityAmount: 9428
  },
  'MB': {
    basicPersonalAmount: 15969,  // CRA 2025 PDOC / T4032
    canadaEmploymentAmount: 0,
    ageAmount: 0,
    disabilityAmount: 0
  },
  'NB': {
    basicPersonalAmount: 13044,
    canadaEmploymentAmount: 0,
    ageAmount: 5928,
    disabilityAmount: 9626
  },
  'NL': {
    basicPersonalAmount: 10818,
    canadaEmploymentAmount: 0,
    ageAmount: 7354,
    disabilityAmount: 7258
  },
  'NS': {
    basicPersonalAmount: 11481,
    canadaEmploymentAmount: 0,
    ageAmount: 6096,
    disabilityAmount: 8081
  },
  'NT': {
    basicPersonalAmount: 17373,
    canadaEmploymentAmount: 0,
    ageAmount: 8283,
    disabilityAmount: 15064
  },
  'NU': {
    basicPersonalAmount: 18767,
    canadaEmploymentAmount: 0,
    ageAmount: 13934,
    disabilityAmount: 16274
  },
  'ON': {
    basicPersonalAmount: 11865,
    canadaEmploymentAmount: 0,
    ageAmount: 5867,
    disabilityAmount: 9586
  },
  'PE': {
    basicPersonalAmount: 13500,
    canadaEmploymentAmount: 0,
    ageAmount: 5508,
    disabilityAmount: 7619
  },
  'QC': {
    basicPersonalAmount: 18056,
    canadaEmploymentAmount: 0,
    ageAmount: 3659,
    disabilityAmount: 3959
  },
  'SK': {
    basicPersonalAmount: 19491,
    canadaEmploymentAmount: 0,
    ageAmount: 5852,
    disabilityAmount: 11385
  },
  'YT': {
    basicPersonalAmount: 16129,
    canadaEmploymentAmount: 1368,
    ageAmount: 9028,
    disabilityAmount: 10138
  }
};

// Default onboarding tasks template
export const DEFAULT_ONBOARDING_TASKS = [
  { task_name: 'Complete TD1 Federal Form', task_category: 'compliance', description: 'Personal Tax Credits Return - Federal', sort_order: 1 },
  { task_name: 'Complete TD1 Provincial Form', task_category: 'compliance', description: 'Personal Tax Credits Return - Provincial', sort_order: 2 },
  { task_name: 'Provide SIN', task_category: 'documents', description: 'Social Insurance Number for payroll', sort_order: 3 },
  { task_name: 'Direct Deposit Setup', task_category: 'setup', description: 'Provide banking information for pay deposits', sort_order: 4 },
  { task_name: 'Emergency Contact Info', task_category: 'documents', description: 'Provide emergency contact information', sort_order: 5 },
  { task_name: 'Employment Contract', task_category: 'documents', description: 'Sign employment contract and offer letter', sort_order: 6 },
  { task_name: 'Benefits Enrollment', task_category: 'setup', description: 'Enroll in company benefits program', sort_order: 7 },
  { task_name: 'IT Access Setup', task_category: 'setup', description: 'Set up email, computer access, and accounts', sort_order: 8 },
  { task_name: 'Safety Training', task_category: 'training', description: 'Complete workplace safety orientation', sort_order: 9 },
  { task_name: 'Policy Acknowledgement', task_category: 'compliance', description: 'Read and acknowledge company policies', sort_order: 10 }
];

// Calculate federal tax
export function calculateFederalTax(taxableIncome: number): number {
  let tax = 0;
  let remaining = taxableIncome;
  
  for (const bracket of FEDERAL_TAX_BRACKETS) {
    if (remaining <= 0) break;
    
    const taxableInBracket = Math.min(remaining, bracket.max - bracket.min);
    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
  }
  
  return Math.max(0, tax);
}

// Calculate provincial tax
export function calculateProvincialTax(taxableIncome: number, province: string): number {
  const provinceTax = PROVINCIAL_TAX_DATA[province];
  if (!provinceTax) return 0;
  
  let tax = 0;
  let remaining = taxableIncome;
  
  for (const bracket of provinceTax.brackets) {
    if (remaining <= 0) break;
    
    const taxableInBracket = Math.min(remaining, bracket.max - bracket.min);
    tax += taxableInBracket * bracket.rate;
    remaining -= taxableInBracket;
  }
  
  // Apply Ontario surtax if applicable
  if (province === 'ON' && provinceTax.surtax) {
    let surtax = 0;
    for (const st of provinceTax.surtax) {
      if (tax > st.threshold) {
        surtax += (tax - st.threshold) * st.rate;
      }
    }
    tax += surtax;
  }
  
  return Math.max(0, tax);
}

// Calculate CPP contribution
// periodsPerYear: number of pay periods (52=weekly, 26=biweekly, 24=semi-monthly, 12=monthly)
export function calculateCPP(pensionableEarnings: number, ytdPensionableEarnings: number = 0, periodsPerYear: number = 26): {
  employeeContribution: number;
  employerContribution: number;
  cpp2Employee: number;
  cpp2Employer: number;
} {
  const { rate, maxPensionableEarnings, basicExemption, maxContribution, cpp2Rate, cpp2MaxEarnings, cpp2MaxContribution } = CPP_RATES;
  
  // Calculate period basic exemption based on actual pay frequency (CRA T4032 formula)
  const periodExemption = basicExemption / periodsPerYear;
  
  // CPP1 calculation
  const cpp1PensionableThisPeriod = Math.max(0, Math.min(pensionableEarnings, maxPensionableEarnings - ytdPensionableEarnings));
  const cpp1Contribution = Math.max(0, (cpp1PensionableThisPeriod - periodExemption) * rate);
  const cappedCpp1 = Math.min(cpp1Contribution, maxContribution);
  
  // CPP2 calculation (earnings above first ceiling)
  let cpp2Contribution = 0;
  const totalEarnings = ytdPensionableEarnings + pensionableEarnings;
  if (totalEarnings > maxPensionableEarnings) {
    const cpp2Pensionable = Math.min(totalEarnings, cpp2MaxEarnings) - maxPensionableEarnings;
    cpp2Contribution = Math.min(cpp2Pensionable * cpp2Rate, cpp2MaxContribution);
  }
  
  return {
    employeeContribution: cappedCpp1,
    employerContribution: cappedCpp1,
    cpp2Employee: cpp2Contribution,
    cpp2Employer: cpp2Contribution
  };
}

// Calculate EI premium
export function calculateEI(insurableEarnings: number, ytdInsurableEarnings: number = 0): {
  employeePremium: number;
  employerPremium: number;
} {
  const { employeeRate, employerRate, maxInsurableEarnings, maxEmployeePremium, maxEmployerPremium } = EI_RATES;
  
  const insurableThisPeriod = Math.max(0, Math.min(insurableEarnings, maxInsurableEarnings - ytdInsurableEarnings));
  
  const employeePremium = Math.min(insurableThisPeriod * employeeRate, maxEmployeePremium);
  const employerPremium = Math.min(insurableThisPeriod * employerRate, maxEmployerPremium);
  
  return { employeePremium, employerPremium };
}
