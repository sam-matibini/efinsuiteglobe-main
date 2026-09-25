import { beforeEach, describe, expect, it } from 'vitest';
import { effectiveCapabilities, isReconciled, outstandingBalance, upcomingAssessed } from './engine';
import {
  acknowledgeEfile,
  approvePayment,
  createPayment,
  getLedger,
  pollPayment,
  recordConfirmation,
  releasePayment,
  resetCraStoreForTests,
  reviewGst,
  revokeAuthorization,
  submitEfile,
} from './store';
import type { CraActor } from './types';
import { FUNDING_ACCOUNT } from './representative';

const org = 'org-test';
const name = 'ABC Manufacturing Ltd.';
const cfo: CraActor = { email: 'cfo@company.com', role: 'finance_manager', displayName: 'CFO' };
const accountant: CraActor = { email: 'accountant@abcmfg.example', role: 'accountant', displayName: 'Accountant' };

beforeEach(() => {
  resetCraStoreForTests();
});

describe('CRA tax centre', () => {
  it('starts from the enrolled program balances', () => {
    const ledger = getLedger(org, name);
    expect(outstandingBalance(ledger)).toBe(12450);
    expect(upcomingAssessed(ledger)).toBe(8250);
    expect(ledger.profile.programs).toEqual(['RC', 'RT', 'RP']);
    expect(ledger.gst.collected - ledger.gst.itcs).toBe(7500);
  });

  it('keeps filing separate from payment', () => {
    const before = getLedger(org, name).payments.length;
    expect(reviewGst(org, name, cfo).ok).toBe(true);
    const filed = submitEfile(org, name, cfo, {
      returnType: 'GST34',
      obligationId: 'gst-current',
      taxYear: '2026',
      account: 'RT0001',
    });
    expect(filed.ok).toBe(true);
    expect(getLedger(org, name).payments).toHaveLength(before);
    expect(getLedger(org, name).gst.filingStatus).toBe('reviewed');
    acknowledgeEfile(org, name, cfo, filed.id!);
    expect(getLedger(org, name).gst.filingStatus).toBe('filed');
    expect(getLedger(org, name).submissions[0].status).toBe('accepted');
    expect(getLedger(org, name).submissions[0].confirmationNumber).toMatch(/^CRA-/);
  });

  it('blocks an accountant from filing or approving', () => {
    const filed = submitEfile(org, name, accountant, {
      returnType: 'T2',
      obligationId: 't2-current',
      taxYear: '2025',
      account: 'RC0001',
    });
    expect(filed.ok).toBe(false);
    const approved = approvePayment(org, name, accountant, 'EFS-CRA-00001246');
    expect(approved.ok).toBe(false);
  });

  it('requires a different approver and does not mark the payment paid on release', () => {
    const prepared = createPayment(org, name, cfo, {
      taxType: 'gst_hst',
      account: 'RT0001',
      amount: 7500,
      paymentDate: '2026-10-31',
      dueDate: '2026-10-31',
      fundingAccount: FUNDING_ACCOUNT,
      purpose: 'GST/HST return',
      obligationId: 'gst-current',
    });
    expect(prepared.ok).toBe(true);
    expect(approvePayment(org, name, cfo, prepared.id!).ok).toBe(false);

    expect(approvePayment(org, name, cfo, 'EFS-CRA-00001246').ok).toBe(true);
    const released = releasePayment(org, name, cfo, 'EFS-CRA-00001246');
    expect(released.ok).toBe(true);
    const submitted = getLedger(org, name).payments.find((payment) => payment.id === 'EFS-CRA-00001246')!;
    expect(submitted.status).toBe('submitted');
    expect(submitted.glAccrual).toHaveLength(2);
    expect(submitted.walletDeduction).toBeUndefined();

    pollPayment(org, name, cfo, 'EFS-CRA-00001246');
    pollPayment(org, name, cfo, 'EFS-CRA-00001246');
    pollPayment(org, name, cfo, 'EFS-CRA-00001246');
    const settled = getLedger(org, name).payments.find((payment) => payment.id === 'EFS-CRA-00001246')!;
    expect(settled.status).toBe('settled');
    expect(getLedger(org, name).walletBalance).toBe(31000);
    expect(isReconciled(settled)).toBe(false);

    const confirmed = recordConfirmation(org, name, cfo, 'EFS-CRA-00001246', 'CRA-888888888');
    expect(confirmed.ok).toBe(true);
    const row = getLedger(org, name).payments.find((payment) => payment.id === 'EFS-CRA-00001246')!;
    expect(row.status).toBe('confirmed');
    expect(isReconciled(row)).toBe(true);
  });

  it('refuses EFILE after authorization is revoked', () => {
    expect(revokeAuthorization(org, name, cfo).ok).toBe(true);
    const filed = submitEfile(org, name, cfo, {
      returnType: 'T2',
      obligationId: 't2-current',
      taxYear: '2025',
      account: 'RC0001',
    });
    expect(filed.ok).toBe(false);
  });

  it('lets the access ceiling remove filing from a CFO', () => {
    const ledger = getLedger(org, name);
    ledger.accessCeiling.taxFiling = false;
    expect(effectiveCapabilities('finance_manager', ledger.accessCeiling)).not.toContain('file_return');
    expect(effectiveCapabilities('owner', ledger.accessCeiling)).not.toContain('file_return');
    expect(effectiveCapabilities('accountant', ledger.accessCeiling)).not.toContain('approve_payment');
  });
});
