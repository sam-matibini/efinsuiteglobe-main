/**
 * useTaxReturnPreview — aggregates invoice/bill/expense taxes for a filing period
 * and produces a return-ready form via the filings registry.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { buildFilingForm, FilingFormResult, PeriodTaxRow, PeriodTotals } from '@/lib/filings';
import { movementsToPeriodRows, type TaxMovementRow } from '@/lib/taxPeriodReport';

export interface TaxReturnPreviewInput {
  periodId: string;
  periodStart: string;
  periodEnd: string;
  authorityId: string;
  authorityName: string;
  authorityRegion?: string | null;
  authorityCountryCode?: string | null;
  reportingCurrency?: string;
}

export interface TaxReturnPreview {
  form: FilingFormResult;
  totals: PeriodTotals;
}

async function fetchPeriodRows(
  orgId: string,
  authorityId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ rows: PeriodTaxRow[]; totalSales: number; totalPurchases: number }> {
  // GL-derived tax movements for the period (covers invoices, bills, expenses,
  // bank categorisations, and manual journal entries uniformly).
  const [{ data: movements, error }, { data: revenueTotal, error: revErr }, { data: taxCodeFlags, error: tcErr }] = await Promise.all([
    (supabase.rpc as any)('get_tax_movements_by_code', {
      p_org_id: orgId, p_start_date: periodStart, p_end_date: periodEnd,
    }),
    (supabase.rpc as any)('get_period_revenue_total', {
      p_org_id: orgId, p_start_date: periodStart, p_end_date: periodEnd,
    }),
    supabase
      .from('tax_codes')
      .select('id, is_zero_rated, is_exempt')
      .eq('organization_id', orgId),
  ]);
  if (error) throw error;
  if (revErr) throw revErr;
  if (tcErr) throw tcErr;

  const flagMap = new Map<string, { zr: boolean; ex: boolean }>();
  for (const t of (taxCodeFlags ?? []) as any[]) {
    flagMap.set(t.id, { zr: !!t.is_zero_rated, ex: !!t.is_exempt });
  }

  const scoped = ((movements ?? []) as TaxMovementRow[]).filter(
    (m) => !m.authority_id || m.authority_id === authorityId,
  );
  const rows = movementsToPeriodRows(scoped, flagMap);
  const totalSales = rows.filter((r) => r.source === 'invoice').reduce((s, r) => s + r.taxable_amount, 0);
  const totalPurchases = rows.filter((r) => r.source !== 'invoice').reduce((s, r) => s + r.taxable_amount, 0);

  const glRevenue = Number(revenueTotal ?? 0);
  return {
    rows,
    totalSales: Math.round((glRevenue || totalSales) * 100) / 100,
    totalPurchases: Math.round(totalPurchases * 100) / 100,
  };
}

export function useTaxReturnPreview(input: TaxReturnPreviewInput | null) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: [
      'tax-return-preview',
      orgId,
      input?.periodId,
      input?.authorityId,
      input?.periodStart,
      input?.periodEnd,
    ],
    enabled: Boolean(orgId && input),
    queryFn: async (): Promise<TaxReturnPreview> => {
      const { rows, totalSales, totalPurchases } = await fetchPeriodRows(
        orgId!,
        input!.authorityId,
        input!.periodStart,
        input!.periodEnd,
      );

      const totals: PeriodTotals = { rows, totalSales, totalPurchases };
      const form = buildFilingForm(totals, {
        authority: input!.authorityName,
        periodStart: input!.periodStart,
        periodEnd: input!.periodEnd,
        currency: input!.reportingCurrency ?? 'CAD',
        region: input!.authorityRegion ?? null,
        countryCode: input!.authorityCountryCode ?? null,
      });

      return { form, totals };
    },
  });
}
