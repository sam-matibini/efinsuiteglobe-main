// Currency choices and the base currency an organization should use.

import { COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

const EXTRA: CurrencyOption[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
];

/** Every currency used by a supported country, plus the major reserve currencies. */
export const ALL_CURRENCIES: CurrencyOption[] = (() => {
  const byCode = new Map<string, CurrencyOption>();
  for (const c of EXTRA) byCode.set(c.code, c);
  for (const loc of Object.values(COUNTRY_LOCALIZATIONS)) {
    if (!loc.currency || byCode.has(loc.currency)) continue;
    byCode.set(loc.currency, { code: loc.currency, name: loc.currencyName || loc.currency, symbol: loc.currencySymbol || loc.currency });
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
})();

export function currencyOption(code: string | null | undefined): CurrencyOption | undefined {
  return code ? ALL_CURRENCIES.find((c) => c.code === code.toUpperCase()) : undefined;
}

/** Resolves a country stored as a code ("NG") or a name ("Nigeria") to its currency. */
export function countryCurrency(country: string | null | undefined): { countryCode: string; countryName: string; currency: string } | null {
  if (!country) return null;
  const v = country.trim();
  const loc = COUNTRY_LOCALIZATIONS[v.toUpperCase()]
    ?? Object.values(COUNTRY_LOCALIZATIONS).find((c) => c.name.toLowerCase() === v.toLowerCase());
  return loc?.currency ? { countryCode: loc.code, countryName: loc.name, currency: loc.currency } : null;
}

/**
 * The base currency to suggest: the currency of the country the organization
 * is based in, then the currency already stored on the organization, then USD.
 */
export function recommendedBaseCurrency(org: { country?: string | null; currency?: string | null }): string {
  return countryCurrency(org.country)?.currency ?? (org.currency ? org.currency.toUpperCase() : 'USD');
}
