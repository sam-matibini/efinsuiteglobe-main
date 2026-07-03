// Global Tax Calculation Engine for EFINSUITE Globe
// Now integrated with Split Tax Calculator for Canadian provinces
import type { TaxCalculation } from '@/types/global';
import { 
  calculateSplitTaxes, 
  PROVINCE_TAX_CONFIG, 
  type SplitTaxCalculation,
  type TaxModel 
} from './splitTaxCalculator';

interface TaxRule {
  id: string;
  code: string;
  name: string;
  rate: number;
  isRecoverable: boolean;
  isCompound: boolean;
  thresholdMin?: number | null;
  thresholdMax?: number | null;
}

interface TaxCalculationInput {
  grossAmount: number;
  taxRules: TaxRule[];
  isInclusive?: boolean; // Tax included in price
  jurisdictionCode?: string; // For Canadian split tax calculation
  countryCode?: string; // To determine if we use split tax logic
}

/**
 * Calculate taxes for a transaction based on applicable tax rules
 * Now supports Canadian split tax calculation (GST + PST separately)
 */
export function calculateTaxes(input: TaxCalculationInput): TaxCalculation {
  const { grossAmount, taxRules, isInclusive = false, jurisdictionCode, countryCode } = input;
  
  // Use split tax calculation for Canadian provinces
  if (countryCode === 'CA' && jurisdictionCode && PROVINCE_TAX_CONFIG[jurisdictionCode]) {
    const splitCalc = calculateSplitTaxes(grossAmount, jurisdictionCode, isInclusive);
    
    return {
      grossAmount: splitCalc.grossAmount,
      taxableAmount: splitCalc.taxableAmount,
      taxes: splitCalc.taxes.map(t => ({
        taxTypeId: t.code, // Use code as ID for derived taxes
        taxCode: t.code,
        taxName: `${t.type} - ${t.authority}`,
        rate: t.rate,
        amount: t.amount,
        isRecoverable: t.isRecoverable,
      })),
      totalTax: splitCalc.totalTax,
      netAmount: splitCalc.taxableAmount,
    };
  }
  
  // Legacy calculation for non-Canadian or custom tax rules
  let taxableAmount = grossAmount;
  const taxes: TaxCalculation['taxes'] = [];
  
  // Separate compound and non-compound taxes
  const nonCompoundTaxes = taxRules.filter(r => !r.isCompound);
  const compoundTaxes = taxRules.filter(r => r.isCompound);
  
  // If tax-inclusive, we need to back-calculate
  if (isInclusive) {
    // Calculate effective tax rate
    let effectiveRate = 0;
    
    for (const rule of nonCompoundTaxes) {
      effectiveRate += rule.rate / 100;
    }
    
    // For compound taxes, they're calculated on (price + non-compound taxes)
    let compoundMultiplier = 1;
    for (const rule of compoundTaxes) {
      compoundMultiplier *= (1 + rule.rate / 100);
    }
    
    const totalMultiplier = (1 + effectiveRate) * compoundMultiplier;
    taxableAmount = grossAmount / totalMultiplier;
  }
  
  let runningTotal = taxableAmount;
  
  // Calculate non-compound taxes first (parallel calculation)
  for (const rule of nonCompoundTaxes) {
    const amount = roundCurrency(taxableAmount * (rule.rate / 100));
    taxes.push({
      taxTypeId: rule.id,
      taxCode: rule.code,
      taxName: rule.name,
      rate: rule.rate,
      amount,
      isRecoverable: rule.isRecoverable,
    });
    runningTotal += amount;
  }
  
  // Calculate compound taxes (on base + non-compound taxes)
  for (const rule of compoundTaxes) {
    const baseForCompound = taxableAmount + taxes
      .filter(t => !compoundTaxes.some(c => c.id === t.taxTypeId))
      .reduce((sum, t) => sum + t.amount, 0);
    
    const amount = roundCurrency(baseForCompound * (rule.rate / 100));
    taxes.push({
      taxTypeId: rule.id,
      taxCode: rule.code,
      taxName: rule.name,
      rate: rule.rate,
      amount,
      isRecoverable: rule.isRecoverable,
    });
  }
  
  const totalTax = taxes.reduce((sum, t) => sum + t.amount, 0);
  
  return {
    grossAmount: isInclusive ? grossAmount : taxableAmount + totalTax,
    taxableAmount,
    taxes,
    totalTax,
    netAmount: taxableAmount,
  };
}

/**
 * Get applicable tax code based on country and transaction type
 */
export function getApplicableTaxCode(
  countryCode: string,
  jurisdictionCode?: string,
  transactionType: 'sale' | 'purchase' = 'sale'
): string {
  // Canadian tax code logic - now returns tax model info
  if (countryCode === 'CA') {
    if (!jurisdictionCode) return 'GST';
    
    const config = PROVINCE_TAX_CONFIG[jurisdictionCode];
    if (!config) return 'GST';
    
    switch (config.taxModel) {
      case 'HST':
        return 'HST';
      case 'GST_PST':
        return jurisdictionCode === 'QC' ? 'GST+QST' : 'GST+PST';
      default:
        return 'GST';
    }
  }
  
  // US - varies by state
  if (countryCode === 'US') {
    const noSalesTaxStates = ['DE', 'MT', 'NH', 'OR', 'AK'];
    if (jurisdictionCode && noSalesTaxStates.includes(jurisdictionCode)) {
      return 'EXEMPT';
    }
    return 'STATE-SALES';
  }
  
  // African countries use VAT
  if (['ZM', 'KE', 'BI'].includes(countryCode)) {
    return 'VAT-STD';
  }
  
  return 'EXEMPT';
}

/**
 * Round to 2 decimal places using banker's rounding
 */
function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate combined tax rate for display
 */
export function getCombinedTaxRate(taxRules: TaxRule[]): number {
  let combinedRate = 0;
  
  const nonCompound = taxRules.filter(r => !r.isCompound);
  const compound = taxRules.filter(r => r.isCompound);
  
  // Sum non-compound rates
  for (const rule of nonCompound) {
    combinedRate += rule.rate;
  }
  
  // Compound taxes add multiplicatively
  for (const rule of compound) {
    combinedRate = (1 + combinedRate / 100) * (1 + rule.rate / 100) * 100 - 100;
  }
  
  return Math.round(combinedRate * 100) / 100;
}

/**
 * Format tax breakdown for display
 * @param calculation Tax calculation result
 * @param showCombined Whether to show combined rate (for GST+PST provinces)
 */
export function formatTaxBreakdown(calculation: TaxCalculation, showCombined: boolean = false): string {
  if (calculation.taxes.length === 0) return 'No tax';
  
  if (calculation.taxes.length === 1) {
    const tax = calculation.taxes[0];
    return `${tax.taxCode} ${tax.rate}%`;
  }
  
  if (showCombined) {
    const totalRate = calculation.taxes.reduce((sum, t) => sum + t.rate, 0);
    return `Combined ${totalRate}%`;
  }
  
  return calculation.taxes.map(t => `${t.taxCode} ${t.rate}%`).join(' + ');
}

/**
 * Get Canadian tax model for a jurisdiction
 */
export function getCanadianTaxModel(jurisdictionCode: string): TaxModel {
  return PROVINCE_TAX_CONFIG[jurisdictionCode]?.taxModel || 'GST_ONLY';
}

/**
 * Check if a Canadian jurisdiction requires separate PST accounting
 */
export function requiresSeparatePstAccounting(jurisdictionCode: string): boolean {
  const config = PROVINCE_TAX_CONFIG[jurisdictionCode];
  return config?.taxModel === 'GST_PST';
}
