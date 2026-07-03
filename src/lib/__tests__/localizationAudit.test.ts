import { describe, it, expect } from 'vitest';
import { COUNTRY_PAYROLL_CONFIG, getCountryPayrollConfig } from '@/data/globalPayrollDefaults';
import { COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';

/**
 * Localization Audit Tests
 * Validates payroll rates and tax configs against known 2025 values.
 */

describe('Payroll Config Audit', () => {
  it('CA: CPP 5.95%, EI 1.64%, BPA $16,129', () => {
    const ca = getCountryPayrollConfig('CA');
    const cpp = ca.federalDeductions.find(d => d.code === 'CPP');
    const ei = ca.federalDeductions.find(d => d.code === 'EI');
    const bpa = ca.federalTaxCredits.find(c => c.code === 'BPA');
    expect(cpp?.employeeRate).toBe(5.95);
    expect(ei?.employeeRate).toBe(1.64);
    expect(bpa?.defaultAmount).toBe(16129);
  });

  it('US: SS 6.2%, Medicare 1.45%', () => {
    const us = getCountryPayrollConfig('US');
    const ss = us.federalDeductions.find(d => d.code === 'FICA-SS');
    const med = us.federalDeductions.find(d => d.code === 'FICA-MED');
    expect(ss?.employeeRate).toBe(6.2);
    expect(med?.employeeRate).toBe(1.45);
  });

  it('ZM: NAPSA 5%, NHIMA 1%', () => {
    const zm = getCountryPayrollConfig('ZM');
    const napsa = zm.federalDeductions.find(d => d.code === 'NAPSA');
    const nhima = zm.federalDeductions.find(d => d.code === 'NHIMA');
    expect(napsa?.employeeRate).toBe(5);
    expect(nhima?.employeeRate).toBe(1);
  });

  it('KE: NSSF 6%, SHIF 2.75%, AHL 1.5%', () => {
    const ke = getCountryPayrollConfig('KE');
    const nssf = ke.federalDeductions.find(d => d.code === 'NSSF-TI');
    const shif = ke.federalDeductions.find(d => d.code === 'SHIF');
    const ahl = ke.federalDeductions.find(d => d.code === 'AHL');
    expect(nssf?.employeeRate).toBe(6);
    expect(shif?.employeeRate).toBe(2.75);
    expect(ahl?.employeeRate).toBe(1.5);
  });

  it('BI: INSS 4%, MFP 3%', () => {
    const bi = getCountryPayrollConfig('BI');
    const inss = bi.federalDeductions.find(d => d.code === 'INSS-PEN');
    const mfp = bi.federalDeductions.find(d => d.code === 'MFP');
    expect(inss?.employeeRate).toBe(4);
    expect(mfp?.employeeRate).toBe(3);
  });
});

describe('Tax Config Audit', () => {
  it('CA: HST 13%', () => {
    const ca = COUNTRY_LOCALIZATIONS['CA'];
    const hst = ca.taxTypes.find(t => t.code === 'HST');
    expect(hst?.defaultRate).toBe(13);
  });

  it('ZM: VAT 16%', () => {
    const zm = COUNTRY_LOCALIZATIONS['ZM'];
    const vat = zm.taxTypes.find(t => t.code === 'VAT');
    expect(vat?.defaultRate).toBe(16);
  });

  it('KE: VAT 16%', () => {
    const ke = COUNTRY_LOCALIZATIONS['KE'];
    const vat = ke.taxTypes.find(t => t.code === 'VAT');
    expect(vat?.defaultRate).toBe(16);
  });

  it('BI: VAT 18%', () => {
    const bi = COUNTRY_LOCALIZATIONS['BI'];
    const vat = bi.taxTypes.find(t => t.code === 'VAT');
    expect(vat?.defaultRate).toBe(18);
  });
});

describe('Full Audit', () => {
  it('all configured countries have valid payroll configs', () => {
    const countryCodes = Object.keys(COUNTRY_PAYROLL_CONFIG);
    countryCodes.forEach(code => {
      const config = getCountryPayrollConfig(code);
      expect(config.taxFormName).toBeTruthy();
      expect(config.currencyCode).toBeTruthy();
      expect(config.federalDeductions.length).toBeGreaterThan(0);
    });
  });
});
