import { describe, it, expect } from 'vitest';
import {
  appendPaidRetailTaxCodes,
  isPaidRetailTaxCode,
  paidCodeFor,
  paidDisplayName,
  taxCodeGroupLabel,
  taxCodePostingSides,
  taxCodeSelectType,
  type RetailTaxCodeLike,
} from '../retailTaxRateCatalog';

function stub(partial: Partial<RetailTaxCodeLike> & { code: string; name: string; rate: number }): RetailTaxCodeLike {
  return {
    id: partial.id || partial.code,
    organization_id: 'org',
    jurisdiction: null,
    tax_type: partial.tax_type || partial.code,
    is_recoverable: partial.is_recoverable ?? true,
    is_compound: false,
    is_active: true,
    gl_collected_account_id: 'collect',
    gl_paid_account_id: 'paid',
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('retailTaxRateCatalog', () => {
  it('builds GST/HST ITC and PST paid codes', () => {
    expect(paidCodeFor('GST')).toBe('GST-ITC');
    expect(paidCodeFor('HST-ON')).toBe('HST-ON-ITC');
    expect(paidCodeFor('PST')).toBe('PST-PAID');
    expect(paidCodeFor('QST')).toBe('QST-ITR');
    expect(paidCodeFor('VAT')).toBe('VAT-ITC');
    expect(isPaidRetailTaxCode('GST-ITC')).toBe(true);
    expect(isPaidRetailTaxCode('GST')).toBe(false);
  });

  it('uses localized paid names for Canada and VAT countries', () => {
    expect(paidDisplayName('GST', 'CA')).toMatch(/ITC/);
    expect(paidDisplayName('HST', 'CA')).toMatch(/ITC/);
    expect(paidDisplayName('PST', 'CA')).toBe('PST Paid');
    expect(paidDisplayName('VAT', 'GB')).toMatch(/Input VAT/);
    expect(paidDisplayName('IVA', 'MX')).toMatch(/Input IVA/);
  });

  it('appends paid siblings without duplicating existing ITC rows', () => {
    const codes = [
      stub({ code: 'GST', name: 'Collect GST', rate: 5, tax_type: 'GST' }),
      stub({ code: 'HST', name: 'Collect HST', rate: 13, tax_type: 'HST' }),
      stub({ code: 'PST', name: 'Collect PST/QST', rate: 7, tax_type: 'PST', is_recoverable: false }),
      stub({ code: 'E', name: 'Exempt', rate: 0, tax_type: 'exempt' }),
    ];
    const expanded = appendPaidRetailTaxCodes(codes, 'CA');
    expect(expanded.map((c) => c.code)).toEqual(
      expect.arrayContaining(['GST', 'HST', 'PST', 'E', 'GST-ITC', 'HST-ITC', 'PST-PAID']),
    );
    const gstItc = expanded.find((c) => c.code === 'GST-ITC');
    expect(gstItc?.name).toMatch(/ITC/);
    expect(gstItc?.applies_to).toBe('purchases');
    expect(gstItc?.isVirtual).toBe(true);
    expect(gstItc?.gl_paid_account_id).toBe('paid');
    expect(gstItc?.gl_collected_account_id).toBeNull();
    expect(expanded.find((c) => c.code === 'PST-PAID')?.is_recoverable).toBe(false);
    expect(taxCodeGroupLabel(gstItc!)).toBe('Paid / ITC');
    expect(taxCodeGroupLabel(codes[0])).toBe('Collect');

    const again = appendPaidRetailTaxCodes(expanded, 'CA');
    expect(again.filter((c) => c.code === 'GST-ITC')).toHaveLength(1);
  });

  it('treats GST/HST family codes as both sides and ITC codes as paid-only', () => {
    expect(taxCodePostingSides({ code: 'GST', tax_type: 'GST' })).toEqual({ collected: true, paid: true });
    expect(taxCodePostingSides({ code: 'GST-ITC', tax_type: 'GST', applies_to: 'purchases' })).toEqual({
      collected: false,
      paid: true,
    });
    expect(taxCodeSelectType({ code: 'HST', tax_type: 'HST' })).toBe('both');
    expect(taxCodeSelectType({ code: 'HST-ITC', applies_to: 'purchases' })).toBe('purchase');
  });
});
