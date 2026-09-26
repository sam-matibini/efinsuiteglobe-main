import { describe, expect, it } from 'vitest';
import {
  createPaymentInstruction,
  informationReturnDueDate,
  luhnValid,
  noteSeenOnCraAccount,
  payrollDueDate,
  prepareGstFiling,
  prepareInformationReturnBatch,
  recordBankBillPay,
  recordClientBalance,
  recordFunding,
  refreshUnresolved,
  setRacAuthorization,
  validateSin,
  validateValueDate,
  balanceIsStale,
} from './engine';

const validSin = '046454286';

describe('CRA identifier checks', () => {
  it('accepts a SIN whose check digit matches', () => {
    expect(luhnValid(validSin)).toBe(true);
    expect(validateSin(validSin)).toBeNull();
  });

  it('rejects a SIN with one wrong digit', () => {
    expect(validateSin('046454287')).toMatch(/check digit/);
  });
});

describe('non-EDI CRA bill pay', () => {
  const base = {
    clientId: '10255666 Manitoba Ltd.',
    taxpayerKind: 'business' as const,
    programAccount: '123456789RP0001',
    payeeType: 'payroll' as const,
    bankName: 'RBC' as const,
    payeeName: 'Federal Payroll Deductions – EMPTX – (PD7A)',
    payeeNameConfirmed: true,
    taxYear: '2026',
    period: 'August 2026',
    amount: 1500,
    valueDate: '2026-08-04',
    dueDate: '2026-09-15',
    safeguardedAccount: 'RPAA trust account',
    kycCleared: true,
    now: new Date('2026-08-03T14:00:00-04:00'),
  };

  it('refuses an operating account, a wrong program suffix, and a missing payee choice', () => {
    const result = createPaymentInstruction({
      ...base,
      payeeType: 'payroll',
      programAccount: '123456789RT0001',
      safeguardedAccount: 'Operating chequing',
      payeeNameConfirmed: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.errors.join(' ')).toMatch(/payee name/);
      expect(result.errors.join(' ')).toMatch(/trust account/);
      expect(result.errors.join(' ')).toMatch(/RP account/);
    }
  });

  it('keeps a payroll instruction unpaid until the bank confirmation is recorded', () => {
    const created = createPaymentInstruction(base);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.instruction.status).toBe('draft');
    const funded = recordFunding(created.instruction, 'DEP-88421');
    expect(funded.ok).toBe(true);
    if (!funded.ok) return;
    const blocked = recordBankBillPay(funded.instruction, '');
    expect(blocked.ok).toBe(false);
    const sent = recordBankBillPay(funded.instruction, 'BANK-229184');
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.instruction.status).toBe('submitted_to_bank');
    expect(sent.instruction.bankConfirmation).toBe('BANK-229184');
    const seen = noteSeenOnCraAccount(sent.instruction, 'RP account shows the August payment');
    expect(seen.ok).toBe(true);
    if (seen.ok) expect(seen.instruction.status).toBe('noted_on_cra_account');
  });

  it('blocks same-day scheduling after the Eastern cutoff', () => {
    const message = validateValueDate('2026-08-03', '2026-09-15', new Date('2026-08-03T16:30:00-04:00'));
    expect(message).toMatch(/Same-day bill pay is closed/);
  });

  it('flags a bank payment that is still missing after five business days', () => {
    const created = createPaymentInstruction(base);
    if (!created.ok) throw new Error('expected instruction');
    const funded = recordFunding(created.instruction, 'DEP-88421');
    if (!funded.ok) throw new Error('expected funding');
    const sent = recordBankBillPay(funded.instruction, 'BANK-229184', new Date('2026-08-04T15:00:00Z'));
    if (!sent.ok) throw new Error('expected bank send');
    const flagged = refreshUnresolved(sent.instruction, new Date('2026-08-12T15:00:00Z'));
    expect(flagged.status).toBe('unresolved');
  });
});

describe('balances, authorization, payroll, and GST/HST filing', () => {
  it('stores a client-entered balance as unverified and stale after 30 days', () => {
    const saved = recordClientBalance({ clientId: 'oka', program: 'RC', amount: 1601.65, asOf: '2026-08-01' });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.balance.verifiedByCra).toBe(false);
    expect(saved.balance.source).toBe('client_provided');
    expect(balanceIsStale(saved.balance, new Date('2026-09-15T12:00:00Z'))).toBe(true);
  });

  it('does not accept Form AUT-01', () => {
    const result = setRacAuthorization({ clientId: 'oka', status: 'pending', level: 1, method: 'AUT-01' });
    expect(result.ok).toBe(false);
  });

  it('calculates payroll due dates from the remitter type', () => {
    expect(payrollDueDate('regular', '2026-08-31')).toBe('2026-09-15');
    expect(payrollDueDate('threshold_1', '2026-08-31', '2026-08-14')).toBe('2026-08-25');
    expect(payrollDueDate('threshold_1', '2026-08-31', '2026-08-20')).toBe('2026-09-10');
    expect(payrollDueDate('threshold_2', '2026-08-31', '2026-08-14')).toBe('2026-08-19');
  });

  it('prepares NETFILE without storing the access code and blocks EDI', () => {
    const netfile = prepareGstFiling({
      clientId: 'oka',
      path: 'netfile',
      period: '2026-Q2',
      authorizationActive: false,
      accessCode: '4821',
    });
    expect(netfile.ok).toBe(true);
    if (netfile.ok) {
      expect(netfile.filing.accessCodeStored).toBe(false);
      expect(JSON.stringify(netfile.filing)).not.toContain('4821');
      expect(netfile.filing.confirmedByCra).toBe(false);
    }
    const edi = prepareGstFiling({ clientId: 'oka', path: 'edi', period: '2026-Q2', authorizationActive: true });
    expect(edi.ok).toBe(false);
  });

  it('builds one T4 file and rejects a mixed T4A slip', () => {
    const mixed = prepareInformationReturnBatch({
      returnType: 'T4',
      transmitterNumber: '123456789RZ0001',
      repId: 'Z6L725M',
      taxYear: 2026,
      slips: [
        { clientId: 'a', returnType: 'T4', amount: 10 },
        { clientId: 'b', returnType: 'T4A', amount: 5 },
      ],
    });
    expect(mixed.ok).toBe(false);
    const batch = prepareInformationReturnBatch({
      returnType: 'T4',
      transmitterNumber: '123456789RZ0001',
      repId: 'Z6L725M',
      taxYear: 2026,
      slips: [{ clientId: 'a', returnType: 'T4', amount: 10 }],
    });
    expect(batch.ok).toBe(true);
    if (batch.ok) {
      expect(batch.xml).toContain('T619');
      expect(batch.xml).not.toContain('EmptyOptional');
      expect(batch.dueDate).toBe(informationReturnDueDate(2026));
    }
  });
});
