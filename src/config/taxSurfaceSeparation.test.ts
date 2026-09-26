import { describe, expect, it } from 'vitest';
import { getCountryTreasuryConfig } from '@/config/countryTreasuryConfig';
import { isChildVisibleForCountry } from '@/config/countryModuleMap';

describe('Tax & CRA and sales tax reporting stay separate', () => {
  it('sends Canadian eFinConnect tax cards to Tax & CRA and ledger reporting', () => {
    const cards = getCountryTreasuryConfig('CA').sections.taxRemittances;
    expect(cards.map((card) => card.to)).toEqual([
      '/tax-cra',
      '/tax',
      '/banking-payments/provincial',
    ]);
    expect(cards.some((card) => card.to === '/treasury/tax-payments')).toBe(false);
    expect(cards.some((card) => card.to === '/banking-payments/cra-remittance')).toBe(false);
    expect(cards[1]?.description).toMatch(/not CRA account balances/);
  });

  it('keeps other countries on their own tax remittance routes', () => {
    expect(getCountryTreasuryConfig('US').sections.taxRemittances[0]?.to).toBe('/treasury/tax-payments');
    expect(getCountryTreasuryConfig('NG').sections.taxRemittances[0]?.to).toContain('/tax/nigeria');
  });

  it('hides the sales-tax e-file entry for Canada', () => {
    const efile = { hideForCountries: ['CA'], href: '/tax/e-file' };
    expect(isChildVisibleForCountry(efile, 'CA')).toBe(false);
    expect(isChildVisibleForCountry(efile, 'US')).toBe(true);
    expect(isChildVisibleForCountry({ hideForNonCA: true }, 'CA')).toBe(true);
    expect(isChildVisibleForCountry({ hideForNonCA: true }, 'US')).toBe(false);
  });
});
