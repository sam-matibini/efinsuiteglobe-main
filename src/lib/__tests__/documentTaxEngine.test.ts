import { describe, it, expect } from 'vitest';
import {
  computeDocumentTaxes,
  splitPurchaseTaxPosting,
  resolveRetailTaxGlAccount,
} from '../documentTaxEngine';
import type { SalesTaxSettings } from '@/hooks/useSalesTax';

const caSettings = {
  collect_gst: true,
  collect_hst: true,
  collect_pst: true,
  collect_vat: false,
  collect_sales_tax: false,
  gst_rate: 5,
  pst_rate: 7,
  hst_rate: 13,
  claim_input_tax: true,
  claim_gst_hst_itc: true,
  claim_pst_paid: true,
  gst_paid_account_id: 'gst-itc',
  pst_paid_account_id: 'pst-paid',
  vat_paid_account_id: null,
} as Partial<SalesTaxSettings>;

describe('documentTaxEngine', () => {
  it('splits Canadian GST+PST paid and marks PST as non-recoverable', () => {
    const result = computeDocumentTaxes({
      countryCode: 'CA',
      jurisdictionCode: 'BC',
      amount: 100,
      direction: 'paid',
      settings: caSettings,
    });
    expect(result.totalTax).toBe(12);
    expect(result.taxes).toHaveLength(2);
    expect(result.taxes[0].taxType).toBe('GST');
    expect(result.taxes[0].isRecoverable).toBe(true);
    expect(result.taxes[0].taxName).toMatch(/ITC/);
    expect(result.taxes[1].taxType).toBe('PST');
    expect(result.taxes[1].isRecoverable).toBe(false);
    expect(result.recoverableTax).toBe(5);
    expect(result.nonRecoverableTax).toBe(7);
  });

  it('treats Quebec QST paid as recoverable ITR', () => {
    const result = computeDocumentTaxes({
      countryCode: 'CA',
      jurisdictionCode: 'QC',
      amount: 100,
      direction: 'paid',
      settings: caSettings,
    });
    const qst = result.taxes.find((t) => t.taxType === 'QST');
    expect(qst?.isRecoverable).toBe(true);
    expect(result.recoverableTax).toBeCloseTo(result.totalTax, 2);
  });

  it('does not claim GST/HST ITC when the setting is off', () => {
    const result = computeDocumentTaxes({
      countryCode: 'CA',
      jurisdictionCode: 'ON',
      amount: 100,
      direction: 'paid',
      settings: { ...caSettings, claim_gst_hst_itc: false },
    });
    expect(result.taxes[0].taxType).toBe('HST');
    expect(result.taxes[0].isRecoverable).toBe(false);
    expect(result.recoverableTax).toBe(0);
  });

  it('computes Input VAT paid for a VAT country', () => {
    const result = computeDocumentTaxes({
      countryCode: 'GB',
      amount: 100,
      direction: 'paid',
      settings: {
        collect_vat: true,
        vat_rate: 20,
        claim_input_tax: true,
        vat_paid_account_id: 'vat-input',
      } as Partial<SalesTaxSettings>,
    });
    expect(result.totalTax).toBe(20);
    expect(result.taxes[0].isRecoverable).toBe(true);
    expect(result.taxes[0].taxName).toMatch(/Input VAT|VAT Paid/);
    expect(result.taxes[0].glAccountId).toBe('vat-input');
  });

  it('treats US sales/use tax paid as non-recoverable', () => {
    const result = computeDocumentTaxes({
      countryCode: 'US',
      jurisdictionCode: 'NY',
      amount: 100,
      direction: 'paid',
      settings: {
        collect_sales_tax: true,
        sales_tax_rate: 8,
        claim_input_tax: true,
      } as Partial<SalesTaxSettings>,
    });
    expect(result.totalTax).toBe(8);
    expect(result.taxes[0].isRecoverable).toBe(false);
    expect(result.nonRecoverableTax).toBe(8);
  });

  it('honors an explicit line rate override', () => {
    const result = computeDocumentTaxes({
      countryCode: 'NG',
      amount: 200,
      direction: 'paid',
      taxRateOverride: 7.5,
    });
    expect(result.taxableAmount).toBe(200);
    expect(result.totalTax).toBe(15);
    expect(result.taxes[0].isRecoverable).toBe(true);
  });

  it('persists a 0% GST/HST line so zero-rated sales reach the tax engine', () => {
    const result = computeDocumentTaxes({
      countryCode: 'CA',
      jurisdictionCode: 'ON',
      amount: 400,
      direction: 'collected',
      taxRateOverride: 0,
      settings: caSettings,
    });
    expect(result.taxes).toHaveLength(1);
    expect(result.taxes[0].taxAmount).toBe(0);
    expect(result.taxes[0].taxableAmount).toBe(400);
    expect(result.totalTax).toBe(0);
  });

  it('splits purchase posting into recoverable vs expense', () => {
    const computed = computeDocumentTaxes({
      countryCode: 'CA',
      jurisdictionCode: 'BC',
      amount: 100,
      direction: 'paid',
      settings: caSettings,
    });
    const split = splitPurchaseTaxPosting(computed.taxes);
    expect(split.recoverableTotal).toBe(5);
    expect(split.nonRecoverableTotal).toBe(7);
  });

  it('resolves VAT paid accounts before falling back to GST paid', () => {
    expect(
      resolveRetailTaxGlAccount('VAT', 'paid', {
        gstPaidAccountId: 'gst',
        vatPaidAccountId: 'vat',
      }),
    ).toBe('vat');
    expect(
      resolveRetailTaxGlAccount('HST', 'paid', {
        gstPaidAccountId: 'gst',
        vatPaidAccountId: 'vat',
      }),
    ).toBe('gst');
  });
});
