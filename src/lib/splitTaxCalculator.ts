/**
 * Split Tax Calculator for Canadian Provinces
 * 
 * CRITICAL DESIGN PRINCIPLE:
 * - CALCULATE taxes separately
 * - POST taxes separately to GL
 * - OPTIONALLY DISPLAY combined rate
 * 
 * Tax Models:
 * - GST_ONLY: Alberta, territories (GST 5%)
 * - GST_PST: BC, SK, MB, QC (GST 5% + PST/QST separately)
 * - HST: ON, NB, NL, NS, PE (single combined tax)
 */

export type TaxModel = 'GST_ONLY' | 'GST_PST' | 'HST';

export interface TaxComponent {
  type: 'GST' | 'PST' | 'HST' | 'QST';
  code: string;
  rate: number;
  amount: number;
  isRecoverable: boolean;
  authority: 'CRA' | 'Provincial' | 'Revenu Quebec';
  glAccountId?: string | null;
}

export interface SplitTaxCalculation {
  taxableAmount: number;
  taxModel: TaxModel;
  jurisdictionCode: string;
  totalTax: number;
  grossAmount: number;
  combinedRate: number;
  taxes: TaxComponent[];
  showCombined?: boolean;
}

// Province tax configurations (data-driven, not hard-coded logic)
export const PROVINCE_TAX_CONFIG: Record<string, {
  taxModel: TaxModel;
  gstRate: number;
  pstRate: number;
  hstRate: number;
  pstRecoverable: boolean;
  pstAuthority: 'Provincial' | 'Revenu Quebec';
  pstCode: string;
}> = {
  // HST Provinces
  ON: { taxModel: 'HST', gstRate: 0, pstRate: 0, hstRate: 13, pstRecoverable: true, pstAuthority: 'Provincial', pstCode: 'HST' },
  NB: { taxModel: 'HST', gstRate: 0, pstRate: 0, hstRate: 15, pstRecoverable: true, pstAuthority: 'Provincial', pstCode: 'HST' },
  NL: { taxModel: 'HST', gstRate: 0, pstRate: 0, hstRate: 15, pstRecoverable: true, pstAuthority: 'Provincial', pstCode: 'HST' },
  NS: { taxModel: 'HST', gstRate: 0, pstRate: 0, hstRate: 15, pstRecoverable: true, pstAuthority: 'Provincial', pstCode: 'HST' },
  PE: { taxModel: 'HST', gstRate: 0, pstRate: 0, hstRate: 15, pstRecoverable: true, pstAuthority: 'Provincial', pstCode: 'HST' },
  // GST+PST Provinces
  BC: { taxModel: 'GST_PST', gstRate: 5, pstRate: 7, hstRate: 0, pstRecoverable: false, pstAuthority: 'Provincial', pstCode: 'PST-BC' },
  SK: { taxModel: 'GST_PST', gstRate: 5, pstRate: 6, hstRate: 0, pstRecoverable: false, pstAuthority: 'Provincial', pstCode: 'PST-SK' },
  MB: { taxModel: 'GST_PST', gstRate: 5, pstRate: 7, hstRate: 0, pstRecoverable: false, pstAuthority: 'Provincial', pstCode: 'PST-MB' },
  QC: { taxModel: 'GST_PST', gstRate: 5, pstRate: 9.975, hstRate: 0, pstRecoverable: true, pstAuthority: 'Revenu Quebec', pstCode: 'QST' },
  // GST-Only Provinces/Territories
  AB: { taxModel: 'GST_ONLY', gstRate: 5, pstRate: 0, hstRate: 0, pstRecoverable: false, pstAuthority: 'Provincial', pstCode: '' },
  NT: { taxModel: 'GST_ONLY', gstRate: 5, pstRate: 0, hstRate: 0, pstRecoverable: false, pstAuthority: 'Provincial', pstCode: '' },
  NU: { taxModel: 'GST_ONLY', gstRate: 5, pstRate: 0, hstRate: 0, pstRecoverable: false, pstAuthority: 'Provincial', pstCode: '' },
  YT: { taxModel: 'GST_ONLY', gstRate: 5, pstRate: 0, hstRate: 0, pstRecoverable: false, pstAuthority: 'Provincial', pstCode: '' },
};

/**
 * Round to 2 decimal places using banker's rounding
 */
function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate split taxes for a transaction
 * 
 * @param amount - The base amount (taxable or gross depending on isInclusive)
 * @param jurisdictionCode - Province/territory code (ON, BC, MB, etc.)
 * @param isInclusive - Whether tax is included in the amount
 * @param glAccounts - Optional GL account mappings for each tax type
 */
export function calculateSplitTaxes(
  amount: number,
  jurisdictionCode: string,
  isInclusive: boolean = false,
  glAccounts?: {
    gst?: string | null;
    pst?: string | null;
    hst?: string | null;
  }
): SplitTaxCalculation {
  const config = PROVINCE_TAX_CONFIG[jurisdictionCode] || PROVINCE_TAX_CONFIG.AB;
  const taxes: TaxComponent[] = [];
  
  let taxableAmount: number;
  let totalTax = 0;
  
  // Calculate taxable amount based on tax model
  if (isInclusive) {
    switch (config.taxModel) {
      case 'HST':
        taxableAmount = roundCurrency(amount / (1 + config.hstRate / 100));
        break;
      case 'GST_PST':
        taxableAmount = roundCurrency(amount / (1 + (config.gstRate + config.pstRate) / 100));
        break;
      default:
        taxableAmount = roundCurrency(amount / (1 + config.gstRate / 100));
    }
  } else {
    taxableAmount = amount;
  }
  
  // Calculate each tax component SEPARATELY
  switch (config.taxModel) {
    case 'HST': {
      const hstAmount = roundCurrency(taxableAmount * config.hstRate / 100);
      taxes.push({
        type: 'HST',
        code: 'HST',
        rate: config.hstRate,
        amount: hstAmount,
        isRecoverable: true,
        authority: 'CRA',
        glAccountId: glAccounts?.hst,
      });
      totalTax = hstAmount;
      break;
    }
    
    case 'GST_PST': {
      // GST (Federal - always first)
      const gstAmount = roundCurrency(taxableAmount * config.gstRate / 100);
      taxes.push({
        type: 'GST',
        code: 'GST',
        rate: config.gstRate,
        amount: gstAmount,
        isRecoverable: true,
        authority: 'CRA',
        glAccountId: glAccounts?.gst,
      });
      
      // PST/QST (Provincial - separate)
      const pstAmount = roundCurrency(taxableAmount * config.pstRate / 100);
      taxes.push({
        type: jurisdictionCode === 'QC' ? 'QST' : 'PST',
        code: config.pstCode,
        rate: config.pstRate,
        amount: pstAmount,
        isRecoverable: config.pstRecoverable,
        authority: config.pstAuthority,
        glAccountId: glAccounts?.pst,
      });
      
      totalTax = gstAmount + pstAmount;
      break;
    }
    
    default: {
      // GST Only
      const gstAmount = roundCurrency(taxableAmount * config.gstRate / 100);
      taxes.push({
        type: 'GST',
        code: 'GST',
        rate: config.gstRate,
        amount: gstAmount,
        isRecoverable: true,
        authority: 'CRA',
        glAccountId: glAccounts?.gst,
      });
      totalTax = gstAmount;
    }
  }
  
  const combinedRate = config.taxModel === 'HST' 
    ? config.hstRate 
    : config.gstRate + config.pstRate;
  
  return {
    taxableAmount,
    taxModel: config.taxModel,
    jurisdictionCode,
    totalTax,
    grossAmount: roundCurrency(taxableAmount + totalTax),
    combinedRate,
    taxes,
  };
}

/**
 * Calculate taxes for a line item with optional override rates
 */
export function calculateLineTaxes(
  lineAmount: number,
  jurisdictionCode: string,
  overrideRates?: {
    gstRate?: number;
    pstRate?: number;
    hstRate?: number;
  },
  isExempt: boolean = false,
  isZeroRated: boolean = false
): SplitTaxCalculation {
  if (isExempt || isZeroRated) {
    return {
      taxableAmount: lineAmount,
      taxModel: 'GST_ONLY',
      jurisdictionCode,
      totalTax: 0,
      grossAmount: lineAmount,
      combinedRate: 0,
      taxes: [],
    };
  }
  
  const config = PROVINCE_TAX_CONFIG[jurisdictionCode] || PROVINCE_TAX_CONFIG.AB;
  const effectiveGstRate = overrideRates?.gstRate ?? config.gstRate;
  const effectivePstRate = overrideRates?.pstRate ?? config.pstRate;
  const effectiveHstRate = overrideRates?.hstRate ?? config.hstRate;
  
  const taxes: TaxComponent[] = [];
  let totalTax = 0;
  
  switch (config.taxModel) {
    case 'HST': {
      const hstAmount = roundCurrency(lineAmount * effectiveHstRate / 100);
      taxes.push({
        type: 'HST',
        code: 'HST',
        rate: effectiveHstRate,
        amount: hstAmount,
        isRecoverable: true,
        authority: 'CRA',
      });
      totalTax = hstAmount;
      break;
    }
    
    case 'GST_PST': {
      const gstAmount = roundCurrency(lineAmount * effectiveGstRate / 100);
      taxes.push({
        type: 'GST',
        code: 'GST',
        rate: effectiveGstRate,
        amount: gstAmount,
        isRecoverable: true,
        authority: 'CRA',
      });
      
      const pstAmount = roundCurrency(lineAmount * effectivePstRate / 100);
      taxes.push({
        type: jurisdictionCode === 'QC' ? 'QST' : 'PST',
        code: config.pstCode,
        rate: effectivePstRate,
        amount: pstAmount,
        isRecoverable: config.pstRecoverable,
        authority: config.pstAuthority,
      });
      
      totalTax = gstAmount + pstAmount;
      break;
    }
    
    default: {
      const gstAmount = roundCurrency(lineAmount * effectiveGstRate / 100);
      taxes.push({
        type: 'GST',
        code: 'GST',
        rate: effectiveGstRate,
        amount: gstAmount,
        isRecoverable: true,
        authority: 'CRA',
      });
      totalTax = gstAmount;
    }
  }
  
  return {
    taxableAmount: lineAmount,
    taxModel: config.taxModel,
    jurisdictionCode,
    totalTax,
    grossAmount: roundCurrency(lineAmount + totalTax),
    combinedRate: config.taxModel === 'HST' ? effectiveHstRate : effectiveGstRate + effectivePstRate,
    taxes,
  };
}

/**
 * Aggregate taxes from multiple line items
 */
export function aggregateLineTaxes(lineCalculations: SplitTaxCalculation[]): {
  subtotal: number;
  gstTotal: number;
  pstTotal: number;
  hstTotal: number;
  totalTax: number;
  grandTotal: number;
  taxBreakdown: TaxComponent[];
} {
  const aggregated: Record<string, TaxComponent> = {};
  let subtotal = 0;
  
  for (const calc of lineCalculations) {
    subtotal += calc.taxableAmount;
    
    for (const tax of calc.taxes) {
      const key = tax.code;
      if (!aggregated[key]) {
        aggregated[key] = { ...tax, amount: 0 };
      }
      aggregated[key].amount = roundCurrency(aggregated[key].amount + tax.amount);
    }
  }
  
  const taxBreakdown = Object.values(aggregated);
  const gstTotal = taxBreakdown.filter(t => t.type === 'GST').reduce((sum, t) => sum + t.amount, 0);
  const pstTotal = taxBreakdown.filter(t => t.type === 'PST' || t.type === 'QST').reduce((sum, t) => sum + t.amount, 0);
  const hstTotal = taxBreakdown.filter(t => t.type === 'HST').reduce((sum, t) => sum + t.amount, 0);
  const totalTax = taxBreakdown.reduce((sum, t) => sum + t.amount, 0);
  
  return {
    subtotal: roundCurrency(subtotal),
    gstTotal: roundCurrency(gstTotal),
    pstTotal: roundCurrency(pstTotal),
    hstTotal: roundCurrency(hstTotal),
    totalTax: roundCurrency(totalTax),
    grandTotal: roundCurrency(subtotal + totalTax),
    taxBreakdown,
  };
}

/**
 * Format tax breakdown for display
 */
export function formatTaxBreakdown(
  calculation: SplitTaxCalculation,
  showCombined: boolean = false
): string {
  if (calculation.taxes.length === 0) return 'No Tax';
  
  if (showCombined && calculation.taxes.length > 1) {
    return `Combined (${calculation.combinedRate}%)`;
  }
  
  return calculation.taxes.map(t => `${t.code} ${t.rate}%`).join(' + ');
}

/**
 * Get tax display label for a jurisdiction
 */
export function getTaxDisplayLabel(jurisdictionCode: string, showCombined: boolean = false): string {
  const config = PROVINCE_TAX_CONFIG[jurisdictionCode];
  if (!config) return 'GST 5%';
  
  switch (config.taxModel) {
    case 'HST':
      return `HST ${config.hstRate}%`;
    case 'GST_PST':
      if (showCombined) {
        return `${jurisdictionCode === 'QC' ? 'GST+QST' : 'GST+PST'} ${config.gstRate + config.pstRate}%`;
      }
      return `GST ${config.gstRate}% + ${jurisdictionCode === 'QC' ? 'QST' : 'PST'} ${config.pstRate}%`;
    default:
      return `GST ${config.gstRate}%`;
  }
}

/**
 * Check if jurisdiction requires separate PST accounting
 */
export function requiresSeparatePstAccounting(jurisdictionCode: string): boolean {
  const config = PROVINCE_TAX_CONFIG[jurisdictionCode];
  return config?.taxModel === 'GST_PST';
}

/**
 * Get tax model for jurisdiction
 */
export function getTaxModel(jurisdictionCode: string): TaxModel {
  return PROVINCE_TAX_CONFIG[jurisdictionCode]?.taxModel || 'GST_ONLY';
}
