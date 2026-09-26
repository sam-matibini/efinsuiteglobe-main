import { beforeEach, describe, expect, it } from 'vitest';
import { effectiveCapabilities, isReconciled, outstandingBalance, upcomingAssessed } from './engine';
import {
  applyCdeResult,
  applyEfileResult,
  applyRailResult,
  approvePayment,
  createPayment,
  getLedger,
  pollPayment,
  recordClientConfirmation,
  recordConfirmation,
  releasePayment,
  requestAuthorization,
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
    expect(getLedger(org, name).submissions[0].status).toBe('submitted');
    const empty = applyEfileResult(org, name, cfo, filed.id!, { httpStatus: 200, body: '', confirmationNumber: null });
    expect(empty.ok).toBe(false);
    expect(getLedger(org, name).gst.filingStatus).toBe('reviewed');
    expect(getLedger(org, name).submissions[0].status).toBe('submitted');
    const rejected = applyEfileResult(org, name, cfo, filed.id!, { httpStatus: 500, body: '<ConfirmationNumber>CRA-999999</ConfirmationNumber>' });
    expect(rejected.ok).toBe(false);
    expect(getLedger(org, name).submissions[0].status).toBe('error');
    const accepted = applyEfileResult(org, name, cfo, filed.id!, { httpStatus: 200, confirmationNumber: 'CRA-123456' });
    expect(accepted.ok).toBe(true);
    expect(getLedger(org, name).gst.filingStatus).toBe('filed');
    expect(getLedger(org, name).submissions[0].status).toBe('accepted');
    expect(getLedger(org, name).submissions[0].confirmationNumber).toBe('CRA-123456');
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

  it('does not connect CRA from a button and does not advance a payment without a rail status', () => {
    expect(revokeAuthorization(org, name, cfo).ok).toBe(true);
    expect(requestAuthorization(org, name, cfo).ok).toBe(true);
    expect(recordClientConfirmation(org, name, cfo).ok).toBe(false);
    expect(getLedger(org, name).authorization.status).toBe('pending_client_confirmation');
    expect(getLedger(org, name).authorization.verifiedByCra).toBeUndefined();

    const checked = applyCdeResult(org, name, cfo, {
      ok: true,
      connected: true,
      balances: { gst_hst: 10, payroll: 20, corporate_tax: 30 },
    });
    expect(checked.ok).toBe(true);
    expect(getLedger(org, name).authorization.verifiedByCra).toBe(true);
    expect(getLedger(org, name).balances.gst_hst).toBe(10);

    expect(approvePayment(org, name, cfo, 'EFS-CRA-00001246').ok).toBe(true);
    const held = applyRailResult(org, name, cfo, 'EFS-CRA-00001246', { ok: false, error: 'Nomba card payments are not configured. The payment stays authorized.' });
    expect(held.ok).toBe(false);
    expect(getLedger(org, name).payments.find((payment) => payment.id === 'EFS-CRA-00001246')!.status).toBe('authorized');
    const settled = applyRailResult(org, name, cfo, 'EFS-CRA-00001246', {
      ok: true,
      railStatus: 'settled',
      railReference: 'ps-1',
      journalEntryId: 'je-1',
    });
    expect(settled.ok).toBe(true);
    const row = getLedger(org, name).payments.find((payment) => payment.id === 'EFS-CRA-00001246')!;
    expect(row.status).toBe('settled');
    expect(row.railReference).toBe('ps-1');
    expect(row.journalEntryId).toBe('je-1');
    expect(row.walletDeduction).toBe(14000);
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
