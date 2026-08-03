// Per-country PDF field mapping for annual tax slips, periodic remittances,
// separation documents, and pay stubs. Drives the "generic" (non-Canadian)
// PDF renderers so all supported countries produce compliant, correctly-
// labelled statutory documents.

export interface SlipFieldSpec {
  code: string;   // Optional box / row code (e.g. "Box 1", "R1")
  label: string;  // Human label rendered on the PDF
  source:         // Which field on the source record to pull
    | 'gross'
    | 'incomeTax'
    | 'pension'
    | 'socialInsurance'
    | 'insurableEarnings'
    | 'pensionableEarnings'
    | 'ytdGross'
    | 'ytdIncomeTax'
    | 'ytdPension'
    | 'ytdSocialInsurance'
    | 'other';
}

export interface SlipConfig {
  formTitle: string;         // Full title on the PDF header
  formCode: string;          // Short code (T4 / W-2 / ITF18 / P9 / IPR / P60)
  taxIdLabel: string;        // "Business Number", "EIN", "TIN", "TPIN", "PIN"
  authorityLine: string;     // Line under title (e.g. "Kenya Revenue Authority")
  filenamePrefix: string;
  fields: SlipFieldSpec[];   // Ordered boxes to render
}

export interface RemittanceRowSpec {
  label: string;
  source:
    | 'incomeTax'          // = federal + provincial
    | 'federalTax'
    | 'provincialTax'
    | 'pensionEmployee'
    | 'pensionEmployer'
    | 'pensionTotal'
    | 'socialInsuranceEmployee'
    | 'socialInsuranceEmployer'
    | 'socialInsuranceTotal';
}

export interface RemittanceConfigLocal {
  formTitle: string;
  formCode: string;
  authorityName: string;
  taxIdLabel: string;
  rows: RemittanceRowSpec[];
  detailColumns: Array<{ label: string; source: RemittanceRowSpec['source'] | 'gross' | 'name' }>;
}

export interface SeparationDocConfigLocal {
  docTitle: string;
  docCode: string;
  authorityLine?: string;
  reasonLabel: string;
  sections: {
    hoursBlock: boolean;      // Insurable hours (CA-specific concept)
    earningsBlock: boolean;
    signatureBlock: boolean;
  };
}

export interface PayStubLabels {
  title: string;              // "PAY STATEMENT" translated
  pensionLabel: string;       // "CPP" / "Social Security" / "NAPSA" / "NSSF" / "Pension" / "INSS"
  socialInsuranceLabel: string; // "EI" / "Medicare" / "NHIMA" / "SHIF" / "NHF" / "MFP"
  federalTaxLabel: string;    // "Federal Tax" / "PAYE" / "IPR"
  provincialTaxLabel?: string; // undefined => don't render (only CA/US-federal have this)
  regionLabel: string;        // "Province" / "State" / ""
}

export interface CountryPayrollPdfConfig {
  slip: SlipConfig;
  remittance: RemittanceConfigLocal;
  separation: SeparationDocConfigLocal;
  payStub: PayStubLabels;
}

// --------------------------------------------------------------------------
// Per-country configuration
// --------------------------------------------------------------------------

const CA: CountryPayrollPdfConfig = {
  slip: {
    formTitle: 'T4 Statement of Remuneration Paid',
    formCode: 'T4',
    taxIdLabel: 'Business Number',
    authorityLine: 'Canada Revenue Agency',
    filenamePrefix: 'T4',
    fields: [
      { code: 'Box 14', label: 'Employment income', source: 'gross' },
      { code: 'Box 22', label: 'Income tax deducted', source: 'incomeTax' },
      { code: 'Box 16', label: "Employee's CPP contributions", source: 'pension' },
      { code: 'Box 18', label: "Employee's EI premiums", source: 'socialInsurance' },
      { code: 'Box 24', label: 'EI insurable earnings', source: 'insurableEarnings' },
      { code: 'Box 26', label: 'CPP pensionable earnings', source: 'pensionableEarnings' },
    ],
  },
  remittance: {
    formTitle: 'Source Deductions Remittance',
    formCode: 'PD7A',
    authorityName: 'Canada Revenue Agency (CRA)',
    taxIdLabel: 'Payroll Account #',
    rows: [
      { label: 'Income tax (Federal + Provincial)', source: 'incomeTax' },
      { label: 'CPP — employee', source: 'pensionEmployee' },
      { label: 'CPP — employer', source: 'pensionEmployer' },
      { label: 'EI — employee', source: 'socialInsuranceEmployee' },
      { label: 'EI — employer (1.4×)', source: 'socialInsuranceEmployer' },
    ],
    detailColumns: [
      { label: 'Employee', source: 'name' },
      { label: 'Gross', source: 'gross' },
      { label: 'Fed', source: 'federalTax' },
      { label: 'Prov', source: 'provincialTax' },
      { label: 'CPP-EE', source: 'pensionEmployee' },
      { label: 'CPP-ER', source: 'pensionEmployer' },
      { label: 'EI-EE', source: 'socialInsuranceEmployee' },
      { label: 'EI-ER', source: 'socialInsuranceEmployer' },
    ],
  },
  separation: {
    docTitle: 'Record of Employment',
    docCode: 'ROE',
    authorityLine: 'Service Canada — Employment Insurance',
    reasonLabel: 'Reason for issuing this ROE',
    sections: { hoursBlock: true, earningsBlock: true, signatureBlock: true },
  },
  payStub: {
    title: 'EMPLOYEE PAY STUB',
    pensionLabel: 'CPP Contribution',
    socialInsuranceLabel: 'EI Premium',
    federalTaxLabel: 'Federal Tax',
    provincialTaxLabel: 'Provincial Tax',
    regionLabel: 'Province',
  },
};

const US: CountryPayrollPdfConfig = {
  slip: {
    formTitle: 'W-2 Wage and Tax Statement',
    formCode: 'W-2',
    taxIdLabel: 'Employer EIN',
    authorityLine: 'Internal Revenue Service (IRS)',
    filenamePrefix: 'W2',
    fields: [
      { code: 'Box 1', label: 'Wages, tips, other compensation', source: 'gross' },
      { code: 'Box 2', label: 'Federal income tax withheld', source: 'incomeTax' },
      { code: 'Box 3', label: 'Social Security wages', source: 'pensionableEarnings' },
      { code: 'Box 4', label: 'Social Security tax withheld', source: 'pension' },
      { code: 'Box 5', label: 'Medicare wages and tips', source: 'insurableEarnings' },
      { code: 'Box 6', label: 'Medicare tax withheld', source: 'socialInsurance' },
    ],
  },
  remittance: {
    formTitle: "Employer's Quarterly Federal Tax Return",
    formCode: 'Form 941',
    authorityName: 'Internal Revenue Service (IRS)',
    taxIdLabel: 'EIN',
    rows: [
      { label: 'Federal income tax withheld', source: 'federalTax' },
      { label: 'Social Security tax — employee', source: 'pensionEmployee' },
      { label: 'Social Security tax — employer', source: 'pensionEmployer' },
      { label: 'Medicare tax — employee', source: 'socialInsuranceEmployee' },
      { label: 'Medicare tax — employer', source: 'socialInsuranceEmployer' },
    ],
    detailColumns: [
      { label: 'Employee', source: 'name' },
      { label: 'Gross', source: 'gross' },
      { label: 'Fed Tax', source: 'federalTax' },
      { label: 'SS-EE', source: 'pensionEmployee' },
      { label: 'SS-ER', source: 'pensionEmployer' },
      { label: 'Med-EE', source: 'socialInsuranceEmployee' },
      { label: 'Med-ER', source: 'socialInsuranceEmployer' },
    ],
  },
  separation: {
    docTitle: 'Separation Notice',
    docCode: 'SEP',
    reasonLabel: 'Reason for separation',
    sections: { hoursBlock: false, earningsBlock: true, signatureBlock: true },
  },
  payStub: {
    title: 'EMPLOYEE PAY STATEMENT',
    pensionLabel: 'Social Security',
    socialInsuranceLabel: 'Medicare',
    federalTaxLabel: 'Federal Tax',
    provincialTaxLabel: 'State Tax',
    regionLabel: 'State',
  },
};

const NG: CountryPayrollPdfConfig = {
  slip: {
    formTitle: 'Annual PAYE Tax Deduction Certificate',
    formCode: 'PAYE Certificate',
    taxIdLabel: 'Employer TIN',
    authorityLine: 'Nigeria Revenue Service (NRS) / State Internal Revenue Service',
    filenamePrefix: 'PAYE-Cert',
    fields: [
      { code: '1', label: 'Gross emoluments (Year of Assessment)', source: 'gross' },
      { code: '2', label: 'Consolidated Relief Allowance (CRA)', source: 'other' },
      { code: '3', label: 'Pension contribution — 8% (employee)', source: 'pension' },
      { code: '4', label: 'NHF contribution — 2.5%', source: 'socialInsurance' },
      { code: '5', label: 'Taxable income', source: 'pensionableEarnings' },
      { code: '6', label: 'PAYE tax deducted', source: 'incomeTax' },
    ],
  },
  remittance: {
    formTitle: 'Monthly PAYE Schedule + Statutory Contributions',
    formCode: 'PAYE-Sched',
    authorityName: 'State IRS (PAYE) · PenCom · FMBN (NHF) · NSITF · ITF',
    taxIdLabel: 'Employer TIN',
    rows: [
      { label: 'PAYE tax withheld', source: 'incomeTax' },
      { label: 'Pension — employee (8%)', source: 'pensionEmployee' },
      { label: 'Pension — employer (10%)', source: 'pensionEmployer' },
      { label: 'NHF — employee (2.5% of Basic)', source: 'socialInsuranceEmployee' },
      { label: 'NSITF — employer (1% of gross)', source: 'socialInsuranceEmployer' },
      { label: 'ITF — employer (1% of payroll, ≥5 staff)', source: 'pensionTotal' },
    ],
    detailColumns: [
      { label: 'Employee', source: 'name' },
      { label: 'Gross', source: 'gross' },
      { label: 'PAYE', source: 'federalTax' },
      { label: 'Pension-EE', source: 'pensionEmployee' },
      { label: 'Pension-ER', source: 'pensionEmployer' },
      { label: 'NHF-EE', source: 'socialInsuranceEmployee' },
    ],
  },
  separation: {
    docTitle: 'Disengagement / Termination Letter',
    docCode: 'TERM',
    authorityLine: 'Issued pursuant to the Labour Act (Nigeria)',
    reasonLabel: 'Reason for disengagement',
    sections: { hoursBlock: false, earningsBlock: true, signatureBlock: true },
  },
  payStub: {
    title: 'EMPLOYEE PAY SLIP',
    pensionLabel: 'Pension (8%)',
    socialInsuranceLabel: 'NHF (2.5%)',
    federalTaxLabel: 'PAYE',
    regionLabel: 'State',
  },
};

const ZM: CountryPayrollPdfConfig = {
  slip: {
    formTitle: 'ITF 18 — Annual PAYE Certificate',
    formCode: 'ITF 18',
    taxIdLabel: 'Employer TPIN',
    authorityLine: 'Zambia Revenue Authority (ZRA)',
    filenamePrefix: 'ITF18',
    fields: [
      { code: '1', label: 'Gross emoluments', source: 'gross' },
      { code: '2', label: 'PAYE deducted', source: 'incomeTax' },
      { code: '3', label: 'NAPSA contribution', source: 'pension' },
      { code: '4', label: 'NHIMA contribution', source: 'socialInsurance' },
    ],
  },
  remittance: {
    formTitle: 'Monthly PAYE & Statutory Return',
    formCode: 'ITF 16',
    authorityName: 'Zambia Revenue Authority (ZRA)',
    taxIdLabel: 'TPIN',
    rows: [
      { label: 'PAYE tax withheld', source: 'incomeTax' },
      { label: 'NAPSA — employee (5%)', source: 'pensionEmployee' },
      { label: 'NAPSA — employer (5%)', source: 'pensionEmployer' },
      { label: 'NHIMA — employee (1%)', source: 'socialInsuranceEmployee' },
      { label: 'NHIMA — employer (1%)', source: 'socialInsuranceEmployer' },
    ],
    detailColumns: [
      { label: 'Employee', source: 'name' },
      { label: 'Gross', source: 'gross' },
      { label: 'PAYE', source: 'federalTax' },
      { label: 'NAPSA-EE', source: 'pensionEmployee' },
      { label: 'NAPSA-ER', source: 'pensionEmployer' },
      { label: 'NHIMA-EE', source: 'socialInsuranceEmployee' },
      { label: 'NHIMA-ER', source: 'socialInsuranceEmployer' },
    ],
  },
  separation: {
    docTitle: 'Termination Letter',
    docCode: 'TERM',
    reasonLabel: 'Reason for termination',
    sections: { hoursBlock: false, earningsBlock: true, signatureBlock: true },
  },
  payStub: {
    title: 'EMPLOYEE PAY SLIP',
    pensionLabel: 'NAPSA (5%)',
    socialInsuranceLabel: 'NHIMA (1%)',
    federalTaxLabel: 'PAYE',
    regionLabel: 'Province',
  },
};

const KE: CountryPayrollPdfConfig = {
  slip: {
    formTitle: 'P9 — Tax Deduction Card',
    formCode: 'P9',
    taxIdLabel: 'Employer PIN',
    authorityLine: 'Kenya Revenue Authority (KRA)',
    filenamePrefix: 'P9',
    fields: [
      { code: 'A', label: 'Basic salary / gross pay', source: 'gross' },
      { code: 'H', label: 'PAYE tax charged', source: 'incomeTax' },
      { code: 'E', label: 'NSSF contribution', source: 'pension' },
      { code: 'F', label: 'SHIF / AHL', source: 'socialInsurance' },
    ],
  },
  remittance: {
    formTitle: 'Monthly PAYE Return',
    formCode: 'P10',
    authorityName: 'Kenya Revenue Authority (KRA)',
    taxIdLabel: 'PIN',
    rows: [
      { label: 'PAYE tax withheld', source: 'incomeTax' },
      { label: 'NSSF — employee', source: 'pensionEmployee' },
      { label: 'NSSF — employer', source: 'pensionEmployer' },
      { label: 'SHIF / AHL — employee', source: 'socialInsuranceEmployee' },
      { label: 'SHIF / AHL — employer', source: 'socialInsuranceEmployer' },
    ],
    detailColumns: [
      { label: 'Employee', source: 'name' },
      { label: 'Gross', source: 'gross' },
      { label: 'PAYE', source: 'federalTax' },
      { label: 'NSSF-EE', source: 'pensionEmployee' },
      { label: 'NSSF-ER', source: 'pensionEmployer' },
      { label: 'SHIF-EE', source: 'socialInsuranceEmployee' },
    ],
  },
  separation: {
    docTitle: 'Certificate of Service',
    docCode: 'COS',
    reasonLabel: 'Reason for leaving',
    sections: { hoursBlock: false, earningsBlock: true, signatureBlock: true },
  },
  payStub: {
    title: 'EMPLOYEE PAY SLIP',
    pensionLabel: 'NSSF',
    socialInsuranceLabel: 'SHIF / AHL',
    federalTaxLabel: 'PAYE',
    regionLabel: 'County',
  },
};

const GB: CountryPayrollPdfConfig = {
  slip: {
    formTitle: 'P60 — End of Year Certificate',
    formCode: 'P60',
    taxIdLabel: 'PAYE reference',
    authorityLine: 'HM Revenue & Customs (HMRC)',
    filenamePrefix: 'P60',
    fields: [
      { code: '1', label: 'Total pay in this employment', source: 'gross' },
      { code: '2', label: 'Total tax deducted', source: 'incomeTax' },
      { code: '3', label: "Employee's NI contributions", source: 'pension' },
      { code: '4', label: 'Statutory / other deductions', source: 'socialInsurance' },
    ],
  },
  remittance: {
    formTitle: 'Employer Payment Summary (EPS/FPS)',
    formCode: 'P32',
    authorityName: 'HM Revenue & Customs (HMRC)',
    taxIdLabel: 'PAYE reference',
    rows: [
      { label: 'PAYE income tax', source: 'incomeTax' },
      { label: 'NI — employee', source: 'pensionEmployee' },
      { label: 'NI — employer', source: 'pensionEmployer' },
      { label: 'Student loan / other', source: 'socialInsuranceEmployee' },
    ],
    detailColumns: [
      { label: 'Employee', source: 'name' },
      { label: 'Gross', source: 'gross' },
      { label: 'PAYE', source: 'federalTax' },
      { label: 'NI-EE', source: 'pensionEmployee' },
      { label: 'NI-ER', source: 'pensionEmployer' },
    ],
  },
  separation: {
    docTitle: 'P45 — Details of Employee Leaving Work',
    docCode: 'P45',
    reasonLabel: 'Reason for leaving',
    sections: { hoursBlock: false, earningsBlock: true, signatureBlock: true },
  },
  payStub: {
    title: 'EMPLOYEE PAYSLIP',
    pensionLabel: 'NI Contribution',
    socialInsuranceLabel: 'Other Deductions',
    federalTaxLabel: 'PAYE (Income Tax)',
    regionLabel: 'Region',
  },
};

const BI: CountryPayrollPdfConfig = {
  slip: {
    formTitle: "Déclaration Annuelle de l'IPR",
    formCode: 'IPR',
    taxIdLabel: "Numéro d'identification fiscale (NIF)",
    authorityLine: "Office Burundais des Recettes (OBR)",
    filenamePrefix: 'IPR',
    fields: [
      { code: '1', label: 'Salaire brut', source: 'gross' },
      { code: '2', label: 'IPR retenu', source: 'incomeTax' },
      { code: '3', label: 'Cotisation INSS', source: 'pension' },
      { code: '4', label: 'Cotisation MFP', source: 'socialInsurance' },
    ],
  },
  remittance: {
    formTitle: 'Déclaration Mensuelle IPR & Cotisations Sociales',
    formCode: 'OBR-IPR',
    authorityName: 'Office Burundais des Recettes (OBR)',
    taxIdLabel: 'NIF',
    rows: [
      { label: 'IPR retenu', source: 'incomeTax' },
      { label: 'INSS — employé', source: 'pensionEmployee' },
      { label: 'INSS — employeur', source: 'pensionEmployer' },
      { label: 'MFP — employé', source: 'socialInsuranceEmployee' },
      { label: 'MFP — employeur', source: 'socialInsuranceEmployer' },
    ],
    detailColumns: [
      { label: 'Employé', source: 'name' },
      { label: 'Brut', source: 'gross' },
      { label: 'IPR', source: 'federalTax' },
      { label: 'INSS-E', source: 'pensionEmployee' },
      { label: 'INSS-P', source: 'pensionEmployer' },
      { label: 'MFP-E', source: 'socialInsuranceEmployee' },
    ],
  },
  separation: {
    docTitle: 'Attestation de Travail',
    docCode: 'ATT',
    reasonLabel: 'Motif de départ',
    sections: { hoursBlock: false, earningsBlock: true, signatureBlock: true },
  },
  payStub: {
    title: 'BULLETIN DE PAIE',
    pensionLabel: 'INSS',
    socialInsuranceLabel: 'MFP',
    federalTaxLabel: 'IPR',
    regionLabel: 'Province',
  },
};

const REGISTRY: Record<string, CountryPayrollPdfConfig> = {
  CA, US, NG, ZM, KE, GB, BI,
};

export function getPayrollPdfConfig(countryCode: string): CountryPayrollPdfConfig {
  const key = (countryCode || 'CA').toUpperCase();
  return REGISTRY[key] || CA;
}
