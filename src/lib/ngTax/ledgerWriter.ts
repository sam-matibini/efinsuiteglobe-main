/**
 * Writes an ng_tax_transaction_ledger row after any calculator runs.
 *
 * This is the single choke-point that guarantees every Nigerian tax amount
 * is traceable from source transaction ↔ journal entry ↔ filing ↔ remittance.
 * Calculators MUST route through this writer.
 */

import { supabase } from '@/integrations/supabase/client';
import type { NgLedgerWriteInput } from './types';

export async function writeTaxLedger(input: NgLedgerWriteInput): Promise<string | null> {
  const row: any = {
    organization_id: input.organization_id,
    definition_id: input.result.definition_id,
    rate_version_id: input.result.rate_version_id,
    service_classification_id: input.service_classification_id ?? null,
    source_type: input.source_type,
    source_id: input.source_id ?? null,
    source_parent_id: input.source_parent_id ?? null,
    transaction_date: input.transaction_date,
    taxable_base: input.result.taxable_base,
    tax_rate: input.result.tax_rate,
    tax_amount: input.result.tax_amount,
    currency: input.result.currency,
    journal_entry_id: input.journal_entry_id ?? null,
    journal_entry_line_id: input.journal_entry_line_id ?? null,
    breakdown: input.result.breakdown as unknown as Record<string, unknown>,
    status: 'accrued',
  };
  const { data, error } = await (supabase.from('ng_tax_transaction_ledger') as any)
    .insert(row)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[ngTax] ledger write failed', error);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Link a batch of previously written ledger rows to the JE that posted them.
 * Used by invoice/bill/payroll posting flows that create the JE after the
 * tax calculation.
 */
export async function linkLedgerToJournalEntry(
  ledgerIds: string[],
  journalEntryId: string,
): Promise<void> {
  if (!ledgerIds.length) return;
  await supabase
    .from('ng_tax_transaction_ledger')
    .update({ journal_entry_id: journalEntryId })
    .in('id', ledgerIds);
}
