/**
 * Pre-fills a CRA payment from what eFinsuite already knows: the CRA profile, program
 * accounts, and the GST/HST, payroll and corporate positions in the Tax & CRA ledger.
 * Nothing here is sent to CRA.
 */
import type { CraLedger } from '../types';
import type { CraPaymentType } from './catalog';
import { roundMoney, type PaymentDraft } from './workflow';

export interface KnownProgramAccount {
  full: string;
  program: string;
  label: string;
}

/** Every program account on file for the organization, from the database and the Tax & CRA profile. */
export function knownProgramAccounts(ledger: CraLedger | null, dbAccounts: { full_account_number: string; program_code: string; account_name: string; status?: string }[]): KnownProgramAccount[] {
  const out = new Map<string, KnownProgramAccount>();
  for (const account of dbAccounts) {
    if (account.status && account.status !== 'active') continue;
    const full = account.full_account_number.replace(/\s/g, '').toUpperCase();
    out.set(full, { full, program: account.program_code, label: account.account_name });
  }
  const bn = ledger?.profile.businessNumber?.replace(/\s/g, '') ?? '';
  if (/^[0-9]{9}$/.test(bn)) {
    for (const account of ledger?.accounts ?? []) {
      if (account.program === 'OTHER') continue;
      const reference = /^[0-9]{4}$/.test(account.reference) ? account.reference : '0001';
      const full = `${bn}${account.program}${reference}`;
      if (!out.has(full)) out.set(full, { full, program: account.program, label: account.label });
    }
  }
  return [...out.values()];
}

function monthLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
}

/** "October 2026" for one month, "October – December 2026" for a quarter, else the raw dates. */
export function periodLabel(start: string, end: string): string {
  if (!start || !end) return '';
  if (start.slice(0, 7) === end.slice(0, 7)) return monthLabel(start);
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return `${start} to ${end}`;
  if (s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString('en-CA', { month: 'long' })} – ${e.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}`;
  }
  return `${start} to ${end}`;
}

export interface PrefillResult {
  patch: Partial<PaymentDraft>;
  /** Plain-language note on where each value came from. */
  sources: string[];
}

export function prefillForType(
  type: CraPaymentType,
  allocationKey: string,
  ledger: CraLedger | null,
  accounts: KnownProgramAccount[],
): PrefillResult {
  const patch: Partial<PaymentDraft> = {};
  const sources: string[] = [];

  if (ledger && type.payerKind === 'business') {
    if (ledger.profile.legalName) patch.businessName = ledger.profile.legalName;
    if (ledger.profile.businessNumber) patch.businessNumber = ledger.profile.businessNumber.replace(/\s/g, '');
    if (patch.businessName || patch.businessNumber) sources.push('Business name and number from the Tax & CRA profile.');
  }

  if (type.payerKind === 'business') {
    const match = accounts.find((account) => account.program === type.program);
    if (match) {
      patch.programAccount = match.full;
      sources.push(`Program account ${match.full} from your CRA program accounts.`);
    }
  }

  if (!ledger) return { patch, sources };

  if (type.prefill === 'gst' && allocationKey !== 'gst_instalment') {
    const net = roundMoney(ledger.gst.collected - ledger.gst.itcs);
    if (ledger.gst.periodStart && ledger.gst.periodEnd) {
      patch.periodStart = ledger.gst.periodStart;
      patch.periodEnd = ledger.gst.periodEnd;
      patch.periodLabel = periodLabel(ledger.gst.periodStart, ledger.gst.periodEnd);
    }
    if (net > 0) {
      patch.amount = net.toFixed(2);
      sources.push(`Amount is net GST/HST: collected ${ledger.gst.collected.toFixed(2)} less ITCs ${ledger.gst.itcs.toFixed(2)}.`);
    }
    if (ledger.balances.gst_hst !== null && ledger.balances.gst_hst > 0 && !patch.amount) {
      patch.amount = ledger.balances.gst_hst.toFixed(2);
      sources.push('Amount is the GST/HST balance CRA returned.');
    }
  }

  if (type.prefill === 'payroll') {
    const total = roundMoney(ledger.payroll.cpp + ledger.payroll.ei + ledger.payroll.incomeTax);
    if (ledger.payroll.periodStart && ledger.payroll.periodEnd) {
      patch.periodStart = ledger.payroll.periodStart;
      patch.periodEnd = ledger.payroll.periodEnd;
      patch.periodLabel = periodLabel(ledger.payroll.periodStart, ledger.payroll.periodEnd);
    }
    if (total > 0) {
      patch.amount = total.toFixed(2);
      sources.push(`Amount is CPP ${ledger.payroll.cpp.toFixed(2)} + EI ${ledger.payroll.ei.toFixed(2)} + income tax ${ledger.payroll.incomeTax.toFixed(2)}${ledger.payroll.sourcePayRunLabel ? ` from ${ledger.payroll.sourcePayRunLabel}` : ''}.`);
    }
  }

  if (type.prefill === 'corporate') {
    const fiscal = ledger.corporate.fiscalEnd ? `Tax year ending ${ledger.corporate.fiscalEnd}` : '';
    if (fiscal) {
      patch.periodLabel = fiscal;
      patch.periodStart = ledger.corporate.fiscalStart || '';
      patch.periodEnd = ledger.corporate.fiscalEnd;
    }
    if (allocationKey === 't2_instalment' && ledger.corporate.nextInstallmentAmount > 0) {
      patch.amount = ledger.corporate.nextInstallmentAmount.toFixed(2);
      if (ledger.corporate.nextInstallmentDate) patch.paymentDate = ledger.corporate.nextInstallmentDate;
      sources.push('Amount and date are the next corporate instalment on file.');
    } else if (allocationKey === 't2_interim' && ledger.balances.corporate_interim !== null && ledger.balances.corporate_interim > 0) {
      patch.amount = ledger.balances.corporate_interim.toFixed(2);
      sources.push('Amount is the interim balance CRA returned.');
    } else if (allocationKey === 't2_balance') {
      const owing = ledger.balances.corporate_tax ?? roundMoney(ledger.corporate.balance - ledger.corporate.installmentsPaid);
      if (owing > 0) {
        patch.amount = owing.toFixed(2);
        sources.push(ledger.balances.corporate_tax !== null ? 'Amount is the corporation tax balance CRA returned.' : 'Amount is the T2 balance less instalments paid.');
      }
    }
  }

  return { patch, sources };
}
