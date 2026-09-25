/**
 * useTaxReturnPreview — aggregates invoice/bill/expense taxes for a filing period
 * and produces a return-ready form via the filings registry.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { buildFilingForm, FilingFormResult, PeriodTaxRow, PeriodTotals } from '@/lib/filings';

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

  const rows: PeriodTaxRow[] = [];
  let totalSales = 0;
  let totalPurchases = 0;

  // Normalize a movement's tax_type so filing mappers can recognize it.
  // GL codes / authority names are the source of truth — the column tax_type
  // can be "both" (sales + purchases) which the form mappers don't understand.
  const normalizeType = (m: any): string => {
    const code = String(m.code ?? '').toUpperCase();
    const authority = String(m.authority_name ?? '').toUpperCase();
    const account = String(m.account_name ?? '').toUpperCase();
    if (code.startsWith('HST') || authority.includes('HST') || account.includes('HST')) return 'hst';
    if (code.startsWith('GST') || authority.includes('GST') || account.includes('GST')) return 'gst';
    if (code.startsWith('QST') || authority.includes('QST') || account.includes('QST') || code.startsWith('TVQ')) return 'qst';
    if (code.startsWith('PST') || authority.includes('PST') || account.includes('PST') || code.startsWith('RST')) return 'pst';
    if (code.startsWith('VAT') || authority.includes('VAT')) return 'vat';
    const t = String(m.tax_type ?? '').toLowerCase();
    return t && t !== 'both' ? t : 'sales';
  };

  for (const m of (movements ?? []) as any[]) {
    if (m.authority_id && m.authority_id !== authorityId) continue;
    const taxAmount = Number(m.tax_amount ?? 0);
    const taxableAmount = Number(m.taxable_amount ?? 0);
    const flags = m.tax_code_id ? flagMap.get(m.tax_code_id) : undefined;
    rows.push({
      source: m.side === 'collected' ? 'invoice' : 'bill',
      tax_type: normalizeType(m),
      tax_code: m.code ?? null,
      authority: m.authority_name ?? null,
      jurisdiction_code: m.jurisdiction ?? null,
      rate: Number(m.rate ?? 0),
      taxable_amount: taxableAmount,
      tax_amount: taxAmount,
      is_recoverable: m.is_recoverable !== false,
      is_zero_rated: flags?.zr ?? false,
      is_exempt: flags?.ex ?? false,
    });
    if (m.side === 'collected') totalSales += taxableAmount;
    else totalPurchases += taxableAmount;
  }

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
