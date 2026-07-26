/**
 * Phase 3 — Transaction integration helpers.
 *
 * Thin façade over the calculators + ledger writer so posting flows
 * (invoice, bill, payroll, vendor payment) can record NG taxes with a single
 * call. Each helper is a no-op unless the org's country_code is 'NG', so
 * wiring it into any form is safe for non-NG organizations.
 *
 * Contract: call AFTER the source row exists and (ideally) after the JE is
 * posted, so ledger rows are linked in one step.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  calculateVat,
  calculateWht,
  calculatePaye,
} from './calculators';
import {
  resolveTaxByCode,
  resolveServiceClassification,
  loadReliefs,
} from './resolver';
import { writeTaxLedger, linkLedgerToJournalEntry } from './ledgerWriter';
import type { NgCalculationResult } from './types';

async function isNgOrg(orgId: string): Promise<boolean> {
  const { data } = await supabase
    .from('organizations')
    .select('country_code')
    .eq('id', orgId)
    .maybeSingle();
  return (data as any)?.country_code === 'NG';
}

export interface InvoiceLineInput {
  id: string;
  taxable_amount: number;
  vat_exempt?: boolean;
}

export interface InvoicePostContext {
  organization_id: string;
  invoice_id: string;
  invoice_date: string; // ISO
  lines: InvoiceLineInput[];
  journal_entry_id?: string | null;
}

/**
 * Record VAT output for every taxable line on an invoice.
 * Returns the ledger row IDs (empty array for non-NG orgs or when no lines qualify).
 */
export async function recordInvoiceTaxes(ctx: InvoicePostContext): Promise<string[]> {
  if (!(await isNgOrg(ctx.organization_id))) return [];
  const vatDef = await resolveTaxByCode('VAT', ctx.invoice_date, ctx.organization_id);
  if (!vatDef) return [];

  const ids: string[] = [];
  for (const line of ctx.lines) {
    if (line.vat_exempt || !line.taxable_amount) continue;
    const result: NgCalculationResult = calculateVat(vatDef, line.taxable_amount);
    const id = await writeTaxLedger({
      organization_id: ctx.organization_id,
      result,
      source_type: 'invoice_line',
      source_id: line.id,
      source_parent_id: ctx.invoice_id,
      transaction_date: ctx.invoice_date,
      journal_entry_id: ctx.journal_entry_id ?? null,
    });
    if (id) ids.push(id);
  }
  if (ctx.journal_entry_id && ids.length) {
    await linkLedgerToJournalEntry(ids, ctx.journal_entry_id);
  }
  return ids;
}

export interface BillLineInput {
  id: string;
  taxable_amount: number;
  wht_service_code?: string | null; // e.g. 'PROF_SERVICES', 'CONSTRUCTION'
  is_non_resident?: boolean;
  vat_input_amount?: number | null; // if the vendor invoice showed input VAT
}

export interface BillPostContext {
  organization_id: string;
  bill_id: string;
  bill_date: string;
  lines: BillLineInput[];
  journal_entry_id?: string | null;
}

/**
 * Record WHT (per line, based on service classification) and input VAT
 * accruals on a supplier bill.
 */
export async function recordBillTaxes(ctx: BillPostContext): Promise<string[]> {
  if (!(await isNgOrg(ctx.organization_id))) return [];
  const ids: string[] = [];

  const vatDef = await resolveTaxByCode('VAT_INPUT', ctx.bill_date, ctx.organization_id).catch(
    () => null,
  );

  for (const line of ctx.lines) {
    // ---- WHT (if service classified) ----
    if (line.wht_service_code) {
      const cls = await resolveServiceClassification(
        line.wht_service_code,
        ctx.bill_date,
        ctx.organization_id,
      );
      if (cls) {
        const whtDef = await resolveTaxByCode('WHT', ctx.bill_date, ctx.organization_id);
        if (whtDef) {
          const rate = line.is_non_resident && cls.non_resident_rate != null
            ? cls.non_resident_rate
            : cls.resident_rate;
          const min = cls.min_threshold ?? 0;
          if (line.taxable_amount >= min) {
            const result = calculateWht(whtDef, cls, line.taxable_amount, {
              isNonResident: !!line.is_non_resident,
            });
            void rate;
            const id = await writeTaxLedger({
              organization_id: ctx.organization_id,
              result,
              source_type: 'bill_line',
              source_id: line.id,
              source_parent_id: ctx.bill_id,
              transaction_date: ctx.bill_date,
              service_classification_id: cls.id,
              journal_entry_id: ctx.journal_entry_id ?? null,
            });
            if (id) ids.push(id);
          }
        }
      }
    }


    // ---- Input VAT (if supplied by vendor) ----
    if (vatDef && line.vat_input_amount && line.vat_input_amount > 0) {
      const result = calculateVat(vatDef, line.taxable_amount || 0);
      // Override with vendor-supplied VAT amount to preserve exact posting.
      const adjusted: NgCalculationResult = {
        ...result,
        tax_amount: line.vat_input_amount,
        journal_template: { ...result.journal_template, amount: line.vat_input_amount },
      };
      const id = await writeTaxLedger({
        organization_id: ctx.organization_id,
        result: adjusted,
        source_type: 'bill_line',
        source_id: line.id,
        source_parent_id: ctx.bill_id,
        transaction_date: ctx.bill_date,
        journal_entry_id: ctx.journal_entry_id ?? null,
      });
      if (id) ids.push(id);
    }
  }

  if (ctx.journal_entry_id && ids.length) {
    await linkLedgerToJournalEntry(ids, ctx.journal_entry_id);
  }
  return ids;
}

export interface PayrollLineInput {
  pay_stub_id: string;
  gross_earnings: number;         // per-period gross
  periods_per_year?: number;      // default 12 (monthly)
  pension_employee?: number;      // per-period, annualized inside
  nhf_employee?: number;
  nhis_employee?: number;
  life_assurance_premium?: number;
  pension_base?: number | null;   // per-period base for pension contribution ledger row
}

export interface PayrollPostContext {
  organization_id: string;
  pay_run_id: string;
  pay_period_end: string;
  stubs: PayrollLineInput[];
  journal_entry_id?: string | null;
}

/**
 * Record PAYE + employee pension per pay stub.
 */
export async function recordPayrollTaxes(ctx: PayrollPostContext): Promise<string[]> {
  if (!(await isNgOrg(ctx.organization_id))) return [];
  const payeDef = await resolveTaxByCode('PAYE', ctx.pay_period_end, ctx.organization_id);
  const pensionDef = await resolveTaxByCode(
    'PENSION_EMP',
    ctx.pay_period_end,
    ctx.organization_id,
  ).catch(() => null);
  if (!payeDef) return [];

  const reliefs = await loadReliefs(ctx.pay_period_end, ctx.organization_id);
  const ids: string[] = [];

  for (const stub of ctx.stubs) {
    const periods = stub.periods_per_year ?? 12;
    const paye = calculatePaye(
      payeDef,
      {
        annualGross: stub.gross_earnings * periods,
        pensionEmployee: (stub.pension_employee ?? 0) * periods,
        nhfEmployee: (stub.nhf_employee ?? 0) * periods,
        nhisEmployee: (stub.nhis_employee ?? 0) * periods,
        lifeAssurancePremium: stub.life_assurance_premium ?? 0,
        periodsPerYear: periods,
      },
      reliefs,
    );

    const pid = await writeTaxLedger({
      organization_id: ctx.organization_id,
      result: paye,
      source_type: 'payroll_line',
      source_id: stub.pay_stub_id,
      source_parent_id: ctx.pay_run_id,
      transaction_date: ctx.pay_period_end,
      journal_entry_id: ctx.journal_entry_id ?? null,
    });
    if (pid) ids.push(pid);

    // Employee pension contribution (8%).
    if (pensionDef && stub.pension_base && stub.pension_base > 0) {
      const pen = calculatePercentageOnBase(pensionDef, stub.pension_base);
      const penId = await writeTaxLedger({
        organization_id: ctx.organization_id,
        result: pen,
        source_type: 'payroll_line',
        source_id: stub.pay_stub_id,
        source_parent_id: ctx.pay_run_id,
        transaction_date: ctx.pay_period_end,
        journal_entry_id: ctx.journal_entry_id ?? null,
      });
      if (penId) ids.push(penId);
    }
  }

  if (ctx.journal_entry_id && ids.length) {
    await linkLedgerToJournalEntry(ids, ctx.journal_entry_id);
  }
  return ids;
}

/**
 * Vendor payment → mark WHT ledger rows for a bill as "withheld".
 * Called from the vendor payment posting flow.
 */
export async function markBillWhtWithheld(billId: string): Promise<void> {
  await (supabase as any)
    .from('ng_tax_transaction_ledger')
    .update({ status: 'withheld' })
    .eq('source_parent_id', billId)
    .eq('source_type', 'bill_line')
    .in('status', ['accrued']);
}
