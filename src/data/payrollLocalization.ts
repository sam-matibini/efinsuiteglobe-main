// Payroll module localization for all supported countries

export interface TaxSlipConfig {
  slipName: string;
  slipCode: string;
  description: string;
  boxLabels: {
    income: string;
    taxDeducted: string;
    pension: string;
    socialInsurance: string;
  };
  generateButtonLabel: string;
  emptyStateMessage: string;
  authority: string;
}

export interface SeparationDocConfig {
  docName: string;
  docCode: string;
  description: string;
  createButtonLabel: string;
  reasonLabel: string;
  available: boolean;
}

export interface RemittanceConfig {
  title: string;
  description: string;
  authority: string;
  formCode: string;
  columns: {
    pension: string;
    socialInsurance: string;
    tax: string;
  };
  generateDescription: string;
}

export type StatutoryReportCategory = 'tax' | 'payroll' | 'remittance_control' | 'management';
export type ReportFrequency = 'monthly' | 'each_payroll' | 'annual' | 'where_applicable';

/** A report the organisation must (or should) prepare, and who receives it. */
export interface StatutoryReportDef {
  id: string;
  name: string;
  category: StatutoryReportCategory;
  /** What the report contains (column groups). */
  contents: string[];
  recipient: string;
  frequency: ReportFrequency;
  /** Links to a ComplianceDeadline.id when the report is filed/paid by a deadline. */
  deadlineId?: string;
  /** True when filed with or paid to an authority; false for internal control reports. */
  statutory: boolean;
  legalBasis?: string;
  /** Shown when the obligation depends on the employer or employee (opt-in, headcount, scheme). */
  applicability?: string;
}

/** How a due date is worked out for a payroll / tax month. */
export type DeadlineRule =
  | { kind: 'day_of_following_month'; day: number }
  | { kind: 'working_days_after_salary'; days: number }
  | { kind: 'within_one_month_of_deduction' }
  | { kind: 'month_end' }
  | { kind: 'annual'; month: number; day: number }   // for the previous calendar year
  | { kind: 'scheme_specific' };

export interface ComplianceDeadline {
  id: string;
  activity: string;
  authority: string;
  rule: DeadlineRule;
  legalBasis: string;
  /** Extra guidance, e.g. where state rules differ. */
  note?: string;
  /** Deadline varies by authority/state; users should confirm locally. */
  confirmWithAuthority?: boolean;
}

export interface PayrollLocalization {
  taxSlips: TaxSlipConfig;
  separationDoc: SeparationDocConfig;
  remittances: RemittanceConfig;
  /** Monthly statutory, payroll and remittance-control reports (optional per country). */
  statutoryReports?: StatutoryReportDef[];
  /** Filing and remittance deadlines (optional per country). */
  complianceCalendar?: ComplianceDeadline[];
  currencyCode: string;
  currencyLocale: string;
  sidebarLabels: {
    taxSlips: string;
    separationDoc: string;
    remittances: string;
  };
}

const CANADA_PAYROLL: PayrollLocalization = {
  taxSlips: {
    slipName: 'T4 Tax Slips',
    slipCode: 'T4',
    description: 'Generate and manage annual T4 slips for employees',
    boxLabels: {
      income: 'Box 14 - Employment Income',
      taxDeducted: 'Box 22 - Tax Deducted',
      pension: 'Box 16 - CPP',
      socialInsurance: 'Box 18 - EI',
    },
    generateButtonLabel: 'Generate T4 Slips',
    emptyStateMessage: 'No T4 slips found for {year}. Generate slips to get started.',
    authority: 'CRA',
  },
  separationDoc: {
    docName: 'Record of Employment',
    docCode: 'ROE',
    description: 'Create and manage ROE records for terminated employees',
    createButtonLabel: 'Create ROE',
    reasonLabel: 'Reason for Separation',
    available: true,
  },
  remittances: {
    title: 'CRA Remittances',
    description: 'Manage source deduction remittances to CRA',
    authority: 'CRA',
    formCode: 'PD7A',
    columns: {
      pension: 'CPP (EE+ER)',
      socialInsurance: 'EI (EE+ER)',
      tax: 'Income Tax',
    },
    generateDescription: 'Generate a CRA remittance summary from paid pay runs for a specific month.',
  },
  currencyCode: 'CAD',
  currencyLocale: 'en-CA',
  sidebarLabels: {
    taxSlips: 'T4 Tax Slips',
    separationDoc: 'ROE Records',
    remittances: 'Remittances',
  },
};

const US_PAYROLL: PayrollLocalization = {
  taxSlips: {
    slipName: 'W-2 Forms',
    slipCode: 'W-2',
    description: 'Generate and manage annual W-2 wage statements for employees',
    boxLabels: {
      income: 'Box 1 - Wages',
      taxDeducted: 'Box 2 - Federal Tax Withheld',
      pension: 'Box 4 - Social Security',
      socialInsurance: 'Box 6 - Medicare',
    },
    generateButtonLabel: 'Generate W-2 Forms',
    emptyStateMessage: 'No W-2 forms found for {year}. Generate forms to get started.',
    authority: 'IRS',
  },
  separationDoc: {
    docName: 'Separation Notice',
    docCode: 'DOL',
    description: 'Create separation notices for terminated employees',
    createButtonLabel: 'Create Notice',
    reasonLabel: 'Separation Reason',
    available: false, // State-specific, not federally mandated
  },
  remittances: {
    title: 'IRS Tax Deposits',
    description: 'Manage federal tax deposits to IRS via EFTPS',
    authority: 'IRS',
    formCode: 'Form 941',
    columns: {
      pension: 'Social Security',
      socialInsurance: 'Medicare',
      tax: 'Federal Tax',
    },
    generateDescription: 'Generate an IRS deposit summary from paid payrolls for a specific period.',
  },
  currencyCode: 'USD',
  currencyLocale: 'en-US',
  sidebarLabels: {
    taxSlips: 'W-2 Forms',
    separationDoc: 'Separation Notices',
    remittances: 'Tax Deposits',
  },
};

const ZAMBIA_PAYROLL: PayrollLocalization = {
  taxSlips: {
    slipName: 'ITF 18 Certificate',
    slipCode: 'ITF18',
    description: 'Generate annual PAYE tax certificates for employees',
    boxLabels: {
      income: 'Gross Emoluments',
      taxDeducted: 'PAYE Deducted',
      pension: 'NAPSA Contribution',
      socialInsurance: 'NHIMA Contribution',
    },
    generateButtonLabel: 'Generate ITF 18',
    emptyStateMessage: 'No ITF 18 certificates found for {year}. Generate certificates to get started.',
    authority: 'ZRA',
  },
  separationDoc: {
    docName: 'Termination Letter',
    docCode: 'TERM',
    description: 'Create termination documentation for departing employees',
    createButtonLabel: 'Create Letter',
    reasonLabel: 'Termination Reason',
    available: true,
  },
  remittances: {
    title: 'ZRA Remittances',
    description: 'Manage PAYE and statutory remittances to ZRA/NAPSA/NHIMA',
    authority: 'ZRA',
    formCode: 'ITF 16',
    columns: {
      pension: 'NAPSA',
      socialInsurance: 'NHIMA',
      tax: 'PAYE',
    },
    generateDescription: 'Generate a ZRA remittance summary from paid payrolls for a specific month.',
  },
  currencyCode: 'ZMW',
  currencyLocale: 'en-ZM',
  sidebarLabels: {
    taxSlips: 'ITF 18 Certificates',
    separationDoc: 'Termination Letters',
    remittances: 'ZRA Remittances',
  },
};

const KENYA_PAYROLL: PayrollLocalization = {
  taxSlips: {
    slipName: 'P9 Tax Deduction Card',
    slipCode: 'P9',
    description: 'Generate annual P9 tax deduction cards for employees',
    boxLabels: {
      income: 'Gross Pay',
      taxDeducted: 'PAYE Deducted',
      pension: 'NSSF Contribution',
      socialInsurance: 'SHIF Contribution',
    },
    generateButtonLabel: 'Generate P9 Cards',
    emptyStateMessage: 'No P9 cards found for {year}. Generate cards to get started.',
    authority: 'KRA',
  },
  separationDoc: {
    docName: 'Certificate of Service',
    docCode: 'COS',
    description: 'Create certificates of service for departing employees',
    createButtonLabel: 'Create Certificate',
    reasonLabel: 'Reason for Leaving',
    available: true,
  },
  remittances: {
    title: 'KRA Remittances',
    description: 'Manage PAYE and statutory remittances to KRA/NSSF/SHIF',
    authority: 'KRA',
    formCode: 'P10',
    columns: {
      pension: 'NSSF',
      socialInsurance: 'SHIF/AHL',
      tax: 'PAYE',
    },
    generateDescription: 'Generate a KRA remittance summary from paid payrolls for a specific month.',
  },
  currencyCode: 'KES',
  currencyLocale: 'en-KE',
  sidebarLabels: {
    taxSlips: 'P9 Tax Cards',
    separationDoc: 'Service Certificates',
    remittances: 'KRA Remittances',
  },
};

const BURUNDI_PAYROLL: PayrollLocalization = {
  taxSlips: {
    slipName: 'Déclaration IPR',
    slipCode: 'IPR',
    description: 'Générer les certificats annuels IPR pour les employés',
    boxLabels: {
      income: 'Salaire Brut',
      taxDeducted: 'IPR Retenu',
      pension: 'INSS Pension',
      socialInsurance: 'MFP Cotisation',
    },
    generateButtonLabel: 'Générer Déclarations',
    emptyStateMessage: 'Aucune déclaration IPR trouvée pour {year}. Générez les déclarations pour commencer.',
    authority: 'OBR',
  },
  separationDoc: {
    docName: 'Attestation de Travail',
    docCode: 'ATT',
    description: 'Créer des attestations de travail pour les employés partants',
    createButtonLabel: 'Créer Attestation',
    reasonLabel: 'Motif de Départ',
    available: true,
  },
  remittances: {
    title: 'Déclarations OBR',
    description: 'Gérer les versements IPR et cotisations sociales à l\'OBR/INSS/MFP',
    authority: 'OBR',
    formCode: 'Déclaration IPR',
    columns: {
      pension: 'INSS',
      socialInsurance: 'MFP',
      tax: 'IPR',
    },
    generateDescription: 'Générer un résumé des versements OBR à partir des paies du mois.',
  },
  currencyCode: 'BIF',
  currencyLocale: 'fr-BI',
  sidebarLabels: {
    taxSlips: 'Déclarations IPR',
    separationDoc: 'Attestations',
    remittances: 'Déclarations OBR',
  },
};

// ---------------------------------------------------------------------------
// Nigeria: monthly tax, payroll and statutory compliance (2026)
// Sources: Nigeria Tax Act 2025 and Nigeria Tax Administration Act 2025 (in force 1 Jan 2026);
// Joint Revenue Board 2026 PAYE guidelines; Pension Reform Act 2014 s.11; National Housing
// Fund Act s.9 (as amended by the Business Facilitation (Misc. Provisions) Act 2022);
// Employees' Compensation Act 2010 s.33; Industrial Training Fund Act (as amended 2011, 2022).
// Deadlines are reference points; confirm state-level rules with the relevant State IRS.
// ---------------------------------------------------------------------------
export const NIGERIA_COMPLIANCE_CALENDAR: ComplianceDeadline[] = [
  { id: 'pension', activity: 'Pension contributions (employee 8% + employer 10%) to the PFC named by each PFA', authority: 'Pension Fund Administrators / Custodians (PenCom)', rule: { kind: 'working_days_after_salary', days: 7 }, legalBasis: 'Pension Reform Act 2014, s.11(5)', note: 'PFAs report employers to PenCom when funds are not received within 14 days of salary payment.' },
  { id: 'paye', activity: 'PAYE remittance and monthly PAYE schedule', authority: 'State Internal Revenue Service (state of residence)', rule: { kind: 'day_of_following_month', day: 10 }, legalBasis: 'Nigeria Tax Administration Act 2025; JRB 2026 PAYE guidelines', note: 'Monthly PAYE returns are filed electronically.', confirmWithAuthority: true },
  { id: 'vat', activity: 'VAT return and payment', authority: 'Nigeria Revenue Service (NRS)', rule: { kind: 'day_of_following_month', day: 21 }, legalBasis: 'Nigeria Tax Administration Act 2025 (returns for VAT)' },
  { id: 'wht_federal', activity: 'Withholding tax remittance and schedule (federal)', authority: 'Nigeria Revenue Service (NRS)', rule: { kind: 'day_of_following_month', day: 21 }, legalBasis: 'Nigeria Tax Administration Act 2025' },
  { id: 'wht_state', activity: 'Withholding tax remittance (state)', authority: 'State Internal Revenue Service', rule: { kind: 'day_of_following_month', day: 30 }, legalBasis: 'State IRS rules under the Nigeria Tax Administration Act 2025', note: 'State deadlines differ; 30th shown where the State IRS applies it.', confirmWithAuthority: true },
  { id: 'nhf', activity: 'NHF contributions (2.5% of basic) for opted-in employees', authority: 'Federal Mortgage Bank of Nigeria (FMBN)', rule: { kind: 'within_one_month_of_deduction' }, legalBasis: 'National Housing Fund Act, s.9; Business Facilitation Act 2022 (voluntary for private sector)' },
  { id: 'nsitf', activity: "Employees' Compensation contribution (employer 1% of total monthly payroll)", authority: 'Nigeria Social Insurance Trust Fund (NSITF)', rule: { kind: 'scheme_specific' }, legalBasis: "Employees' Compensation Act 2010, s.33", note: 'Monthly; confirm the due date on the NSITF employer portal.', confirmWithAuthority: true },
  { id: 'nhia', activity: 'Health insurance contributions', authority: 'National Health Insurance Authority / HMO scheme', rule: { kind: 'scheme_specific' }, legalBasis: 'National Health Insurance Authority Act 2022', note: 'Where the employer participates; rates and dates follow the scheme.', confirmWithAuthority: true },
  { id: 'month_end', activity: 'Payroll reconciliation, tax reconciliation and statutory liabilities review', authority: 'Internal (Finance)', rule: { kind: 'month_end' }, legalBasis: 'Internal control' },
  { id: 'itf_annual', activity: 'ITF contribution: 1% of the previous year’s total payroll', authority: 'Industrial Training Fund (ITF)', rule: { kind: 'annual', month: 4, day: 1 }, legalBasis: 'Industrial Training Fund Act s.6 (as amended by the Business Facilitation Act 2022)', note: 'Applies to employers with 25 or more employees (free-trade-zone entities excluded).' },
  { id: 'paye_annual', activity: 'Annual employer PAYE return (previous year)', authority: 'State Internal Revenue Service', rule: { kind: 'annual', month: 1, day: 31 }, legalBasis: 'Nigeria Tax Administration Act 2025' },
];

export const NIGERIA_STATUTORY_REPORTS: StatutoryReportDef[] = [
  // 1. Monthly statutory tax reports
  { id: 'vat_return', name: 'VAT Return', category: 'tax', contents: ['Output VAT', 'Input VAT', 'VAT collected', 'Allowable input VAT', 'Net VAT payable'], recipient: 'Nigeria Revenue Service (NRS)', frequency: 'monthly', deadlineId: 'vat', statutory: true, legalBasis: 'NTAA 2025' },
  { id: 'wht_schedule', name: 'Withholding Tax (WHT) Schedule', category: 'tax', contents: ['Supplier name', 'Supplier TIN', 'Invoice amount', 'Payment type', 'WHT rate', 'Tax deducted'], recipient: 'NRS or State IRS', frequency: 'monthly', deadlineId: 'wht_federal', statutory: true, legalBasis: 'NTAA 2025' },
  { id: 'paye_schedule', name: 'PAYE Schedule', category: 'tax', contents: ['Employee', 'TIN', 'Gross salary', 'Taxable earnings', 'Reliefs', 'PAYE deducted', 'Net salary'], recipient: 'State IRS', frequency: 'monthly', deadlineId: 'paye', statutory: true, legalBasis: 'NTA 2025; NTAA 2025' },
  { id: 'wht_supplier_recon', name: 'WHT Supplier Reconciliation', category: 'tax', contents: ['WHT deducted', 'WHT remitted', 'Outstanding', 'Tax credit notes issued'], recipient: 'NRS / State IRS', frequency: 'monthly', statutory: false },
  { id: 'vat_recon', name: 'VAT Reconciliation', category: 'tax', contents: ['Sales ledger', 'Purchase ledger', 'VAT invoices', 'Output VAT', 'Input VAT', 'VAT payable'], recipient: 'NRS (supports the VAT return)', frequency: 'monthly', deadlineId: 'vat', statutory: false },
  // 2. Monthly payroll and employee statutory reports
  { id: 'payroll_register', name: 'Payroll Register', category: 'payroll', contents: ['Employee', 'Earnings', 'Allowances', 'Deductions', 'Net pay', 'Employer contributions'], recipient: 'Internal management', frequency: 'monthly', statutory: false },
  { id: 'paye_deduction_schedule', name: 'PAYE Deduction Schedule', category: 'payroll', contents: ['Employee', 'TIN', 'State of residence', 'Gross pay', 'Pension relief', 'NHF relief', 'Taxable pay', 'PAYE'], recipient: 'State IRS (grouped by state of residence)', frequency: 'monthly', deadlineId: 'paye', statutory: true, legalBasis: 'NTA 2025' },
  { id: 'pension_schedule', name: 'Pension Contribution Schedule', category: 'payroll', contents: ['Employee', 'RSA PIN', 'PFA', 'Pensionable pay', 'Employee 8%', 'Employer 10%', 'Total'], recipient: 'Pension Fund Administrators / Custodians', frequency: 'each_payroll', deadlineId: 'pension', statutory: true, legalBasis: 'PRA 2014 s.4, s.11' },
  { id: 'nhf_schedule', name: 'NHF Contribution Schedule', category: 'payroll', contents: ['Employee', 'NHF number', 'Basic pay', 'NHF 2.5%'], recipient: 'Federal Mortgage Bank of Nigeria (FMBN)', frequency: 'where_applicable', deadlineId: 'nhf', statutory: true, legalBasis: 'NHF Act s.9', applicability: 'Opted-in employees only (voluntary for the private sector since 2022).' },
  { id: 'nsitf_schedule', name: 'NSITF Contribution Schedule', category: 'payroll', contents: ['Employee', 'Total emoluments', 'Employer 1%'], recipient: 'Nigeria Social Insurance Trust Fund (NSITF)', frequency: 'monthly', deadlineId: 'nsitf', statutory: true, legalBasis: 'ECA 2010 s.33' },
  { id: 'nhia_schedule', name: 'NHIA / Health Insurance Schedule', category: 'payroll', contents: ['Employee', 'Scheme / HMO', 'Employee contribution', 'Employer contribution'], recipient: 'NHIA / health insurance scheme', frequency: 'where_applicable', deadlineId: 'nhia', statutory: true, legalBasis: 'NHIA Act 2022', applicability: 'Where the employer participates in a scheme.' },
  { id: 'payroll_journal', name: 'Payroll Journal', category: 'payroll', contents: ['Salary expense', 'Employer pension and NSITF expense', 'PAYE payable', 'Pension payable', 'NHF payable', 'NSITF payable', 'Net salaries payable'], recipient: 'Accounting / Finance', frequency: 'monthly', statutory: false },
  { id: 'payroll_bank_recon', name: 'Payroll Bank Reconciliation', category: 'payroll', contents: ['Net salaries payable', 'Bank payments', 'Difference'], recipient: 'Internal management', frequency: 'monthly', statutory: false },
  // 4. Monthly statutory remittance control reports (filing and paying are tracked separately)
  { id: 'paye_remittance', name: 'PAYE Remittance Report', category: 'remittance_control', contents: ['PAYE payable', 'Amount paid', 'Payment date', 'Receipt'], recipient: 'Internal control', frequency: 'monthly', deadlineId: 'paye', statutory: false },
  { id: 'vat_remittance', name: 'VAT Remittance Report', category: 'remittance_control', contents: ['VAT payable', 'Amount paid', 'Filing confirmation'], recipient: 'Internal control', frequency: 'monthly', deadlineId: 'vat', statutory: false },
  { id: 'wht_remittance', name: 'WHT Remittance Report', category: 'remittance_control', contents: ['WHT deducted', 'Amount remitted', 'Outstanding'], recipient: 'Internal control', frequency: 'monthly', deadlineId: 'wht_federal', statutory: false },
  { id: 'pension_remittance', name: 'Pension Remittance Report', category: 'remittance_control', contents: ['Contributions due', 'Contributions paid', 'PFA confirmation'], recipient: 'Internal control', frequency: 'monthly', deadlineId: 'pension', statutory: false },
  { id: 'nhf_remittance', name: 'NHF Remittance Report', category: 'remittance_control', contents: ['Deductions', 'Payment confirmation'], recipient: 'Internal control', frequency: 'where_applicable', deadlineId: 'nhf', statutory: false },
  { id: 'nsitf_remittance', name: 'NSITF Remittance Report', category: 'remittance_control', contents: ['Employer contribution', 'Payment status'], recipient: 'Internal control', frequency: 'monthly', deadlineId: 'nsitf', statutory: false },
  { id: 'statutory_liabilities', name: 'Statutory Liabilities Report', category: 'remittance_control', contents: ['Obligation', 'Amount due', 'Paid', 'Outstanding', 'Due date', 'Status'], recipient: 'Internal control', frequency: 'monthly', deadlineId: 'month_end', statutory: false },
  { id: 'tax_payment_confirmation', name: 'Tax Payment Confirmation Report', category: 'remittance_control', contents: ['Payment reference', 'Receipt', 'Authority acknowledgement'], recipient: 'Internal control', frequency: 'monthly', statutory: false },
];

const NIGERIA_PAYROLL: PayrollLocalization = {
  taxSlips: {
    slipName: 'PAYE Tax Deduction Certificate',
    slipCode: 'PAYE-Cert',
    description: 'Generate annual PAYE certificates for employees (Year of Assessment)',
    boxLabels: {
      income: 'Gross Emoluments',
      taxDeducted: 'PAYE Deducted',
      pension: 'Pension (8%)',
      socialInsurance: 'NHF (2.5%)',
    },
    generateButtonLabel: 'Generate PAYE Certificates',
    emptyStateMessage: 'No PAYE certificates found for {year}. Generate certificates to get started.',
    authority: 'NRS / State IRS',
  },
  separationDoc: {
    docName: 'Disengagement Letter',
    docCode: 'TERM',
    description: 'Create disengagement/termination letters for departing employees',
    createButtonLabel: 'Create Letter',
    reasonLabel: 'Reason for Disengagement',
    available: true,
  },
  remittances: {
    title: 'PAYE & Statutory Remittances',
    description: 'Monthly PAYE (by the 10th), pension (within 7 working days of salary payment), NHF (within one month, where opted in) and NSITF remittances',
    authority: 'State IRS · PFA/PFC (PenCom) · FMBN · NSITF',
    formCode: 'PAYE Schedule',
    columns: {
      pension: 'Pension (8%+10%)',
      socialInsurance: 'NHF / NSITF',
      tax: 'PAYE',
    },
    generateDescription: 'Generate a monthly PAYE + statutory remittance schedule from paid pay runs.',
  },
  statutoryReports: NIGERIA_STATUTORY_REPORTS,
  complianceCalendar: NIGERIA_COMPLIANCE_CALENDAR,
  currencyCode: 'NGN',
  currencyLocale: 'en-NG',
  sidebarLabels: {
    taxSlips: 'PAYE Certificates',
    separationDoc: 'Disengagement Letters',
    remittances: 'PAYE Remittances',
  },
};

export const PAYROLL_LOCALIZATIONS: Record<string, PayrollLocalization> = {
  CA: CANADA_PAYROLL,
  US: US_PAYROLL,
  ZM: ZAMBIA_PAYROLL,
  KE: KENYA_PAYROLL,
  BI: BURUNDI_PAYROLL,
  NG: NIGERIA_PAYROLL,
};

export function getPayrollLocalization(countryCode: string): PayrollLocalization {
  return PAYROLL_LOCALIZATIONS[countryCode] || CANADA_PAYROLL;
}
