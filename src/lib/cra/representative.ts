/**
 * Firm representative identity for Represent a Client.
 * representativeId here is a stand-in label only. The live identifier is CRA_REPRESENTATIVE_ID
 * on the server and is never replaced by a client CRA password.
 */
export const CRA_REPRESENTATIVE = {
  legalName: 'eFinsuite / eFinTax Advisors Ltd.',
  shortName: 'eFinTax Advisors Ltd.',
  representativeId: 'R7EFS184',
  services: ['Represent a Client', 'EFILE', 'Business consent', 'CRA web services'],
} as const;

export const FUNDING_ACCOUNT = 'eFinsuite CAD Wallet';

export const PROGRAM_LABEL: Record<string, string> = {
  RC: 'Corporate income tax',
  RT: 'GST/HST',
  RP: 'Payroll',
  RZ: 'Information returns',
  OTHER: 'Other CRA program',
};

export const TAX_LABEL: Record<string, string> = {
  gst_hst: 'GST/HST',
  payroll: 'Payroll',
  corporate_tax: 'Corporate income tax',
  information_return: 'Information returns',
};

export const ACCOUNT_FOR_TAX: Record<string, string> = {
  gst_hst: 'RT0001',
  payroll: 'RP0001',
  corporate_tax: 'RC0001',
  information_return: 'RZ0001',
};

export const PROGRAM_FOR_TAX: Record<string, string> = {
  gst_hst: 'RT',
  payroll: 'RP',
  corporate_tax: 'RC',
  information_return: 'RZ',
};
