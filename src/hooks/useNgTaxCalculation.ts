/**
 * useNgTaxCalculation — reusable Phase 3 primitive for transaction forms.
 *
 * Thin passthrough over the pure calculators + resolver + ledger writer.
 * Caller pattern:
 *
 *   const { resolve, calc, record } = useNgTaxCalculation();
 *   const vatDef = await resolve('VAT', invoiceDate);
 *   const vat = calc.vat(vatDef, lineAmount);
 *   await record({
 *     result: vat,
 *     source_type: 'invoice_line',
 *     source_id: line.id,
 *     source_parent_id: invoice.id,
 *     transaction_date: invoiceDate,
 *     journal_entry_id: je.id,
 *   });
 */

import { useCallback, useMemo } from 'react';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import {
  calculateVat,
  calculateWht,
  calculatePaye,
  calculatePercentageOnBase,
  calculateCit,
} from '@/lib/ngTax/calculators';
import { resolveTaxByCode, resolveServiceClassification, loadReliefs } from '@/lib/ngTax/resolver';
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

  const resolve = useCallback(
    (code: string, effectiveDate: string) => resolveTaxByCode(code, effectiveDate, orgId),
    [orgId],
  );

  const resolveService = useCallback(
    (code: string, effectiveDate: string) => resolveServiceClassification(code, effectiveDate),
    [],
  );

  const reliefs = useCallback(
    (effectiveDate: string, types?: string[]) => loadReliefs(effectiveDate, orgId, types),
    [orgId],
  );

  const record = useCallback(
    async (input: RecordInput): Promise<string | null> => {
      if (!orgId) return null;
      return writeTaxLedger({ organization_id: orgId, ...input });
    },
    [orgId],
  );

  const calc = useMemo(
    () => ({
      vat: calculateVat,
      wht: calculateWht,
      paye: calculatePaye,
      percentage: calculatePercentageOnBase,
      cit: calculateCit,
    }),
    [],
  );

  return {
    orgId,
    isReady: !!orgId,
    resolve,
    resolveService,
    reliefs,
    calc,
    record,
    linkToJE: linkLedgerToJournalEntry,
  };
}
