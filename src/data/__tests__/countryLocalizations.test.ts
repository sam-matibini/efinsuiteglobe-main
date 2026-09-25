import { describe, it, expect } from 'vitest';
import {
  COUNTRY_LOCALIZATIONS,
  getCountryLocalization,
  resolveCountryCode,
  getCountriesByRegion,
  getAvailableCurrencies,
  getRetailTaxTypes,
  getPrimaryRetailTaxType,
  isRecoverableRetailTax,
  classifyRetailTaxFamily,
  resolveRetailTaxType,
} from '../countryLocalizations';
import { getAllLocalizedCurrencies } from '@/hooks/useLocalizedCurrency';

const allCodes = Object.keys(COUNTRY_LOCALIZATIONS);

describe('Country Localizations Data', () => {
  it('all country codes are unique', () => {
    const codes = allCodes;
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('every country has a valid 3-letter currency code', () => {
    allCodes.forEach(code => {
      const loc = COUNTRY_LOCALIZATIONS[code];
      expect(loc.currency).toMatch(/^[A-Z]{3}$/);
    });
  });

  it('every country has a non-empty jurisdictions array', () => {
    allCodes.forEach(code => {
      expect(COUNTRY_LOCALIZATIONS[code].jurisdictions.length).toBeGreaterThan(0);
    });
  });

  it('Canada has 13 provinces/territories', () => {
    expect(COUNTRY_LOCALIZATIONS['CA'].jurisdictions).toHaveLength(13);
  });

  it('US has 50+ states/territories', () => {
    expect(COUNTRY_LOCALIZATIONS['US'].jurisdictions.length).toBeGreaterThanOrEqual(50);
  });

  it('every country has at least one tax type or tax regime', () => {
    allCodes.forEach(code => {
      const loc = COUNTRY_LOCALIZATIONS[code];
      expect(loc.taxTypes.length + loc.taxRegimes.length).toBeGreaterThan(0);
    });
  });

  it('getCountryLocalization returns correct data for known codes', () => {
    const ca = getCountryLocalization('CA');
    expect(ca.name).toBe('Canada');
    expect(ca.currency).toBe('CAD');
  });

  it('getCountryLocalization returns a default for unknown codes', () => {
    const unknown = getCountryLocalization('ZZ');
    expect(unknown.code).toBe('ZZ');
    expect(unknown.currency).toBe('USD');
  });

  it('resolveCountryCode accepts ISO codes and country names', () => {
    expect(resolveCountryCode('NG')).toBe('NG');
    expect(resolveCountryCode('ng')).toBe('NG');
    expect(resolveCountryCode('Nigeria')).toBe('NG');
    expect(resolveCountryCode('Canada')).toBe('CA');
    expect(resolveCountryCode(null)).toBe('CA');
    expect(resolveCountryCode('Atlantis')).toBe('CA');
  });

  it('getCountriesByRegion includes every localized country', () => {
    const byRegion = getCountriesByRegion();
    const flattened = Object.values(byRegion).flat();
    expect(flattened).toHaveLength(allCodes.length);
    expect(Object.keys(byRegion).length).toBeGreaterThan(1);
  });

  it('retail tax types include paid/ITC labels for every localized country that levies one', () => {
    allCodes.forEach((code) => {
      const loc = COUNTRY_LOCALIZATIONS[code];
      loc.taxTypes.forEach((tax) => {
        const resolved = resolveRetailTaxType(tax);
        expect(resolved.paidName.length).toBeGreaterThan(0);
        expect(resolved.paidDescription.length).toBeGreaterThan(0);
        expect(['sales', 'purchases', 'both']).toContain(resolved.appliesTo);
      });
    });
  });

  it('Canada paid taxes distinguish recoverable GST/HST ITC from non-recoverable PST', () => {
    const paid = getRetailTaxTypes('CA', 'paid');
    expect(paid.map((t) => t.code).sort()).toEqual(['GST', 'HST', 'PST']);
    expect(paid.find((t) => t.code === 'GST')?.paidName).toMatch(/ITC/);
    expect(paid.find((t) => t.code === 'HST')?.paidName).toMatch(/ITC/);
    expect(paid.find((t) => t.code === 'PST')?.isRecoverable).toBe(false);
    expect(isRecoverableRetailTax('QST', 'CA', 'QC')).toBe(true);
    expect(isRecoverableRetailTax('PST-BC', 'CA', 'BC')).toBe(false);
  });

  it('every retail tax type has a paid rate label usable in pickers', () => {
    allCodes.forEach((code) => {
      getRetailTaxTypes(code, 'paid').forEach((tax) => {
        expect(tax.paidName).toMatch(/Paid|ITC|Input|Tax/);
        expect(tax.defaultRate).toBeGreaterThanOrEqual(0);
      });
    });
  });

  it('VAT countries expose Input VAT as the paid-side label', () => {
    const gb = getPrimaryRetailTaxType('GB');
    expect(gb?.code).toBe('VAT');
    expect(gb?.paidName).toMatch(/Input VAT/);
    expect(gb?.isRecoverable).toBe(true);
    expect(classifyRetailTaxFamily('VAT')).toBe('vat');
    expect(classifyRetailTaxFamily('IVA')).toBe('vat');
    expect(classifyRetailTaxFamily('SALES_TAX')).toBe('sales_tax');
  });

  it('Hong Kong profits tax is not a retail sales tax on purchases', () => {
    expect(getRetailTaxTypes('HK', 'paid')).toHaveLength(0);
    expect(getRetailTaxTypes('HK', 'collected')).toHaveLength(0);
  });

  it('getAllLocalizedCurrencies includes every country currency', () => {
    const currencies = getAllLocalizedCurrencies('NG');
    const uniqueCountryCurrencies = new Set(allCodes.map((code) => COUNTRY_LOCALIZATIONS[code].currency));
    expect(currencies.map((c) => c.code)).toEqual(expect.arrayContaining([...uniqueCountryCurrencies]));
    expect(currencies[0].code).toBe('NGN');
    expect(currencies.find((c) => c.code === 'USD')).toBeTruthy();
    expect(getAvailableCurrencies().length).toBe(uniqueCountryCurrencies.size);
  });
});
