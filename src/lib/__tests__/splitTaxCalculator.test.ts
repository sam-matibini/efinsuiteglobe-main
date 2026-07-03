import { describe, it, expect } from 'vitest';
import {
  calculateSplitTaxes,
  calculateLineTaxes,
  aggregateLineTaxes,
  formatTaxBreakdown,
  getTaxDisplayLabel,
  PROVINCE_TAX_CONFIG,
} from '../splitTaxCalculator';

describe('Split Tax Calculator', () => {
  describe('PROVINCE_TAX_CONFIG', () => {
    it('has entries for all 13 provinces/territories', () => {
      const expected = ['ON', 'NB', 'NL', 'NS', 'PE', 'BC', 'SK', 'MB', 'QC', 'AB', 'NT', 'NU', 'YT'];
      expected.forEach(code => {
        expect(PROVINCE_TAX_CONFIG[code]).toBeDefined();
      });
      expect(Object.keys(PROVINCE_TAX_CONFIG)).toHaveLength(13);
    });
  });

  describe('calculateSplitTaxes', () => {
    it('HST model (ON): single combined tax', () => {
      const result = calculateSplitTaxes(100, 'ON');
      expect(result.taxModel).toBe('HST');
      expect(result.taxes).toHaveLength(1);
      expect(result.taxes[0].type).toBe('HST');
      expect(result.totalTax).toBe(13);
      expect(result.grossAmount).toBe(113);
    });

    it('GST_PST model (BC): two separate taxes', () => {
      const result = calculateSplitTaxes(100, 'BC');
      expect(result.taxModel).toBe('GST_PST');
      expect(result.taxes).toHaveLength(2);
      expect(result.taxes[0].type).toBe('GST');
      expect(result.taxes[0].amount).toBe(5);
      expect(result.taxes[1].type).toBe('PST');
      expect(result.taxes[1].amount).toBe(7);
    });

    it('GST_ONLY model (AB): GST only', () => {
      const result = calculateSplitTaxes(100, 'AB');
      expect(result.taxModel).toBe('GST_ONLY');
      expect(result.taxes).toHaveLength(1);
      expect(result.totalTax).toBe(5);
    });

    it('tax-inclusive reverse calculation is accurate', () => {
      const result = calculateSplitTaxes(113, 'ON', true);
      expect(result.taxableAmount).toBe(100);
      expect(result.totalTax).toBe(13);
      expect(result.grossAmount).toBe(113);
    });

    it('QC uses QST type and Revenu Quebec authority', () => {
      const result = calculateSplitTaxes(100, 'QC');
      expect(result.taxes[1].type).toBe('QST');
      expect(result.taxes[1].authority).toBe('Revenu Quebec');
    });
  });

  describe('calculateLineTaxes', () => {
    it('exempt items return zero tax', () => {
      const result = calculateLineTaxes(100, 'ON', undefined, true);
      expect(result.totalTax).toBe(0);
      expect(result.taxes).toHaveLength(0);
    });

    it('zero-rated items return zero tax', () => {
      const result = calculateLineTaxes(100, 'ON', undefined, false, true);
      expect(result.totalTax).toBe(0);
    });

    it('applies override rates', () => {
      const result = calculateLineTaxes(100, 'ON', { hstRate: 15 });
      expect(result.taxes[0].rate).toBe(15);
      expect(result.taxes[0].amount).toBe(15);
    });
  });

  describe('aggregateLineTaxes', () => {
    it('sums GST, PST, HST separately', () => {
      const line1 = calculateSplitTaxes(100, 'BC');
      const line2 = calculateSplitTaxes(200, 'BC');
      const agg = aggregateLineTaxes([line1, line2]);
      expect(agg.gstTotal).toBe(15); // 5+10
      expect(agg.pstTotal).toBe(21); // 7+14
      expect(agg.subtotal).toBe(300);
      expect(agg.grandTotal).toBe(336);
    });
  });

  describe('formatTaxBreakdown', () => {
    it('returns "No Tax" for empty taxes', () => {
      const calc = calculateLineTaxes(100, 'ON', undefined, true);
      expect(formatTaxBreakdown(calc)).toBe('No Tax');
    });

    it('shows combined display', () => {
      const calc = calculateSplitTaxes(100, 'BC');
      expect(formatTaxBreakdown(calc, true)).toBe('Combined (12%)');
    });

    it('shows separate display', () => {
      const calc = calculateSplitTaxes(100, 'BC');
      expect(formatTaxBreakdown(calc, false)).toBe('GST 5% + PST-BC 7%');
    });
  });

  describe('getTaxDisplayLabel', () => {
    it('ON → HST 13%', () => expect(getTaxDisplayLabel('ON')).toBe('HST 13%'));
    it('BC → GST 5% + PST 7%', () => expect(getTaxDisplayLabel('BC')).toBe('GST 5% + PST 7%'));
    it('QC → GST 5% + QST 9.975%', () => expect(getTaxDisplayLabel('QC')).toBe('GST 5% + QST 9.975%'));
    it('AB → GST 5%', () => expect(getTaxDisplayLabel('AB')).toBe('GST 5%'));
  });
});
