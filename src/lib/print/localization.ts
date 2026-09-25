/**
 * Print Localization Engine
 * Country-aware formatting for dates, numbers, currency, and paper sizes
 */

import { getCountryLocalization } from '@/data/countryLocalizations';
import { parseLocalDate } from '@/lib/utils';
import type { PaperSize, PrintLocalization, NumberFormatConfig } from './types';

// Country-specific paper size defaults
const COUNTRY_PAPER_SIZES: Record<string, PaperSize> = {
  US: 'letter',
  CA: 'letter',
  MX: 'letter',
  // Most other countries use A4
  default: 'a4',
};

// Country-specific date formats
const COUNTRY_DATE_FORMATS: Record<string, string> = {
  US: 'MM/DD/YYYY',
  CA: 'YYYY-MM-DD',
  GB: 'DD/MM/YYYY',
  AU: 'DD/MM/YYYY',
  DE: 'DD.MM.YYYY',
  FR: 'DD/MM/YYYY',
  BI: 'DD/MM/YYYY',
  ZM: 'DD/MM/YYYY',
  KE: 'DD/MM/YYYY',
  default: 'YYYY-MM-DD',
};

// Number format configurations by locale
const NUMBER_FORMATS: Record<string, NumberFormatConfig> = {
  'en-US': { decimal: '.', thousand: ',', precision: 2 },
  'en-CA': { decimal: '.', thousand: ',', precision: 2 },
  'en-GB': { decimal: '.', thousand: ',', precision: 2 },
  'de-DE': { decimal: ',', thousand: '.', precision: 2 },
  'fr-FR': { decimal: ',', thousand: ' ', precision: 2 },
  'fr-BI': { decimal: ',', thousand: ' ', precision: 2 },
  default: { decimal: '.', thousand: ',', precision: 2 },
};

// Locale mapping
const LOCALE_MAP: Record<string, string> = {
  CA: 'en-CA',
  US: 'en-US',
  GB: 'en-GB',
  AU: 'en-AU',
  DE: 'de-DE',
  FR: 'fr-FR',
  BI: 'fr-BI',
  ZM: 'en-ZM',
  KE: 'en-KE',
};

// RTL language codes
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

/**
 * Get print localization settings for a country
 */
export function getPrintLocalization(
  countryCode: string,
  language: string = 'en',
  currencyOverride?: string
): PrintLocalization {
  const countryLocalization = getCountryLocalization(countryCode);
  const locale = LOCALE_MAP[countryCode] || 'en-US';
  
  return {
    language,
    dateFormat: COUNTRY_DATE_FORMATS[countryCode] || COUNTRY_DATE_FORMATS.default,
    numberFormat: NUMBER_FORMATS[locale] || NUMBER_FORMATS.default,
    currency: currencyOverride || countryLocalization.currency,
    paperSize: COUNTRY_PAPER_SIZES[countryCode] || COUNTRY_PAPER_SIZES.default,
    textDirection: RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr',
  };
}

/**
 * Format a date string according to localization settings
 */
export function formatPrintDate(
  dateStr: string | Date,
  format: string,
  locale: string = 'en-CA'
): string {
  const date = typeof dateStr === 'string' ? parseLocalDate(dateStr) : dateStr;
  
  // Simple format implementation
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const monthNames = new Intl.DateTimeFormat(locale, { month: 'short' }).format(date);
  const monthLong = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
  
  return format
    .replace('YYYY', String(year))
    .replace('YY', String(year).slice(-2))
    .replace('MMMM', monthLong)
    .replace('MMM', monthNames)
    .replace('MM', month)
    .replace('DD', day);
}

/**
 * Format a number according to localization settings
 */
export function formatPrintNumber(
  value: number,
  config: NumberFormatConfig,
  showDecimals: boolean = true
): string {
  const precision = showDecimals ? config.precision : 0;
  const fixed = Math.abs(value).toFixed(precision);
  const [intPart, decPart] = fixed.split('.');
  
  // Add thousand separators
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, config.thousand);
  
  let result = formattedInt;
  if (showDecimals && decPart) {
    result += config.decimal + decPart;
  }
  
  return value < 0 ? `-${result}` : result;
}

/**
 * Format currency for print output
 */
export function formatPrintCurrency(
  value: number,
  currency: string,
  locale: string = 'en-CA',
  showSymbol: boolean = true,
  negativeFormat: 'minus' | 'brackets' = 'minus'
): string {
  const absValue = Math.abs(value);
  
  let formatted: string;
  if (showSymbol) {
    formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absValue);
  } else {
    formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absValue);
  }
  
  if (value < 0) {
    return negativeFormat === 'brackets' ? `(${formatted})` : `-${formatted}`;
  }
  
  return formatted;
}

/**
 * Get fiscal year label for a country
 */
export function getFiscalYearLabel(countryCode: string, year: number): string {
  // Different countries have different fiscal year conventions
  switch (countryCode) {
    case 'GB':
    case 'AU':
      return `FY ${year}/${year + 1}`;
    default:
      return `FY ${year}`;
  }
}

/**
 * Get period description for reports
 */
export function getPeriodDescription(
  startDate: string,
  endDate: string,
  dateFormat: string,
  locale: string = 'en-CA'
): string {
  const start = formatPrintDate(startDate, dateFormat, locale);
  const end = formatPrintDate(endDate, dateFormat, locale);
  return `${start} to ${end}`;
}

/**
 * Get language name from code
 */
export function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'English',
    fr: 'French',
    es: 'Spanish',
    de: 'German',
    pt: 'Portuguese',
    ar: 'Arabic',
    zh: 'Chinese',
    sw: 'Swahili',
  };
  return languages[code] || code.toUpperCase();
}

/**
 * Get available languages for an organization
 */
export function getAvailableLanguages(countryCode: string): { code: string; name: string }[] {
  const baseLanguages = [
    { code: 'en', name: 'English' },
  ];
  
  // Add country-specific languages
  switch (countryCode) {
    case 'CA':
      return [...baseLanguages, { code: 'fr', name: 'French' }];
    case 'BI':
      return [{ code: 'fr', name: 'French' }, ...baseLanguages];
    case 'KE':
      return [...baseLanguages, { code: 'sw', name: 'Swahili' }];
    default:
      return baseLanguages;
  }
}
