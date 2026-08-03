/**
 * Country-first module map (Dynamics 365-style scoping).
 *
 * Given the currently scoped country code, this decides which country-specific
 * sidebar entries and features should be visible. Everything else (accounting,
 * banking, reports, sales, purchases, etc.) is country-agnostic and always shown.
 */

import { isEuCountry } from '@/hooks/useCountryFilter';

export interface CountryModuleFlags {
  /** CRA / provincial sales tax UI (GST-HST, PST, QST). */
  showCanadianTax: boolean;
  /** Nigerian Tax Engine — NRS / SIRS / PAYE. */
  showNigerianTax: boolean;
  /** IRS + US state sales/address tax. */
  showUsTax: boolean;
  /** HMRC MTD VAT. */
  showUkTax: boolean;
  /** EU OSS / VAT registrations. */
  showEuVat: boolean;
  /** Default accounting framework label for the country. */
  accountingStandard: 'ASPE' | 'US_GAAP' | 'IFRS' | 'IFRS_SME' | 'HMRC_FRS';
}

export function getCountryModuleFlags(country?: string | null): CountryModuleFlags {
  const c = country?.toUpperCase() ?? '';
  return {
    showCanadianTax: c === 'CA',
    showNigerianTax: c === 'NG',
    showUsTax: c === 'US',
    showUkTax: c === 'GB',
    showEuVat: isEuCountry(c),
    accountingStandard:
      c === 'CA' ? 'ASPE'
      : c === 'US' ? 'US_GAAP'
      : c === 'GB' ? 'HMRC_FRS'
      : c === 'NG' ? 'IFRS_SME'
      : 'IFRS',
  };
}

/**
 * Nav-child predicate: returns true if a nav entry restricted to certain
 * countries should be visible under the scoped country. When the entry has
 * no restriction, it is always visible.
 */
export function isChildVisibleForCountry(
  child: { hideForNonCA?: boolean; restrictToCountries?: string[] },
  country?: string | null
): boolean {
  const c = country?.toUpperCase() ?? '';
  if (child.hideForNonCA && c !== 'CA') return false;
  if (child.restrictToCountries && !child.restrictToCountries.includes(c)) return false;
  return true;
}
