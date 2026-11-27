import { describe, expect, it } from 'vitest';
import {
  currencySymbol, formatOrgMoney, orgCurrency, orgCurrencySymbol, resolveCountryCode, resolveOrgCurrency,
  resolveOrgLocale, setActiveOrganizationCurrency,
} from '../orgCurrency';

describe('company currency', () => {
  it('resolves a Nigerian company to Naira whether the country is a code or a name', () => {
    expect(resolveOrgCurrency({ country: 'Nigeria', currency: null })).toBe('NGN');
    expect(resolveOrgCurrency({ country: 'NG' })).toBe('NGN');
    expect(resolveCountryCode('Nigeria')).toBe('NG');
  });

  it('uses the base currency saved in company settings first', () => {
    expect(resolveOrgCurrency({ country: 'Nigeria', currency: 'ngn' })).toBe('NGN');
    expect(resolveOrgCurrency({ country: 'Canada', currency: 'USD' })).toBe('USD');
  });

  it('works for other localized countries', () => {
    expect(resolveOrgCurrency({ country: 'Kenya' })).toBe('KES');
    expect(resolveOrgCurrency({ country: 'Ghana' })).toBe('GHS');
    expect(resolveOrgCurrency({ country: 'United Kingdom' })).toBe('GBP');
    expect(resolveOrgCurrency({ country: 'Canada' })).toBe('CAD');
    expect(resolveOrgCurrency({})).toBe('USD');
  });

  it('formats amounts in the active company currency once the organization loads', () => {
    setActiveOrganizationCurrency({ country: 'Nigeria', currency: 'NGN' });
    expect(orgCurrency()).toBe('NGN');
    expect(resolveOrgLocale({ country: 'Nigeria' })).toMatch(/^en-NG|^en/);
    expect(orgCurrencySymbol()).toBe('₦');
    expect(formatOrgMoney(73314023)).toContain('₦');
    expect(formatOrgMoney(73314023)).toContain('73,314,023');
    expect(formatOrgMoney(73314023)).not.toContain('$');
  });

  it('gives symbols for common currencies', () => {
    expect(currencySymbol('NGN')).toBe('₦');
    expect(currencySymbol('GBP')).toBe('£');
    expect(currencySymbol('XYZ_BAD')).toBe('XYZ_BAD');
  });
});
