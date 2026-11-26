import { describe, expect, it } from 'vitest';
import { ALL_CURRENCIES, countryCurrency, currencyOption, recommendedBaseCurrency } from '../currencyOptions';

describe('currency options', () => {
  it('offers Naira and every major currency, once each', () => {
    const codes = ALL_CURRENCIES.map((c) => c.code);
    for (const code of ['NGN', 'USD', 'CAD', 'EUR', 'GBP', 'GHS', 'KES', 'ZAR']) expect(codes).toContain(code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(currencyOption('ngn')).toMatchObject({ code: 'NGN', symbol: '₦' });
  });

  it('resolves a Nigerian organization to NGN whether the country is stored as a code or a name', () => {
    expect(countryCurrency('NG')).toMatchObject({ currency: 'NGN', countryName: 'Nigeria' });
    expect(countryCurrency('Nigeria')).toMatchObject({ currency: 'NGN', countryCode: 'NG' });
    expect(countryCurrency('nigeria')?.currency).toBe('NGN');
  });

  it('suggests the country currency over a wrong stored currency', () => {
    // Earthweb Security and Intelligence Network Limited: based in Nigeria.
    expect(recommendedBaseCurrency({ country: 'Nigeria', currency: 'USD' })).toBe('NGN');
    expect(recommendedBaseCurrency({ country: 'NG', currency: null })).toBe('NGN');
  });

  it('falls back to the stored currency, then USD', () => {
    expect(recommendedBaseCurrency({ country: null, currency: 'cad' })).toBe('CAD');
    expect(recommendedBaseCurrency({ country: 'Atlantis', currency: null })).toBe('USD');
  });
});
