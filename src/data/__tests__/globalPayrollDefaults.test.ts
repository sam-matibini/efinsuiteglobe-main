import { describe, it, expect } from 'vitest';
import { COUNTRY_PAYROLL_CONFIG, getCountryPayrollConfig } from '../globalPayrollDefaults';

const allCodes = Object.keys(COUNTRY_PAYROLL_CONFIG);

describe('Global Payroll Defaults', () => {
  it('all country configs have a taxFormName', () => {
    allCodes.forEach(code => {
      expect(COUNTRY_PAYROLL_CONFIG[code].taxFormName).toBeTruthy();
    });
  });

  it('all country configs have a currencyCode', () => {
    allCodes.forEach(code => {
      expect(COUNTRY_PAYROLL_CONFIG[code].currencyCode).toBeTruthy();
    });
  });

  it('Canada CPP max earnings is $71,300', () => {
    const cpp = COUNTRY_PAYROLL_CONFIG['CA'].federalDeductions.find(d => d.code === 'CPP');
    expect(cpp?.maxEarnings).toBe(71300);
  });

  it('Canada EI rate is 1.64%', () => {
    const ei = COUNTRY_PAYROLL_CONFIG['CA'].federalDeductions.find(d => d.code === 'EI');
    expect(ei?.employeeRate).toBe(1.64);
  });

  it('US FICA-SS rate is 6.2%', () => {
    const ss = COUNTRY_PAYROLL_CONFIG['US'].federalDeductions.find(d => d.code === 'FICA-SS');
    expect(ss?.employeeRate).toBe(6.2);
  });

  it('US FICA-SS wage base is $176,100', () => {
    const ss = COUNTRY_PAYROLL_CONFIG['US'].federalDeductions.find(d => d.code === 'FICA-SS');
    expect(ss?.maxEarnings).toBe(176100);
  });

  it('getCountryPayrollConfig returns valid config for all known codes', () => {
    allCodes.forEach(code => {
      const config = getCountryPayrollConfig(code);
      expect(config.taxFormName).toBeTruthy();
      expect(config.currencyCode).toBeTruthy();
    });
  });

  it('all deduction rates are between 0 and 100', () => {
    allCodes.forEach(code => {
      const config = COUNTRY_PAYROLL_CONFIG[code];
      [...config.federalDeductions, ...config.jurisdictionalDeductions].forEach(d => {
        expect(d.employeeRate).toBeGreaterThanOrEqual(0);
        expect(d.employeeRate).toBeLessThanOrEqual(100);
      });
    });
  });
});
