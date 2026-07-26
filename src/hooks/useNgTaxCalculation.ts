/**
 * useNgTaxCalculation — reusable Phase 3 primitive.
 *
 * Lets any transaction form (invoices, bills, expenses, payroll runs) call
 * into the Nigerian tax engine, get a calculation result, and persist it
 * to `ng_tax_transaction_ledger` for end-to-end traceability.
 *
 * Usage:
 *   const { calcVat, calcWht, calcPaye, calcPension, record } = useNgTaxCalculation();
 *   const vat = await calcVat({ amount: 100_000, date: today });
 *   await record({
 *     result: vat,
 *     source_type: 'invoice_line',
 *     source_id: line.id,
 *     source_parent_id: invoice.id,
 *     transaction_date: today,
 *     journal_entry_id: je.id,
 *   });
 */

import { useCallback } from 'react';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import {
  calcVAT, calcWHT, calcPAYE, calcPension, calcCIT,
} from '@/lib/ngTax/calculators';
import { writeTaxLedger, linkLedgerToJournalEntry } from '@/lib/ngTax/ledgerWriter';
import type { NgCalculationResult, NgLedgerSourceType } from '@/lib/ngTax/types';

interface RecordInput {
  result: NgCalculationResult;
  source_type: NgLedgerSourceType;
  source_id?: string | null;
  source_parent_id?: string | null;
  transaction_date: string;
  journal_entry_id?: string | null;
  journal_entry_line_id?: string | null;
  service_classification_id?: string | null;
}

export function useNgTaxCalculation() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;

  const calcVat = useCallback(
    (params: { amount: number; date: string; isExempt?: boolean }) =>
      calcVAT({ organization_id: orgId, ...params }),
    [orgId],
  );

  const calcWht = useCallback(
    (params: { amount: number; date: string; serviceCode: string; isResident?: boolean }) =>
      calcWHT({ organization_id: orgId, ...params }),
    [orgId],
  );

  const calcEmployeePaye = useCallback(
    (params: { grossAnnual: number; date: string; pensionContribution?: number; nhfContribution?: number }) =>
      calcPAYE({ organization_id: orgId, ...params }),
    [orgId],
  );

  const calcEmployeePension = useCallback(
    (params: { grossMonthly: number; date: string }) =>
      calcPension({ organization_id: orgId, ...params }),
    [orgId],
  );

  const calcCorporateTax = useCallback(
    (params: { profit: number; turnover: number; date: string }) =>
      calcCIT({ organization_id: orgId, ...params }),
    [orgId],
  );

  const record = useCallback(async (input: RecordInput): Promise<string | null> => {
    if (!orgId) return null;
    return writeTaxLedger({ organization_id: orgId, ...input });
  }, [orgId]);

  const linkToJE = useCallback(
    (ledgerIds: string[], journalEntryId: string) =>
      linkLedgerToJournalEntry(ledgerIds, journalEntryId),
    [],
  );

  return {
    orgId,
    isNigerianOrg: !!orgId,
    calcVat,
    calcWht,
    calcEmployeePaye,
    calcEmployeePension,
    calcCorporateTax,
    record,
    linkToJE,
  };
}
