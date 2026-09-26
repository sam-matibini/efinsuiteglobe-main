import { describe, expect, it } from 'vitest';
import { calculateTax } from '@/components/banking/TaxCodeSelect';
import { withResolvedTaxAccounts } from './taxGlAccounts';

const accounts = [
  { id: 'gst-pay', name: 'GST/HST Payable' },
  { id: 'gst-itc', name: 'GST/HST Input Tax Credits (ITC)' },
  { id: 'pst-pay', name: 'PST Payable' },
  { id: 'pst-paid', name: 'PST Paid (Non-Recoverable)' },
];

describe('Manitoba combined tax GL accounts', () => {
  it('fills GST and PST accounts on a combined code that was stored without them', () => {
    const code = withResolvedTaxAccounts({
      code: 'GST+PST',
      rate: 12,
      jurisdiction: 'MB',
      tax_type: 'GST+PST',
      gl_collected_account_id: null,
      gl_paid_account_id: null,
      component_taxes: [
        { code: 'GST', rate: 5, glCollectedAccountId: null, glPaidAccountId: null },
        { code: 'PST-MB', rate: 7, glCollectedAccountId: null, glPaidAccountId: null },
      ],
    }, accounts);

    expect(code?.component_taxes?.[0].glPaidAccountId).toBe('gst-itc');
    expect(code?.component_taxes?.[0].glCollectedAccountId).toBe('gst-pay');
    expect(code?.component_taxes?.[1].glPaidAccountId).toBe('pst-paid');
    expect(code?.component_taxes?.[1].glCollectedAccountId).toBe('pst-pay');
  });

  it('skips a header and uses the posting account', () => {
    const code = withResolvedTaxAccounts({
      code: 'GST+PST',
      rate: 12,
      jurisdiction: 'MB',
      tax_type: 'GST+PST',
      gl_collected_account_id: null,
      gl_paid_account_id: null,
    }, [
      { id: 'header', name: 'GST/HST Input Tax Credits', is_header: true },
      { id: 'gst-itc', name: 'GST/HST Input Tax Credits (ITC)', posting_allowed: true },
      { id: 'pst-paid', name: 'PST Paid (Non-Recoverable)', posting_allowed: true },
      { id: 'gst-pay', name: 'GST/HST Payable', posting_allowed: true },
      { id: 'pst-pay', name: 'PST Payable', posting_allowed: true },
    ]);
    expect(code?.component_taxes?.[0].glPaidAccountId).toBe('gst-itc');
  });

  it('posts inclusive Manitoba GST and PST to those accounts', () => {
    const code = withResolvedTaxAccounts({
      id: 'combined-mb',
      organization_id: 'org',
      code: 'GST+PST-MB',
      name: 'Manitoba (12%)',
      rate: 12,
      jurisdiction: 'MB',
      tax_type: 'GST+PST',
      is_recoverable: false,
      is_compound: false,
      is_active: true,
      applies_to: 'purchases',
      gl_collected_account_id: null,
      gl_paid_account_id: null,
      created_at: '',
      updated_at: '',
    }, accounts);

    const result = calculateTax(33.94, code, true, 'withdrawal');
    expect(result.taxBreakdown.map((line) => [line.code, line.glAccountId])).toEqual([
      ['GST', 'gst-itc'],
      ['PST', 'pst-paid'],
    ]);
    expect(result.taxBreakdown.every((line) => line.glAccountId)).toBe(true);
  });
});
