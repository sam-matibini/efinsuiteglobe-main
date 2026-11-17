/**
 * Turn a final tax report (a PD7A remittance or a GST/HST return) into a CRA Payments draft.
 * The draft is only a starting point: it is reviewed, approved and paid in CRA Payments, and
 * the report is marked paid by the database only after CRA's confirmation is recorded there.
 */
import { craRemittanceAccounts } from '@/lib/payroll/remittancePeriod';

export type ReportKind = 'pd7a' | 'gst_hst';

export interface ReportForPayment {
  kind: ReportKind;
  id: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  dueDate: string;
}

export interface OrgForPayment {
  name?: string | null;
  business_number?: string | null;
  payroll_account_number?: string | null;
}

export interface ProgramAccountRow {
  full_account_number: string | null;
  program_code: string;
  status?: string | null;
  is_default?: boolean | null;
}

const PROGRAM: Record<ReportKind, 'RP' | 'RT'> = { pd7a: 'RP', gst_hst: 'RT' };

/** The program account to pay: an active registered account first, then what the organization record holds. */
export function programAccountFor(kind: ReportKind, org: OrgForPayment, accounts: ProgramAccountRow[]): string | null {
  const program = PROGRAM[kind];
  const pattern = new RegExp(`^\\d{9}${program}\\d{4}$`);
  const registered = accounts
    .filter((row) => row.program_code?.toUpperCase() === program && (!row.status || row.status === 'active'))
    .sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)))
    .map((row) => (row.full_account_number ?? '').toUpperCase().replace(/[\s-]/g, ''))
    .find((full) => pattern.test(full));
  if (registered) return registered;
  if (kind === 'pd7a') return craRemittanceAccounts(org).payrollAccountNumber ?? null;
  const bn = (org.business_number ?? '').toUpperCase().replace(/[\s-]/g, '');
  return pattern.test(bn) ? bn : null;
}

/** Columns for a new tax_payments draft in the CRA My Payment workflow. */
export function craDraftForReport(report: ReportForPayment, org: OrgForPayment, accounts: ProgramAccountRow[]) {
  if (!(report.amount > 0)) throw new Error('There is nothing to pay on this report.');
  const businessNumber = craRemittanceAccounts(org).businessNumber ?? null;
  return {
    payer_kind: 'business',
    cra_payment_type: report.kind === 'pd7a' ? 'payroll' : 'gst_hst',
    cra_allocation: report.kind === 'pd7a' ? 'regular_remittance' : 'gst_payment',
    payment_type: report.kind === 'pd7a' ? 'source_deductions' : 'gst_hst',
    business_name: (org.name ?? '').trim(),
    business_number: businessNumber,
    program_account: programAccountFor(report.kind, org, accounts),
    filing_period_label: report.periodLabel,
    period_start: report.periodStart,
    period_end: report.periodEnd,
    amount: Math.round(report.amount * 100) / 100,
    scheduled_for: report.dueDate,
    currency: 'CAD',
    payment_method: 'cra_my_payment',
    payment_rail: 'cra_my_payment',
    workflow_status: 'draft',
    status: 'draft',
    remittance_id: report.kind === 'pd7a' ? report.id : null,
    tax_return_id: report.kind === 'gst_hst' ? report.id : null,
    notes: report.kind === 'pd7a' ? `PD7A remittance for ${report.periodLabel}` : `GST/HST return for ${report.periodLabel}`,
  };
}

export interface LinkedPayment {
  id: string;
  reference: string;
  workflow_status: string | null;
  remittance_id: string | null;
  tax_return_id: string | null;
  confirmation_number: string | null;
}

/** The live (not cancelled) CRA payment for each report, keyed by report id. */
export function linkedPaymentsByReport(rows: LinkedPayment[]) {
  const byReport = new Map<string, LinkedPayment>();
  for (const row of rows) {
    if (row.workflow_status === 'cancelled') continue;
    const key = row.remittance_id ?? row.tax_return_id;
    if (key && !byReport.has(key)) byReport.set(key, row);
  }
  return byReport;
}

/** A PD7A can be deleted while it is unpaid and its CRA payment, if any, is still a draft. */
export function canDeleteRemittance(status: string | null, linked?: LinkedPayment): boolean {
  if (status === 'paid') return false;
  return !linked || linked.workflow_status === 'draft';
}
