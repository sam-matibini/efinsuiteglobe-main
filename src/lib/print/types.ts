/**
 * Print & PDF Framework Type Definitions
 * Multi-country, multi-organization, audit-safe
 */

// Document types supported by the print framework
export type PrintDocumentType =
  | 'balance_sheet' | 'income_statement' | 'cash_flow' | 'trial_balance' | 'statement_equity'
  | 'general_ledger' | 'sub_ledger' | 'detailed_ledger'
  | 'invoice' | 'credit_note' | 'receipt' | 'payment' | 'bill'
  | 'bank_reconciliation' | 'credit_card_reconciliation'
  | 'pay_stub' | 'pay_summary' | 't4' | 'w2' | 'roe' | 'tax_filing'
  | 'gst_hst_return' | 'vat_return' | 'paye_return'
  | 'audit_report' | 'compilation_report' | 'signed_document'
  | 'custom';

export type PaperSize = 'letter' | 'a4' | 'legal' | 'a3';
export type Orientation = 'portrait' | 'landscape';
export type WatermarkType = 'draft' | 'final' | 'confidential' | 'none';
export type PrintOutputType = 'browser_print' | 'pdf_download' | 'pdf_storage' | 'preview';

// Paper dimensions in mm
export const PAPER_DIMENSIONS: Record<PaperSize, { width: number; height: number }> = {
  letter: { width: 215.9, height: 279.4 },
  a4: { width: 210, height: 297 },
  legal: { width: 215.9, height: 355.6 },
  a3: { width: 297, height: 420 },
};

// Margins configuration
export interface PrintMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// Number format configuration
export interface NumberFormatConfig {
  decimal: string;
  thousand: string;
  precision: number;
}

// Localization settings for print
export interface PrintLocalization {
  language: string;
  dateFormat: string;
  numberFormat: NumberFormatConfig;
  currency: string;
  paperSize: PaperSize;
  textDirection: 'ltr' | 'rtl';
}

// Organization branding for print
export interface PrintBranding {
  logoUrl?: string;
  logoWidth: number;
  logoPosition: 'left' | 'center' | 'right';
  organizationName: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  showAddress: boolean;
  showContact: boolean;
  showWebsite: boolean;
  showPageNumbers: boolean;
  pageNumberFormat: string;
  footerText?: string;
  authorizedSignatureUrl?: string;
  signatureName?: string;
  signatureTitle?: string;
}

// Watermark configuration
export interface WatermarkConfig {
  type: WatermarkType;
  text?: string;
  opacity: number;
}

// Regulatory compliance fields
export interface RegulatoryCompliance {
  legalDisclosures: string[];
  requiredFootnotes: string[];
  registrationFields: { label: string; value: string }[];
  taxId?: string;
  registrationNumber?: string;
}

// Template definition
export interface PrintTemplate {
  id: string;
  code: string;
  name: string;
  documentType: PrintDocumentType;
  parentTemplateId?: string;
  countryId?: string;
  organizationId?: string;
  headerTemplate: Record<string, unknown>;
  bodyTemplate: Record<string, unknown>;
  footerTemplate: Record<string, unknown>;
  styles: Record<string, unknown>;
  paperSize: PaperSize;
  orientation: Orientation;
  margins: PrintMargins;
  defaultLanguage: string;
  dateFormat: string;
  numberFormat: NumberFormatConfig;
  legalDisclosures: string[];
  requiredFootnotes: string[];
  registrationFields: { label: string; value: string }[];
  version: number;
  effectiveDate: string;
  status: 'draft' | 'active' | 'archived';
}

// Print options selected by user
export interface PrintOptions {
  paperSize: PaperSize;
  orientation: Orientation;
  language: string;
  currency: string;
  watermark: WatermarkType;
  includeNotes: boolean;
  includeAttachments: boolean;
  isDraft: boolean;
  outputType: PrintOutputType;
}

// Print job configuration
export interface PrintJobConfig {
  documentType: PrintDocumentType;
  documentTitle: string;
  documentReference?: string;
  sourceRecordId?: string;
  sourceRecordType?: string;
  reportingPeriodStart?: string;
  reportingPeriodEnd?: string;
  fiscalYear?: number;
  organizationId: string;
  countryId?: string;
  template?: PrintTemplate;
  branding: PrintBranding;
  localization: PrintLocalization;
  compliance?: RegulatoryCompliance;
  options: PrintOptions;
  data: Record<string, unknown>;
}

// Print audit log entry
export interface PrintAuditEntry {
  actionType: 'print' | 'pdf_generate' | 'pdf_download' | 'preview';
  documentType: PrintDocumentType;
  documentTitle?: string;
  documentReference?: string;
  sourceRecordId?: string;
  sourceRecordType?: string;
  templateId?: string;
  templateVersion?: number;
  outputType: PrintOutputType;
  paperSize: PaperSize;
  orientation?: Orientation;
  pageCount?: number;
  language?: string;
  currency?: string;
  countryId?: string;
  metadata?: Record<string, unknown>;
}

// Generated document archive entry
export interface PrintDocumentArchive {
  id: string;
  organizationId: string;
  documentType: PrintDocumentType;
  documentTitle: string;
  documentReference?: string;
  sourceRecordId?: string;
  sourceRecordType?: string;
  reportingPeriodStart?: string;
  reportingPeriodEnd?: string;
  fiscalYear?: number;
  countryId?: string;
  templateId?: string;
  templateVersion?: number;
  storagePath?: string;
  fileSizeBytes?: number;
  checksum?: string;
  language: string;
  currency: string;
  isDraft: boolean;
  isConfidential: boolean;
  isFinal: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
  generatedAt: string;
  generatedBy?: string;
  expiresAt?: string;
}

// Default print options
export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  paperSize: 'letter',
  orientation: 'portrait',
  language: 'en',
  currency: 'CAD',
  watermark: 'none',
  includeNotes: true,
  includeAttachments: false,
  isDraft: false,
  outputType: 'pdf_download',
};

// Default margins
export const DEFAULT_MARGINS: PrintMargins = {
  top: 20,
  right: 20,
  bottom: 30,
  left: 20,
};

// Document type display names
export const DOCUMENT_TYPE_LABELS: Record<PrintDocumentType, string> = {
  balance_sheet: 'Balance Sheet',
  income_statement: 'Income Statement',
  cash_flow: 'Cash Flow Statement',
  trial_balance: 'Trial Balance',
  statement_equity: 'Statement of Changes in Equity',
  general_ledger: 'General Ledger',
  sub_ledger: 'Sub-Ledger',
  detailed_ledger: 'Detailed Ledger',
  invoice: 'Invoice',
  credit_note: 'Credit Note',
  receipt: 'Receipt',
  payment: 'Payment',
  bill: 'Bill',
  bank_reconciliation: 'Bank Reconciliation',
  credit_card_reconciliation: 'Credit Card Reconciliation',
  pay_stub: 'Pay Stub',
  pay_summary: 'Payroll Summary',
  t4: 'T4 Slip',
  w2: 'W-2 Form',
  roe: 'Record of Employment',
  tax_filing: 'Tax Filing',
  gst_hst_return: 'GST/HST Return',
  vat_return: 'VAT Return',
  paye_return: 'PAYE Return',
  audit_report: 'Audit Report',
  compilation_report: 'Compilation Report',
  signed_document: 'Signed Document',
  custom: 'Custom Document',
};
