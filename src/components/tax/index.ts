/**
 * Tax Module Exports
 * 
 * Centralized exports for tax-related components and utilities
 */

// Components
export { SplitTaxDisplay, InvoiceTaxSummary } from './SplitTaxDisplay';
export { CombinedTaxRateCombobox, TAX_RATE_OPTIONS } from './CombinedTaxRateCombobox';
export type { CombinedTaxRateOption } from './CombinedTaxRateCombobox';

// Re-export calculator types and functions
export {
  calculateSplitTaxes,
  calculateLineTaxes,
  aggregateLineTaxes,
  formatTaxBreakdown,
  getTaxDisplayLabel,
  requiresSeparatePstAccounting,
  getTaxModel,
  PROVINCE_TAX_CONFIG,
} from '@/lib/splitTaxCalculator';

export type {
  TaxModel,
  TaxComponent,
  SplitTaxCalculation,
} from '@/lib/splitTaxCalculator';
