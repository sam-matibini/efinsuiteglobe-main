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

export interface PayrollLocalization {
  taxSlips: TaxSlipConfig;
  separationDoc: SeparationDocConfig;
  remittances: RemittanceConfig;
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

export const PAYROLL_LOCALIZATIONS: Record<string, PayrollLocalization> = {
  CA: CANADA_PAYROLL,
  US: US_PAYROLL,
  ZM: ZAMBIA_PAYROLL,
  KE: KENYA_PAYROLL,
  BI: BURUNDI_PAYROLL,
};

export function getPayrollLocalization(countryCode: string): PayrollLocalization {
  return PAYROLL_LOCALIZATIONS[countryCode] || CANADA_PAYROLL;
}
