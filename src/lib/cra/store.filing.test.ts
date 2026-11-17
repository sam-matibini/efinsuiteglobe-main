import { beforeEach, describe, expect, it } from 'vitest';
import { getLedger, recordCraFiling, resetCraStoreForTests, reviewGst } from './store';
import type { CraActor } from './types';

const org = 'org-filing';
const name = 'ABC Manufacturing Ltd.';
const cfo: CraActor = { email: 'cfo@company.com', role: 'finance_manager', displayName: 'CFO' };
const accountant: CraActor = { email: 'accountant@abcmfg.example', role: 'accountant', displayName: 'Accountant' };
const today = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  resetCraStoreForTests();
  const ledger = getLedger(org, name);
  ledger.profile.businessNumber = '123456789';
  ledger.profile.programs = ['RC', 'RT', 'RP'];
  ledger.authorization = { status: 'connected', level: 'level_2', verifiedByCra: true };
  ledger.gst.filingStatus = 'calculated';
});

function gstInput(overrides: Partial<Parameters<typeof recordCraFiling>[3]> = {}) {
  return {
    returnType: 'GST34' as const,
    obligationId: getLedger(org, name).gst.id,
    taxYear: '2026',
    account: 'RT0001',
    confirmationNumber: 'CRA-123456',
    filedOn: today,
    channel: 'Represent a Client',
    ...overrides,
  };
}

describe('recording a return filed on CRA', () => {
  it('marks GST/HST filed only with a CRA confirmation and never creates a payment', () => {
    expect(reviewGst(org, name, cfo).ok).toBe(true);
    expect(recordCraFiling(org, name, cfo, gstInput({ confirmationNumber: '' })).ok).toBe(false);
    expect(getLedger(org, name).gst.filingStatus).toBe('reviewed');

    const result = recordCraFiling(org, name, cfo, gstInput());
    expect(result.ok).toBe(true);
    const ledger = getLedger(org, name);
    expect(ledger.gst.filingStatus).toBe('filed');
    expect(ledger.submissions[0]).toMatchObject({ status: 'accepted', confirmationNumber: 'CRA-123456', returnType: 'GST34' });
    expect(ledger.submissions[0].craResponse).toMatch(/Represent a Client/);
    expect(ledger.payments).toHaveLength(0);
    expect(ledger.audit[0].action).toBe('GST34 filed on Represent a Client');
  });

  it('requires review first, rejects future dates and duplicate confirmations', () => {
    expect(recordCraFiling(org, name, cfo, gstInput()).ok).toBe(false);
    reviewGst(org, name, cfo);
    expect(recordCraFiling(org, name, cfo, gstInput({ filedOn: '2999-01-01' })).ok).toBe(false);
    expect(recordCraFiling(org, name, cfo, gstInput()).ok).toBe(true);
    expect(recordCraFiling(org, name, cfo, gstInput()).ok).toBe(false);
  });

  it('does not let a role without filing rights record a filing', () => {
    reviewGst(org, name, cfo);
    expect(recordCraFiling(org, name, accountant, gstInput()).ok).toBe(false);
    expect(getLedger(org, name).gst.filingStatus).toBe('reviewed');
  });
});
