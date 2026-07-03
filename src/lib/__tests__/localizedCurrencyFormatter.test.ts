import { describe, it, expect } from 'vitest';
import { getLocaleForCountry, getCountryLocalization } from '@/data/countryLocalizations';

describe('Localized Currency Formatter', () => {
  describe('getLocaleForCountry', () => {
    it('returns en-CA for CA', () => {
      expect(getLocaleForCountry('CA')).toBe('en-CA');
    });

    it('returns en-US for US', () => {
      expect(getLocaleForCountry('US')).toBe('en-US');
    });

    it('returns a valid locale for BI (Burundi)', () => {
      const locale = getLocaleForCountry('BI');
      expect(typeof locale).toBe('string');
      expect(locale.length).toBeGreaterThan(0);
    });
  });

  describe('getCountryLocalization', () => {
    it('returns CAD for Canada', () => {
      const loc = getCountryLocalization('CA');
      expect(loc.currency).toBe('CAD');
      expect(loc.currencySymbol).toBe('$');
    });

    it('returns USD for US', () => {
      const loc = getCountryLocalization('US');
      expect(loc.currency).toBe('USD');
    });
  });

  describe('Intl.NumberFormat integration', () => {
    it('formats CAD correctly', () => {
      const formatted = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(1234.56);
      expect(formatted).toContain('1,234.56');
    });

    it('formats USD correctly', () => {
      const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(1234.56);
      expect(formatted).toContain('1,234.56');
    });

    it('formats percentage correctly', () => {
      const formatted = new Intl.NumberFormat('en-CA', { style: 'percent', minimumFractionDigits: 2 }).format(0.1325);
      expect(formatted).toContain('13.25');
    });
  });
});
