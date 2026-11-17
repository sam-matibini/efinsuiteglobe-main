import { describe, expect, it } from 'vitest';
import { canDeleteRemittance, craDraftForReport, linkedPaymentsByReport, programAccountFor, type LinkedPayment } from './reportPayments';

const org = { name: 'Humanitarian Solidarity for Development and Empowerment Canada', business_number: '725966758RR0001', payroll_account_number: null };
const pd7a = { kind: 'pd7a' as const, id: 'rem-1', amount: 888.68, periodStart: '2026-10-01', periodEnd: '2026-10-31', periodLabel: 'October 2026', dueDate: '2026-11-16' };

describe('CRA Payments draft from a tax report', () => {
  it('builds a payroll source deductions draft linked to the PD7A', () => {
    const draft = craDraftForReport(pd7a, org, [{ full_account_number: '725966758RP0001', program_code: 'RP', status: 'active' }]);
    expect(draft).toMatchObject({
      cra_payment_type: 'payroll',
      cra_allocation: 'regular_remittance',
      payment_type: 'source_deductions',
      business_number: '725966758',
      program_account: '725966758RP0001',
      amount: 888.68,
      scheduled_for: '2026-11-16',
      workflow_status: 'draft',
      remittance_id: 'rem-1',
      tax_return_id: null,
    });
  });

  it('never uses the charity (RR) account as the payroll account', () => {
    expect(programAccountFor('pd7a', org, [])).toBeNull();
    expect(craDraftForReport(pd7a, org, []).program_account).toBeNull();
  });

  it('builds a GST/HST draft linked to the return and picks the RT account', () => {
    const draft = craDraftForReport(
      { ...pd7a, kind: 'gst_hst', id: 'ret-1', amount: 1250, periodLabel: 'Q3 2026' },
      org,
      [
        { full_account_number: '725966758RT0002', program_code: 'RT', status: 'active', is_default: false },
        { full_account_number: '725966758 RT 0001', program_code: 'RT', status: 'active', is_default: true },
        { full_account_number: '725966758RT0003', program_code: 'RT', status: 'inactive' },
      ],
    );
    expect(draft).toMatchObject({ cra_payment_type: 'gst_hst', cra_allocation: 'gst_payment', program_account: '725966758RT0001', tax_return_id: 'ret-1', remittance_id: null });
  });

  it('refuses a report with nothing to pay', () => {
    expect(() => craDraftForReport({ ...pd7a, amount: 0 }, org, [])).toThrow(/nothing to pay/);
  });
});

describe('linked CRA payments', () => {
  const row = (over: Partial<LinkedPayment>): LinkedPayment => ({ id: 'p', reference: 'EF-CRA-000001', workflow_status: 'draft', remittance_id: 'rem-1', tax_return_id: null, confirmation_number: null, ...over });

  it('ignores cancelled payments', () => {
    const map = linkedPaymentsByReport([row({ id: 'a', workflow_status: 'cancelled' }), row({ id: 'b', workflow_status: 'awaiting_payment' })]);
    expect(map.get('rem-1')?.id).toBe('b');
  });

  it('allows deleting an unpaid PD7A only while its payment is a draft', () => {
    expect(canDeleteRemittance('pending')).toBe(true);
    expect(canDeleteRemittance('pending', row({ workflow_status: 'draft' }))).toBe(true);
    expect(canDeleteRemittance('pending', row({ workflow_status: 'awaiting_payment' }))).toBe(false);
    expect(canDeleteRemittance('paid')).toBe(false);
  });
});
