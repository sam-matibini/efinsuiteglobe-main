import { beforeEach, describe, expect, it } from 'vitest';
import { effectiveCapabilities, isReconciled, outstandingBalance, remitAmount, upcomingAssessed } from './engine';
import {
  applyCdeResult,
  applyEfileResult,
  applyRailResult,
  approvePayment,
  createPayment,
  getLedger,
  pollPayment,
  stripSampleCraLedger,
  recordClientConfirmation,
  recordConfirmation,
  releasePayment,
  requestAuthorization,
  sendInstructions,
  resetCraStoreForTests,
  reviewGst,
  reviewPayroll,
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

function readyOrg() {
  const ledger = getLedger(org, name);
  ledger.profile.businessNumber = '123456789';
  ledger.profile.programs = ['RC', 'RT', 'RP'];
  ledger.accounts = [
    { program: 'RC', reference: '0001', label: 'Corporate income tax' },
    { program: 'RT', reference: '0001', label: 'GST/HST' },
    { program: 'RP', reference: '0001', label: 'Payroll' },
  ];
  ledger.authorization = { status: 'connected', level: 'level_2', verifiedByCra: true };
  ledger.walletBalance = 45000;
  ledger.gst.filingStatus = 'calculated';
  ledger.payroll.filingStatus = 'calculated';
  return ledger;
}

describe('CRA tax centre', () => {
  it('starts with no CRA balances, payments, or sample authorization', () => {
    const ledger = getLedger(org, name);
    expect(outstandingBalance(ledger)).toBeNull();
    expect(upcomingAssessed(ledger)).toBeNull();
    expect(ledger.balances).toEqual({ gst_hst: null, payroll: null, corporate_tax: null, total_owing: null, corporate_interim: null });
    expect(ledger.payments).toEqual([]);
    expect(ledger.notices).toEqual([]);
    expect(ledger.authorization.status).toBe('not_started');
    expect(ledger.authorization.verifiedByCra).toBeUndefined();
    expect(ledger.profile.businessNumber).toBe('');
    expect(ledger.walletBalance).toBe(0);
  });

  it('removes sample CRA figures and keeps a business number the user entered', () => {
    const ledger = getLedger(org, name);
    ledger.profile.legalName = '10255666 MANITOBA LTD.';
    ledger.profile.businessNumber = '711450965';
    ledger.profile.programs = ['RC', 'RT', 'RP'];
    ledger.balances = { gst_hst: 4200, payroll: 3250, corporate_tax: 5000 };
    ledger.balancesFromCra = false;
    ledger.authorization = {
      status: 'connected',
      level: 'level_2',
      reference: 'RAC-20260901-0042',
      confirmedAt: '2026-09-03T18:12:00.000Z',
    };
    ledger.walletBalance = 45000;
    ledger.gst.collected = 25000;
    ledger.gst.itcs = 17500;
    ledger.syncedAt = '2026-09-25T14:42:00.000Z';
    ledger.payments.push({ id: 'EFS-CRA-00001246', craConfirmation: undefined } as never);
    expect(stripSampleCraLedger(ledger)).toBe(true);
    expect(ledger.profile.legalName).toBe('10255666 MANITOBA LTD.');
    expect(ledger.profile.businessNumber).toBe('711450965');
    expect(ledger.profile.programs).toEqual(['RC', 'RT', 'RP']);
    expect(ledger.balances).toEqual({ gst_hst: null, payroll: null, corporate_tax: null, total_owing: null, corporate_interim: null });
    expect(ledger.authorization.status).toBe('connected');
    expect(ledger.authorization.representativeName).toBe('Samson Matibini');
    expect(ledger.authorization.verifiedByCra).toBeUndefined();
    expect(ledger.authorization.reference).toBeUndefined();
    expect(stripSampleCraLedger(ledger)).toBe(false);
    ledger.authorization = { status: 'revoked', level: 'level_1' };
    expect(stripSampleCraLedger(ledger)).toBe(false);
    expect(ledger.authorization.status).toBe('revoked');
    expect(ledger.walletBalance).toBe(0);
    expect(ledger.gst.collected).toBe(0);
    expect(ledger.payments).toEqual([]);
    expect(ledger.syncedAt).toBe('');
    ledger.balancesFromCra = true;
    ledger.balances = { gst_hst: 10, payroll: null, corporate_tax: null };
    stripSampleCraLedger(ledger);
    expect(ledger.balances.gst_hst).toBe(10);
  });

  it('keeps filing separate from payment', () => {
    readyOrg();
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
    readyOrg();
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

    const payroll = createPayment(org, name, accountant, {
      taxType: 'payroll',
      account: 'RP0001',
      amount: 14000,
      paymentDate: '2026-09-30',
      dueDate: '2026-09-30',
      fundingAccount: FUNDING_ACCOUNT,
      purpose: 'Payroll source deductions',
      obligationId: 'payroll-current',
    });
    expect(payroll.ok).toBe(true);
    expect(approvePayment(org, name, cfo, payroll.id!).ok).toBe(true);
    const released = releasePayment(org, name, cfo, payroll.id!);
    expect(released.ok).toBe(true);
    const submitted = getLedger(org, name).payments.find((payment) => payment.id === payroll.id)!;
    expect(submitted.status).toBe('submitted');
    expect(submitted.glAccrual).toHaveLength(2);
    expect(submitted.walletDeduction).toBeUndefined();

    pollPayment(org, name, cfo, payroll.id!);
    pollPayment(org, name, cfo, payroll.id!);
    pollPayment(org, name, cfo, payroll.id!);
    const settled = getLedger(org, name).payments.find((payment) => payment.id === payroll.id)!;
    expect(settled.status).toBe('settled');
    expect(getLedger(org, name).walletBalance).toBe(31000);
    expect(isReconciled(settled)).toBe(false);

    const confirmed = recordConfirmation(org, name, cfo, payroll.id!, 'CRA-888888888');
    expect(confirmed.ok).toBe(true);
    const row = getLedger(org, name).payments.find((payment) => payment.id === payroll.id)!;
    expect(row.status).toBe('confirmed');
    expect(isReconciled(row)).toBe(true);
  });

  it('does not connect CRA from a button and does not advance a payment without a rail status', () => {
    readyOrg();
    expect(revokeAuthorization(org, name, cfo).ok).toBe(true);
    expect(requestAuthorization(org, name, cfo).ok).toBe(true);
    const hsde = 'hsde-org';
    const hsdeLedger = getLedger(hsde, 'Humanitarian Solidarity for Development and Empowerment Canada');
    hsdeLedger.profile.businessNumber = '725966758';
    hsdeLedger.authorization = { status: 'pending_client_confirmation', level: 'level_1' };
    const already = requestAuthorization(hsde, hsdeLedger.profile.legalName, cfo);
    expect(already.ok).toBe(true);
    expect(already.message).toMatch(/already authorized/);
    expect(already.message).toMatch(/No authorization form was sent/);
    expect(getLedger(hsde).authorization.status).toBe('connected');
    expect(getLedger(hsde).authorization.representativeName).toBe('Samson Matibini');
    expect(getLedger(hsde).authorization.verifiedByCra).toBeUndefined();
    expect(getLedger(hsde).balances).toEqual({ gst_hst: null, payroll: null, corporate_tax: null, total_owing: null, corporate_interim: null });
    expect(sendInstructions(hsde, hsdeLedger.profile.legalName, cfo).message).toMatch(/No authorization form was sent/);
    expect(getLedger(org, name).authorization.reference).toBeUndefined();
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
    expect(getLedger(org, name).balancesFromCra).toBe(true);
    expect(getLedger(org, name).balances.gst_hst).toBe(10);

    resetCraStoreForTests();
    const before = getLedger(org, name);
    const balances = { ...before.balances };
    const status = before.authorization.status;
    const unchanged = applyCdeResult(org, name, cfo, {
      ok: true,
      connected: false,
      balances: null,
      notice: 'CRA Internet File Transfer responded. Account balances were not included, so the amounts were not changed.',
    });
    expect(unchanged.ok).toBe(true);
    expect(unchanged.message).toMatch(/not included/);
    expect(getLedger(org, name).balances).toEqual(balances);

    const oka = 'oka-org';
    const okaLedger = getLedger(oka, 'C.C. OKA LOGISTICS INC.');
    okaLedger.profile.businessNumber = '724016159';
    okaLedger.profile.legalName = 'C.C. OKA LOGISTICS INC.';
    okaLedger.authorization = { status: 'connected', level: 'level_1', representativeName: 'Samson Matibini' };
    const refreshed = applyCdeResult(oka, okaLedger.profile.legalName, cfo, {
      ok: true,
      connected: false,
      balances: null,
      notice: 'CRA Internet File Transfer responded. Account balances were not included, so the amounts were not changed.',
    });
    expect(refreshed.ok).toBe(true);
    expect(refreshed.message).toMatch(/RC0001/);
    expect(refreshed.message).toMatch(/\$1,601\.65/);
    expect(refreshed.message).toMatch(/interim balance \$0\.00/);
    const kept = getLedger(oka);
    expect(kept.balances.total_owing).toBe(1601.65);
    expect(kept.balances.gst_hst).toBe(0);
    expect(kept.balances.payroll).toBeNull();
    expect(kept.balances.corporate_tax).toBe(1601.65);
    expect(kept.balancesFromCra).toBe(false);
    expect(kept.authorization.verifiedByCra).toBeUndefined();
    expect(kept.enquiry?.outstandingReturnsLabel).toBe('Yes');
    expect(kept.enquiry?.gstOutstandingReturnsLabel).toBe('Yes');
    expect(kept.notices.map((notice) => notice.title)).toEqual([
      '2025-03-31 GST34 Initial Return',
      'T2 Initial assessment',
    ]);
    expect(outstandingBalance(kept)).toBe(1601.65);
    expect(applyCdeResult(oka, okaLedger.profile.legalName, cfo, {
      ok: true,
      balances: { gst_hst: 12 },
    }).ok).toBe(true);
    expect(getLedger(oka).balances.gst_hst).toBe(12);
    expect(getLedger(oka).balances.total_owing).toBeNull();
    expect(getLedger(oka).balancesFromCra).toBe(true);
    expect(getLedger(oka).balanceSource).toBeUndefined();
    expect(getLedger(org, name).authorization.status).toBe(status);
    expect(getLedger(org, name).authorization.verifiedByCra).toBeUndefined();

    readyOrg();
    const payroll = createPayment(org, name, accountant, {
      taxType: 'payroll',
      account: 'RP0001',
      amount: 14000,
      paymentDate: '2026-09-30',
      dueDate: '2026-09-30',
      fundingAccount: FUNDING_ACCOUNT,
      purpose: 'Payroll source deductions',
    });
    expect(payroll.ok).toBe(true);
    expect(approvePayment(org, name, cfo, payroll.id!).ok).toBe(true);
    const held = applyRailResult(org, name, cfo, payroll.id!, { ok: false, error: 'Nomba card payments are not configured. The payment stays authorized.' });
    expect(held.ok).toBe(false);
    expect(getLedger(org, name).payments.find((payment) => payment.id === payroll.id)!.status).toBe('authorized');
    const settled = applyRailResult(org, name, cfo, payroll.id!, {
      ok: true,
      railStatus: 'settled',
      railReference: 'ps-1',
      journalEntryId: 'je-1',
    });
    expect(settled.ok).toBe(true);
    const row = getLedger(org, name).payments.find((payment) => payment.id === payroll.id)!;
    expect(row.status).toBe('settled');
    expect(row.railReference).toBe('ps-1');
    expect(row.journalEntryId).toBe('je-1');
    expect(row.walletDeduction).toBe(14000);
  });

  it('refuses EFILE after authorization is revoked', () => {
    readyOrg();
    expect(revokeAuthorization(org, name, cfo).ok).toBe(true);
    const filed = submitEfile(org, name, cfo, {
      returnType: 'T2',
      obligationId: 't2-current',
      taxYear: '2025',
      account: 'RC0001',
    });
    expect(filed.ok).toBe(false);
  });

  it('pays an outstanding CRA balance and files GST/HST and source deductions without a wallet balance', () => {
    const ledger = readyOrg();
    ledger.walletBalance = 0;
    ledger.balances = { gst_hst: 0, payroll: 250, corporate_tax: 1601.65, total_owing: 1851.65, corporate_interim: 0 };
    ledger.gst.collected = 100;
    ledger.gst.itcs = 40;
    ledger.payroll.cpp = 80;
    ledger.payroll.ei = 20;
    ledger.payroll.incomeTax = 50;
    expect(remitAmount(ledger.balances.gst_hst, ledger.gst.collected - ledger.gst.itcs)).toBe(60);
    expect(remitAmount(ledger.balances.payroll, 150)).toBe(250);
    expect(remitAmount(0, 0)).toBe(0);

    const corporate = createPayment(org, name, accountant, {
      taxType: 'corporate_tax',
      account: 'RC0001',
      amount: 1601.65,
      paymentDate: '2026-09-26',
      dueDate: '2026-09-26',
      fundingAccount: FUNDING_ACCOUNT,
      purpose: 'Corporation income tax RC0001 balance',
      obligationId: 't2-current',
    });
    expect(corporate.ok).toBe(true);
    expect(approvePayment(org, name, cfo, corporate.id!).ok).toBe(true);
    expect(releasePayment(org, name, cfo, corporate.id!).ok).toBe(true);
    const settled = applyRailResult(org, name, cfo, corporate.id!, {
      ok: true,
      railStatus: 'settled',
      railReference: 'nomba-1',
      journalEntryId: 'je-cra-1',
    });
    expect(settled.ok).toBe(true);
    expect(getLedger(org, name).walletBalance).toBe(0);
    const confirmed = recordConfirmation(org, name, cfo, corporate.id!, 'CRA-AB160165');
    expect(confirmed.ok).toBe(true);
    expect(getLedger(org, name).balances.corporate_tax).toBe(0);
    expect(getLedger(org, name).balances.total_owing).toBe(250);

    expect(reviewGst(org, name, accountant).ok).toBe(true);
    const gst = submitEfile(org, name, cfo, {
      returnType: 'GST34',
      obligationId: 'gst-current',
      taxYear: '2026',
      account: 'RT0001',
    });
    expect(gst.ok).toBe(true);
    expect(reviewPayroll(org, name, accountant).ok).toBe(true);
    const pd7a = submitEfile(org, name, cfo, {
      returnType: 'PD7A',
      obligationId: 'payroll-current',
      taxYear: '2026',
      account: 'RP0001',
    });
    expect(pd7a.ok).toBe(true);
    expect(getLedger(org, name).submissions.map((row) => row.returnType)).toEqual(['PD7A', 'GST34']);
  });

  it('lets the access ceiling remove filing from a CFO', () => {
    const ledger = getLedger(org, name);
    ledger.accessCeiling.taxFiling = false;
    expect(effectiveCapabilities('finance_manager', ledger.accessCeiling)).not.toContain('file_return');
    expect(effectiveCapabilities('owner', ledger.accessCeiling)).not.toContain('file_return');
    expect(effectiveCapabilities('accountant', ledger.accessCeiling)).not.toContain('approve_payment');
  });
});
