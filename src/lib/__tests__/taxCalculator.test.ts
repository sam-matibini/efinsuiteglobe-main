import { describe, it, expect } from 'vitest';
import {
  calculateTaxes,
  getApplicableTaxCode,
  getCombinedTaxRate,
  formatTaxBreakdown,
  getCanadianTaxModel,
  requiresSeparatePstAccounting,
} from '../taxCalculator';

describe('Tax Calculator', () => {
  describe('calculateTaxes - Canadian split tax', () => {
    it('calculates GST-only for Alberta', () => {
      const result = calculateTaxes({ grossAmount: 100, taxRules: [], countryCode: 'CA', jurisdictionCode: 'AB' });
      expect(result.totalTax).toBe(5);
      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0].taxCode).toBe('GST');
    });

    it('calculates HST for Ontario at 13%', () => {
      const result = calculateTaxes({ grossAmount: 100, taxRules: [], countryCode: 'CA', jurisdictionCode: 'ON' });
      expect(result.totalTax).toBe(13);
      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0].taxCode).toBe('HST');
    });

    it('calculates GST+PST split for BC (5%+7%)', () => {
      const result = calculateTaxes({ grossAmount: 100, taxRules: [], countryCode: 'CA', jurisdictionCode: 'BC' });
      expect(result.totalTax).toBe(12);
      expect(result.taxes).toHaveLength(2);
      expect(result.taxes[0].taxCode).toBe('GST');
      expect(result.taxes[1].taxCode).toBe('PST-BC');
    });

    it('calculates GST+QST split for Quebec (5%+9.975%)', () => {
      const result = calculateTaxes({ grossAmount: 100, taxRules: [], countryCode: 'CA', jurisdictionCode: 'QC' });
      expect(result.totalTax).toBeCloseTo(14.98, 1);
      expect(result.taxes).toHaveLength(2);
      expect(result.taxes[1].taxCode).toBe('QST');
    });

    it('calculates tax-inclusive back-calculation for ON HST', () => {
      const result = calculateTaxes({ grossAmount: 113, taxRules: [], isInclusive: true, countryCode: 'CA', jurisdictionCode: 'ON' });
      expect(result.taxableAmount).toBe(100);
      expect(result.totalTax).toBe(13);
    });
  });

  describe('calculateTaxes - legacy rules', () => {
    it('calculates compound tax correctly', () => {
      const rules = [
        { id: '1', code: 'TAX1', name: 'Tax 1', rate: 10, isRecoverable: true, isCompound: false },
        { id: '2', code: 'TAX2', name: 'Tax 2', rate: 5, isRecoverable: true, isCompound: true },
      ];
      const result = calculateTaxes({ grossAmount: 100, taxRules: rules });
      expect(result.taxes[0].amount).toBe(10); // 10% of 100
      expect(result.taxes[1].amount).toBe(5.5); // 5% of (100 + 10)
    });

    it('calculates non-compound parallel taxes', () => {
      const rules = [
        { id: '1', code: 'TAX1', name: 'Tax 1', rate: 5, isRecoverable: true, isCompound: false },
        { id: '2', code: 'TAX2', name: 'Tax 2', rate: 7, isRecoverable: true, isCompound: false },
      ];
      const result = calculateTaxes({ grossAmount: 100, taxRules: rules });
      expect(result.totalTax).toBe(12);
    });
  });

  describe('getApplicableTaxCode', () => {
    it('returns HST for Ontario', () => {
      expect(getApplicableTaxCode('CA', 'ON')).toBe('HST');
    });

    it('returns GST+PST for BC', () => {
      expect(getApplicableTaxCode('CA', 'BC')).toBe('GST+PST');
    });

    it('returns GST+QST for Quebec', () => {
      expect(getApplicableTaxCode('CA', 'QC')).toBe('GST+QST');
    });

    it('returns GST for Alberta', () => {
      expect(getApplicableTaxCode('CA', 'AB')).toBe('GST');
    });

    it('returns EXEMPT for US no-tax states', () => {
      expect(getApplicableTaxCode('US', 'OR')).toBe('EXEMPT');
      expect(getApplicableTaxCode('US', 'DE')).toBe('EXEMPT');
    });

    it('returns STATE-SALES for US taxable states', () => {
      expect(getApplicableTaxCode('US', 'NY')).toBe('STATE-SALES');
    });
  });

  describe('getCombinedTaxRate', () => {
    it('sums non-compound rates', () => {
      const rules = [
        { id: '1', code: 'A', name: 'A', rate: 5, isRecoverable: true, isCompound: false },
        { id: '2', code: 'B', name: 'B', rate: 7, isRecoverable: true, isCompound: false },
      ];
      expect(getCombinedTaxRate(rules)).toBe(12);
    });

    it('handles mixed compound/non-compound', () => {
      const rules = [
        { id: '1', code: 'A', name: 'A', rate: 10, isRecoverable: true, isCompound: false },
        { id: '2', code: 'B', name: 'B', rate: 5, isRecoverable: true, isCompound: true },
      ];
      const result = getCombinedTaxRate(rules);
      expect(result).toBeCloseTo(15.5, 1);
    });
  });

  describe('formatTaxBreakdown', () => {
    it('returns "No tax" for empty taxes', () => {
      expect(formatTaxBreakdown({ grossAmount: 100, taxableAmount: 100, taxes: [], totalTax: 0, netAmount: 100 })).toBe('No tax');
    });

    it('formats single tax', () => {
      const calc = { grossAmount: 113, taxableAmount: 100, taxes: [{ taxTypeId: '1', taxCode: 'HST', taxName: 'HST', rate: 13, amount: 13, isRecoverable: true }], totalTax: 13, netAmount: 100 };
      expect(formatTaxBreakdown(calc)).toBe('HST 13%');
    });

    it('formats multi-tax with combined mode', () => {
      const calc = {
        grossAmount: 112, taxableAmount: 100, totalTax: 12, netAmount: 100,
        taxes: [
          { taxTypeId: '1', taxCode: 'GST', taxName: 'GST', rate: 5, amount: 5, isRecoverable: true },
          { taxTypeId: '2', taxCode: 'PST', taxName: 'PST', rate: 7, amount: 7, isRecoverable: false },
        ],
      };
      expect(formatTaxBreakdown(calc, true)).toBe('Combined 12%');
      expect(formatTaxBreakdown(calc, false)).toBe('GST 5% + PST 7%');
    });
  });

  describe('getCanadianTaxModel', () => {
    it('returns HST for Ontario', () => expect(getCanadianTaxModel('ON')).toBe('HST'));
    it('returns GST_PST for BC', () => expect(getCanadianTaxModel('BC')).toBe('GST_PST'));
    it('returns GST_ONLY for Alberta', () => expect(getCanadianTaxModel('AB')).toBe('GST_ONLY'));
    it('returns GST_ONLY for unknown', () => expect(getCanadianTaxModel('XX')).toBe('GST_ONLY'));
  });

  describe('requiresSeparatePstAccounting', () => {
    it('returns true for BC', () => expect(requiresSeparatePstAccounting('BC')).toBe(true));
    it('returns true for QC', () => expect(requiresSeparatePstAccounting('QC')).toBe(true));
    it('returns false for ON', () => expect(requiresSeparatePstAccounting('ON')).toBe(false));
    it('returns false for AB', () => expect(requiresSeparatePstAccounting('AB')).toBe(false));
  });
});
