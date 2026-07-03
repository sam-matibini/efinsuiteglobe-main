// Localized currency formatter for all supported countries
import { COUNTRY_LOCALIZATIONS, getCountryLocalization } from '@/data/countryLocalizations';
import { parseLocalDate } from '@/lib/utils';

export interface CurrencyFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  showSymbol?: boolean;
  compact?: boolean;
}

/**
 * Get the currency formatter for a specific country
 */
export function getCurrencyFormatter(
  countryCode: string = 'CA',
  options: CurrencyFormatOptions = {}
): (value: number) => string {
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);
  
  const formatOptions: Intl.NumberFormatOptions = {
    style: options.showSymbol !== false ? 'currency' : 'decimal',
    currency: localization.currency,
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  };

  if (options.compact) {
    formatOptions.notation = 'compact';
    formatOptions.compactDisplay = 'short';
  }

  const formatter = new Intl.NumberFormat(locale, formatOptions);
  
  return (value: number) => formatter.format(value);
}

/**
 * Get the locale string for a country code
 */
export function getLocaleForCountry(countryCode: string): string {
  switch (countryCode) {
    case 'CA':
      return 'en-CA';
    case 'US':
      return 'en-US';
    case 'ZM':
      return 'en-ZM';
    case 'KE':
      return 'en-KE';
    case 'BI':
      return 'fr-BI';
    default:
      return 'en-US';
  }
}

/**
 * Format a number as currency for a specific country
 */
export function formatCurrency(
  value: number,
  countryCode: string = 'CA',
  options: CurrencyFormatOptions = {}
): string {
  const formatter = getCurrencyFormatter(countryCode, options);
  return formatter(value);
}

/**
 * Format a date according to country conventions
 */
export function formatDate(
  date: Date | string,
  countryCode: string = 'CA',
  style: 'short' | 'medium' | 'long' = 'medium'
): string {
  const locale = getLocaleForCountry(countryCode);
  // Use parseLocalDate for strings to avoid timezone offset issues
  const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: style,
  };

  return new Intl.DateTimeFormat(locale, options).format(dateObj);
}

/**
 * Format a percentage with localized formatting
 */
export function formatPercentage(
  value: number,
  countryCode: string = 'CA',
  decimals: number = 2
): string {
  const locale = getLocaleForCountry(countryCode);
  
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Get country-specific number formatting rules
 */
export function getNumberFormatRules(countryCode: string): {
  decimalSeparator: string;
  thousandsSeparator: string;
  currencyPosition: 'before' | 'after';
} {
  switch (countryCode) {
    case 'BI':
      return {
        decimalSeparator: ',',
        thousandsSeparator: ' ',
        currencyPosition: 'after',
      };
    default:
      return {
        decimalSeparator: '.',
        thousandsSeparator: ',',
        currencyPosition: 'before',
      };
  }
}

/**
 * Parse a localized currency string back to a number
 */
export function parseCurrency(
  value: string,
  countryCode: string = 'CA'
): number {
  const rules = getNumberFormatRules(countryCode);
  const localization = getCountryLocalization(countryCode);
  
  // Remove currency symbols
  let cleaned = value.replace(localization.currencySymbol, '');
  
  // Handle different number formats
  if (rules.thousandsSeparator === ' ') {
    cleaned = cleaned.replace(/\s/g, '');
  } else {
    cleaned = cleaned.replace(new RegExp(`\\${rules.thousandsSeparator}`, 'g'), '');
  }
  
  // Handle decimal separator
  if (rules.decimalSeparator === ',') {
    cleaned = cleaned.replace(',', '.');
  }
  
  // Parse and return
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Country-specific payroll terminology
export const PAYROLL_TERMINOLOGY: Record<string, {
  grossPay: string;
  netPay: string;
  deductions: string;
  taxWithheld: string;
  pension: string;
  healthInsurance: string;
}> = {
  CA: {
    grossPay: 'Gross Pay',
    netPay: 'Net Pay',
    deductions: 'Total Deductions',
    taxWithheld: 'Income Tax Withheld',
    pension: 'CPP Contribution',
    healthInsurance: 'EI Premium',
  },
  US: {
    grossPay: 'Gross Pay',
    netPay: 'Net Pay',
    deductions: 'Total Deductions',
    taxWithheld: 'Federal Tax Withheld',
    pension: 'Social Security',
    healthInsurance: 'Medicare',
  },
  ZM: {
    grossPay: 'Gross Emoluments',
    netPay: 'Net Pay',
    deductions: 'Total Deductions',
    taxWithheld: 'PAYE',
    pension: 'NAPSA',
    healthInsurance: 'NHIMA',
  },
  KE: {
    grossPay: 'Gross Pay',
    netPay: 'Net Pay',
    deductions: 'Total Deductions',
    taxWithheld: 'PAYE',
    pension: 'NSSF',
    healthInsurance: 'SHIF',
  },
  BI: {
    grossPay: 'Salaire Brut',
    netPay: 'Salaire Net',
    deductions: 'Total Retenues',
    taxWithheld: 'IPR',
    pension: 'INSS',
    healthInsurance: 'MFP',
  },
};

/**
 * Get payroll terminology for a country
 */
export function getPayrollTerminology(countryCode: string) {
  return PAYROLL_TERMINOLOGY[countryCode] || PAYROLL_TERMINOLOGY.CA;
}
