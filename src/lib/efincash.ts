/** Currencies eFinCash can provision virtual accounts in. */
export const EFINCASH_CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES'] as const;

export type EfincashCurrency = (typeof EFINCASH_CURRENCIES)[number];

/**
 * Resolve the virtual-account currency for an organization: use the country's
 * default currency when eFinCash supports it, otherwise fall back to USD.
 */
export function resolveVirtualAccountCurrency(
  countryCurrency?: string | null,
): EfincashCurrency {
  const code = (countryCurrency ?? '').toUpperCase();
  return (EFINCASH_CURRENCIES as readonly string[]).includes(code)
    ? (code as EfincashCurrency)
    : 'USD';
}
