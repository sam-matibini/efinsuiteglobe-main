/**
 * Print & PDF Framework
 * Central export file for the print module
 */

// Core service
export { PrintService, printService } from './PrintService';

// Types
export * from './types';

// Localization
export {
  getPrintLocalization,
  formatPrintDate,
  formatPrintNumber,
  formatPrintCurrency,
  getFiscalYearLabel,
  getPeriodDescription,
  getLanguageName,
  getAvailableLanguages,
} from './localization';

// Template resolution
export {
  resolveTemplate,
  mergeTemplates,
  getAvailableTemplates,
  saveTemplate,
} from './templateResolver';

// Branding
export {
  loadBrandingProfile,
  saveBrandingProfile,
  loadLogoAsBase64,
  getWatermarkConfig,
} from './brandingLoader';

// Document generators
export {
  generateInvoiceDocument,
  downloadInvoicePdf,
  type InvoiceData,
  type InvoiceLineItem,
  type InvoiceGeneratorConfig,
} from './invoiceGenerator';

// Donation receipt generator
export {
  generateDonationReceiptPdf,
  downloadDonationReceiptPdf,
  printDonationReceipt,
} from './donationReceiptGenerator';

// Storage service
export {
  uploadPdfToStorage,
  getSignedDownloadUrl,
  listOrganizationDocuments,
  deleteDocument,
  downloadDocumentBlob,
  type StoredDocument,
  type UploadResult,
} from './storageService';
