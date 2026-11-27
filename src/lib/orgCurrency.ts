// The active company's currency, for formatting and defaults outside React
// hooks (PDF builders, mutation payloads, module-level formatters).
//
// Resolution order: the base currency saved on the organization (set when
// multi-currency is enabled) → the currency of the country it is based in
// (country stored as code or name, e.g. "NG" or "Nigeria" → NGN) → USD.
//
// useCurrentOrganization() keeps this in sync whenever the organization
// loads or changes, so anything rendered with organization data sees the
// right currency. Components should prefer useCurrencyFormatter().

import { COUNTRY_LOCALIZATIONS, getLocaleForCountry } from '@/data/countryLocalizations';
import { countryCurrency } from '@/lib/currencyOptions';

export interface OrgCurrencySource {
  currency?: string | null;
  country?: string | null;
}

/** Country code for an organization's country, stored as a code or a name. */
export function resolveCountryCode(country?: string | null): string | null {
  if (!country) return null;
  const v = country.trim();
  if (COUNTRY_LOCALIZATIONS[v.toUpperCase()]) return v.toUpperCase();
  return countryCurrency(v)?.countryCode ?? null;
}

export function resolveOrgCurrency(org?: OrgCurrencySource | null): string {
  const stored = org?.currency?.trim().toUpperCase();
  if (stored && /^[A-Z]{3}$/.test(stored)) return stored;
  return countryCurrency(org?.country)?.currency ?? 'USD';
}

export function resolveOrgLocale(org?: OrgCurrencySource | null): string {
  const code = resolveCountryCode(org?.country);
  return code ? getLocaleForCountry(code) : 'en-US';
}

let active = { currency: 'USD', locale: 'en-US' };

/** Called by useCurrentOrganization; safe to call repeatedly. */
export function setActiveOrganizationCurrency(org?: OrgCurrencySource | null) {
  if (!org) return;
  active = { currency: resolveOrgCurrency(org), locale: resolveOrgLocale(org) };
}

/** ISO code of the active company's currency (e.g. "NGN"). */
export function orgCurrency(): string {
  return active.currency;
}

/** Number-format locale for the active company's country (e.g. "en-NG"). */
export function orgLocale(): string {
  return active.locale;
}

/** Currency symbol for a code in a locale, e.g. NGN → ₦, CAD → $. */
export function currencySymbol(currency: string, locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

/** Symbol of the active company's currency (₦ for a Nigerian company). */
export function orgCurrencySymbol(): string {
  return currencySymbol(active.currency, active.locale);
}

/** Formats an amount in the active company's currency, e.g. ₦1,250,000.00. */
export function formatOrgMoney(value: number, opts: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {}): string {
  return new Intl.NumberFormat(active.locale, {
    style: 'currency',
    currency: active.currency,
    minimumFractionDigits: opts.minimumFractionDigits ?? Math.min(2, opts.maximumFractionDigits ?? 2),
    maximumFractionDigits: opts.maximumFractionDigits ?? 2,
  }).format(Number(value) || 0);
}
