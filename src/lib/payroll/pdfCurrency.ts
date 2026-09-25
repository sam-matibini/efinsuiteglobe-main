/**
 * Shared currency formatter for payroll PDFs.
 *
 * jsPDF's built-in Helvetica font uses WinAnsi encoding, which lacks glyphs for
 * many localized currency symbols (e.g. ₦ Naira, K Kwacha, KSh, ₵ Cedi). When
 * `Intl.NumberFormat` emits those symbols they render as garbage (`¦`) in the
 * PDF. To avoid embedding a Unicode font for every slip, we detect currencies
 * whose symbol falls outside WinAnsi and prefix the ISO code instead:
 *
 *   formatPdfCurrency(12500, 'NG')  // "NGN 12,500.00"
 *   formatPdfCurrency(1234.5, 'CA') // "CA$1,234.50"
 */
import { getPayrollLocalization } from '@/data/payrollLocalization';

// Currencies whose symbol is NOT representable in WinAnsi / Helvetica.
// For these we render the ISO code + space + grouped decimal number.
const CODE_PREFIX_CURRENCIES = new Set([
  'NGN', // ₦
  'ZMW', // K
  'KES', // KSh
  'BIF', // FBu
  'GHS', // ₵
  'TZS', // TSh
  'UGX', // USh
  'XAF', // FCFA
  'XOF', // CFA
  'ETB', // Br
  'MWK', // MK
  'RWF', // FRw
  'ZAR', // R (safe but keep consistent for SADC region if desired) - leave out
]);
CODE_PREFIX_CURRENCIES.delete('ZAR');

export function formatPdfCurrency(amount: number, countryCode?: string): string {
  const cc = (countryCode || 'CA').toUpperCase();
  const loc = getPayrollLocalization(cc);
  const currency = loc.currencyCode;
  const value = Number.isFinite(amount) ? amount : 0;

  if (CODE_PREFIX_CURRENCIES.has(currency)) {
    const num = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${currency} ${num}`;
  }

  try {
    return new Intl.NumberFormat(loc.currencyLocale, {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    const num = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${currency} ${num}`;
  }
}

/** Build a currency formatter bound to a country code (for hot loops). */
export function buildPdfCurrencyFormatter(countryCode?: string): (n: number) => string {
  return (n: number) => formatPdfCurrency(n, countryCode);
}

/** Direct currency-code based variant (when the country isn't known). */
export function formatPdfCurrencyByCode(amount: number, currency: string, locale = 'en-US'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  if (CODE_PREFIX_CURRENCIES.has(currency.toUpperCase())) {
    const num = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${currency.toUpperCase()} ${num}`;
  }
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  } catch {
    const num = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${currency.toUpperCase()} ${num}`;
  }
}
