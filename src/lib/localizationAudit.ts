// Localization Audit - Verify formulas and rates for all supported countries
// This module provides validation functions to audit payroll and tax calculations

import { COUNTRY_PAYROLL_CONFIG, getCountryPayrollConfig } from '@/data/globalPayrollDefaults';
import { PAYROLL_LOCALIZATIONS, getPayrollLocalization } from '@/data/payrollLocalization';
import { COUNTRY_LOCALIZATIONS, getCountryLocalization } from '@/data/countryLocalizations';

export interface AuditResult {
  category: string;
  item: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  expected?: string | number;
  actual?: string | number;
}

export interface CountryAuditReport {
  countryCode: string;
  countryName: string;
  timestamp: string;
  results: AuditResult[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
  };
}

/**
 * Audit payroll configuration for a country
 */
export function auditPayrollConfig(countryCode: string): AuditResult[] {
  const results: AuditResult[] = [];
  const config = getCountryPayrollConfig(countryCode);
  const localization = getPayrollLocalization(countryCode);
  
  // Verify basic configuration exists
  results.push({
    category: 'Configuration',
    item: 'Payroll Config',
    status: config ? 'pass' : 'fail',
    message: config ? 'Payroll configuration found' : 'Missing payroll configuration',
  });

  // Verify tax form name
  results.push({
    category: 'Tax Forms',
    item: 'Tax Form Name',
    status: config.taxFormName ? 'pass' : 'fail',
    message: config.taxFormName ? `Tax form: ${config.taxFormName}` : 'Missing tax form name',
  });

  // Verify national ID configuration
  results.push({
    category: 'Identity',
    item: 'National ID Label',
    status: config.nationalIdLabel ? 'pass' : 'fail',
    message: config.nationalIdLabel ? `ID type: ${config.nationalIdLabel}` : 'Missing national ID label',
  });

  // Verify deductions exist
  const hasDeductions = config.federalDeductions.length > 0;
  results.push({
    category: 'Deductions',
    item: 'Federal Deductions',
    status: hasDeductions ? 'pass' : 'warn',
    message: hasDeductions 
      ? `${config.federalDeductions.length} federal deductions configured`
      : 'No federal deductions configured',
  });

  // Validate specific deduction rates by country
  switch (countryCode) {
    case 'CA':
      validateCanadianRates(config, results);
      break;
    case 'US':
      validateUSRates(config, results);
      break;
    case 'ZM':
      validateZambianRates(config, results);
      break;
    case 'KE':
      validateKenyanRates(config, results);
      break;
    case 'BI':
      validateBurundianRates(config, results);
      break;
  }

  // Verify currency configuration
  const countryLoc = getCountryLocalization(countryCode);
  results.push({
    category: 'Currency',
    item: 'Currency Code',
    status: countryLoc.currency === config.currencyCode ? 'pass' : 'warn',
    message: `Currency: ${config.currencyCode}`,
    expected: countryLoc.currency,
    actual: config.currencyCode,
  });

  return results;
}

/**
 * Validate Canadian payroll rates (2025 - Source: CRA T4032)
 */
function validateCanadianRates(config: any, results: AuditResult[]): void {
  // CPP Rate check (2025: 5.95% - CRA T4032)
  const cppDeduction = config.federalDeductions.find((d: any) => d.code === 'CPP');
  if (cppDeduction) {
    const expectedRate = 5.95;
    results.push({
      category: 'Canada - CPP',
      item: 'CPP Employee Rate',
      status: cppDeduction.employeeRate === expectedRate ? 'pass' : 'warn',
      message: `CPP rate: ${cppDeduction.employeeRate}% (CRA 2025)`,
      expected: expectedRate,
      actual: cppDeduction.employeeRate,
    });

    // CPP Maximum pensionable earnings (2025: $71,300 - CRA)
    const expectedMax = 71300;
    results.push({
      category: 'Canada - CPP',
      item: 'CPP Max Pensionable',
      status: cppDeduction.maxEarnings === expectedMax ? 'pass' : 'warn',
      message: `Max pensionable: $${cppDeduction.maxEarnings} (CRA 2025)`,
      expected: expectedMax,
      actual: cppDeduction.maxEarnings,
    });
  }

  // EI Rate check (2025: 1.64% - CRA)
  const eiDeduction = config.federalDeductions.find((d: any) => d.code === 'EI');
  if (eiDeduction) {
    const expectedRate = 1.64;
    results.push({
      category: 'Canada - EI',
      item: 'EI Employee Rate',
      status: eiDeduction.employeeRate === expectedRate ? 'pass' : 'warn',
      message: `EI rate: ${eiDeduction.employeeRate}% (CRA 2025)`,
      expected: expectedRate,
      actual: eiDeduction.employeeRate,
    });
  }

  // Federal BPA (2025: $16,129 - CRA TD1)
  const bpaCredit = config.federalTaxCredits.find((c: any) => c.code === 'BPA');
  if (bpaCredit) {
    const expectedBPA = 16129;
    results.push({
      category: 'Canada - Tax Credits',
      item: 'Federal BPA',
      status: bpaCredit.defaultAmount === expectedBPA ? 'pass' : 'warn',
      message: `Federal BPA: $${bpaCredit.defaultAmount} (CRA 2025)`,
      expected: expectedBPA,
      actual: bpaCredit.defaultAmount,
    });
  }
}

/**
 * Validate US payroll rates (2025)
 */
function validateUSRates(config: any, results: AuditResult[]): void {
  // Social Security Rate (6.2%)
  const ssDeduction = config.federalDeductions.find((d: any) => d.code === 'FICA-SS');
  if (ssDeduction) {
    const expectedRate = 6.2;
    results.push({
      category: 'US - FICA',
      item: 'Social Security Rate',
      status: ssDeduction.employeeRate === expectedRate ? 'pass' : 'warn',
      message: `SS rate: ${ssDeduction.employeeRate}%`,
      expected: expectedRate,
      actual: ssDeduction.employeeRate,
    });

    // SS Wage Base (2025: $176,100)
    const expectedMax = 176100;
    results.push({
      category: 'US - FICA',
      item: 'SS Wage Base',
      status: ssDeduction.maxEarnings === expectedMax ? 'pass' : 'warn',
      message: `Wage base: $${ssDeduction.maxEarnings}`,
      expected: expectedMax,
      actual: ssDeduction.maxEarnings,
    });
  }

  // Medicare Rate (1.45%)
  const medDeduction = config.federalDeductions.find((d: any) => d.code === 'FICA-MED');
  if (medDeduction) {
    const expectedRate = 1.45;
    results.push({
      category: 'US - FICA',
      item: 'Medicare Rate',
      status: medDeduction.employeeRate === expectedRate ? 'pass' : 'warn',
      message: `Medicare rate: ${medDeduction.employeeRate}%`,
      expected: expectedRate,
      actual: medDeduction.employeeRate,
    });
  }
}

/**
 * Validate Zambian payroll rates (2025)
 */
function validateZambianRates(config: any, results: AuditResult[]): void {
  // NAPSA Rate (5% employee / 5% employer)
  const napsaDeduction = config.federalDeductions.find((d: any) => d.code === 'NAPSA');
  if (napsaDeduction) {
    results.push({
      category: 'Zambia - NAPSA',
      item: 'NAPSA Employee Rate',
      status: napsaDeduction.employeeRate === 5 ? 'pass' : 'warn',
      message: `NAPSA rate: ${napsaDeduction.employeeRate}%`,
      expected: 5,
      actual: napsaDeduction.employeeRate,
    });
  }

  // NHIMA Rate (1% employee / 1% employer)
  const nhimaDeduction = config.federalDeductions.find((d: any) => d.code === 'NHIMA');
  if (nhimaDeduction) {
    results.push({
      category: 'Zambia - NHIMA',
      item: 'NHIMA Employee Rate',
      status: nhimaDeduction.employeeRate === 1 ? 'pass' : 'warn',
      message: `NHIMA rate: ${nhimaDeduction.employeeRate}%`,
      expected: 1,
      actual: nhimaDeduction.employeeRate,
    });
  }
}

/**
 * Validate Kenyan payroll rates (2025)
 */
function validateKenyanRates(config: any, results: AuditResult[]): void {
  // NSSF Tier I
  const nssfT1 = config.federalDeductions.find((d: any) => d.code === 'NSSF-TI');
  if (nssfT1) {
    results.push({
      category: 'Kenya - NSSF',
      item: 'NSSF Tier I Rate',
      status: nssfT1.employeeRate === 6 ? 'pass' : 'warn',
      message: `NSSF T1 rate: ${nssfT1.employeeRate}%`,
      expected: 6,
      actual: nssfT1.employeeRate,
    });
  }

  // SHIF (2.75%)
  const shifDeduction = config.federalDeductions.find((d: any) => d.code === 'SHIF');
  if (shifDeduction) {
    results.push({
      category: 'Kenya - SHIF',
      item: 'SHIF Rate',
      status: shifDeduction.employeeRate === 2.75 ? 'pass' : 'warn',
      message: `SHIF rate: ${shifDeduction.employeeRate}%`,
      expected: 2.75,
      actual: shifDeduction.employeeRate,
    });
  }

  // Affordable Housing Levy (1.5%)
  const ahlDeduction = config.federalDeductions.find((d: any) => d.code === 'AHL');
  if (ahlDeduction) {
    results.push({
      category: 'Kenya - AHL',
      item: 'Housing Levy Rate',
      status: ahlDeduction.employeeRate === 1.5 ? 'pass' : 'warn',
      message: `AHL rate: ${ahlDeduction.employeeRate}%`,
      expected: 1.5,
      actual: ahlDeduction.employeeRate,
    });
  }
}

/**
 * Validate Burundian payroll rates (2025)
 */
function validateBurundianRates(config: any, results: AuditResult[]): void {
  // INSS Pension (4% employee / 6% employer)
  const inssDeduction = config.federalDeductions.find((d: any) => d.code === 'INSS-PEN');
  if (inssDeduction) {
    results.push({
      category: 'Burundi - INSS',
      item: 'INSS Employee Rate',
      status: inssDeduction.employeeRate === 4 ? 'pass' : 'warn',
      message: `INSS rate: ${inssDeduction.employeeRate}%`,
      expected: 4,
      actual: inssDeduction.employeeRate,
    });
  }

  // MFP Health (3% employee / 3% employer)
  const mfpDeduction = config.federalDeductions.find((d: any) => d.code === 'MFP');
  if (mfpDeduction) {
    results.push({
      category: 'Burundi - MFP',
      item: 'MFP Employee Rate',
      status: mfpDeduction.employeeRate === 3 ? 'pass' : 'warn',
      message: `MFP rate: ${mfpDeduction.employeeRate}%`,
      expected: 3,
      actual: mfpDeduction.employeeRate,
    });
  }
}

/**
 * Audit tax configuration for a country
 */
export function auditTaxConfig(countryCode: string): AuditResult[] {
  const results: AuditResult[] = [];
  const localization = getCountryLocalization(countryCode);

  // Verify tax types exist
  results.push({
    category: 'Tax Configuration',
    item: 'Tax Types',
    status: localization.taxTypes.length > 0 ? 'pass' : 'warn',
    message: `${localization.taxTypes.length} tax types configured`,
  });

  // Validate tax rates by country
  switch (countryCode) {
    case 'CA':
      // HST rates
      const hst = localization.taxTypes.find(t => t.code === 'HST');
      if (hst) {
        results.push({
          category: 'Canada - HST',
          item: 'Default HST Rate',
          status: hst.defaultRate === 13 ? 'pass' : 'warn',
          message: `HST rate: ${hst.defaultRate}%`,
          expected: 13,
          actual: hst.defaultRate,
        });
      }
      break;
    case 'ZM':
      // VAT rate (16%)
      const zmVat = localization.taxTypes.find(t => t.code === 'VAT');
      if (zmVat) {
        results.push({
          category: 'Zambia - VAT',
          item: 'VAT Rate',
          status: zmVat.defaultRate === 16 ? 'pass' : 'warn',
          message: `VAT rate: ${zmVat.defaultRate}%`,
          expected: 16,
          actual: zmVat.defaultRate,
        });
      }
      break;
    case 'KE':
      // VAT rate (16%)
      const keVat = localization.taxTypes.find(t => t.code === 'VAT');
      if (keVat) {
        results.push({
          category: 'Kenya - VAT',
          item: 'VAT Rate',
          status: keVat.defaultRate === 16 ? 'pass' : 'warn',
          message: `VAT rate: ${keVat.defaultRate}%`,
          expected: 16,
          actual: keVat.defaultRate,
        });
      }
      break;
    case 'BI':
      // VAT rate (18%)
      const biVat = localization.taxTypes.find(t => t.code === 'VAT');
      if (biVat) {
        results.push({
          category: 'Burundi - TVA',
          item: 'VAT Rate',
          status: biVat.defaultRate === 18 ? 'pass' : 'warn',
          message: `TVA rate: ${biVat.defaultRate}%`,
          expected: 18,
          actual: biVat.defaultRate,
        });
      }
      break;
  }

  return results;
}

/**
 * Run full audit for all supported countries
 */
export function runFullAudit(): CountryAuditReport[] {
  const countryCodes = Object.keys(COUNTRY_PAYROLL_CONFIG);
  const reports: CountryAuditReport[] = [];

  for (const countryCode of countryCodes) {
    const payrollResults = auditPayrollConfig(countryCode);
    const taxResults = auditTaxConfig(countryCode);
    const allResults = [...payrollResults, ...taxResults];
    
    const localization = getCountryLocalization(countryCode);
    
    const summary = {
      passed: allResults.filter(r => r.status === 'pass').length,
      warnings: allResults.filter(r => r.status === 'warn').length,
      failed: allResults.filter(r => r.status === 'fail').length,
    };

    reports.push({
      countryCode,
      countryName: localization.name,
      timestamp: new Date().toISOString(),
      results: allResults,
      summary,
    });
  }

  return reports;
}

/**
 * Get a summary of audit results
 */
export function getAuditSummary(): string {
  const reports = runFullAudit();
  const lines: string[] = ['=== Localization Audit Summary ===\n'];

  for (const report of reports) {
    lines.push(`\n${report.countryName} (${report.countryCode}):`);
    lines.push(`  ✓ Passed: ${report.summary.passed}`);
    lines.push(`  ⚠ Warnings: ${report.summary.warnings}`);
    lines.push(`  ✗ Failed: ${report.summary.failed}`);
  }

  return lines.join('\n');
}
