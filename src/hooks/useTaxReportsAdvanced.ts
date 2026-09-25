/**
 * useTaxReportsAdvanced — Phase 9 reporting hooks.
 *
 * Provides three datasets for the enhanced Tax Reports page:
 *  1. Liability by Authority — groups tax_amount by tax_authority over a date range.
 *  2. Multi-Jurisdiction Consolidated — rolls up all tax types by jurisdiction.
 *  3. Filing Comparison — filed return totals vs current GL recompute (variance highlight).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { buildFilingForm } from '@/lib/filings';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;
}

export interface AuthorityLiabilityRow {
  authority_id: string | null;
  authority_name: string;
  region: string | null;
  tax_collected: number;
  itc_claimed: number;
  net_payable: number;
  reporting_currency: string;
}

export interface JurisdictionRollupRow {
  jurisdiction_code: string;
  authority: string;
  tax_type: string;
  taxable_amount: number;
  tax_collected: number;
  itc_claimed: number;
  net: number;
}

export interface FilingComparisonRow {
  return_id: string;
  authority_name: string;
  period_start: string;
  period_end: string;
  filed_at: string | null;
  filed_net: number;        // amount stored on tax_returns
  recomputed_net: number;   // re-aggregated from current GL
  variance: number;
  status: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface TaxLineLike {
  tax_type: string;
  tax_code: string | null;
  authority: string | null;
  jurisdiction_code: string | null;
  rate: number;
  taxable_amount: number;
  tax_amount: number;
  is_recoverable: boolean;
}

/**
 * Tax lines are derived from the General Ledger (via the
 * get_tax_movements_by_code RPC) so every tax-bearing entry — invoices,
 * bills, expenses, bank categorisations, and manual journal entries — is
 * captured uniformly.
 */
async function fetchTaxLines(orgId: string, range: DateRange) {
  const { data, error } = await (supabase.rpc as any)('get_tax_movements_by_code', {
    p_org_id: orgId,
    p_start_date: range.start,
    p_end_date: range.end,
  });
  if (error) throw error;

  const collected: TaxLineLike[] = [];
  const paid: TaxLineLike[] = [];

  for (const row of (data ?? []) as any[]) {
    const line: TaxLineLike = {
      tax_type: row.tax_type ?? 'sales',
      tax_code: row.code ?? null,
      authority: row.authority_name ?? null,
      jurisdiction_code: row.jurisdiction ?? null,
      rate: Number(row.rate ?? 0),
      taxable_amount: Number(row.taxable_amount ?? 0),
      tax_amount: Number(row.tax_amount ?? 0),
      is_recoverable: row.is_recoverable !== false,
    };
    if (row.side === 'collected') collected.push(line);
    else if (row.side === 'paid') paid.push(line);
  }

  return { collected, paid };
}

/* ------------------- 1. Liability by Authority ------------------- */
export function useLiabilityByAuthority(range: DateRange | null) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ['tax-liability-by-authority', orgId, range?.start, range?.end],
    enabled: Boolean(orgId && range),
    queryFn: async (): Promise<AuthorityLiabilityRow[]> => {
      // Authorities + their tax codes
      const { data: authorities } = await supabase
        .from('tax_authorities')
        .select('id, name, region, reporting_currency')
        .eq('organization_id', orgId!);

      const { data: codes } = await supabase
        .from('tax_codes')
        .select('id, code, tax_authority_id')
        .eq('organization_id', orgId!);

      const codeToAuthority = new Map<string, string>();
      for (const c of codes ?? []) {
        if (c.tax_authority_id) codeToAuthority.set(c.code, c.tax_authority_id);
      }

      const { collected, paid } = await fetchTaxLines(orgId!, range!);

      const byAuth = new Map<string | null, AuthorityLiabilityRow>();
      const ensure = (authId: string | null): AuthorityLiabilityRow => {
        const key = authId ?? '__unmapped__';
        if (!byAuth.has(key)) {
          const meta = (authorities ?? []).find((a) => a.id === authId);
          byAuth.set(key, {
            authority_id: authId,
            authority_name: meta?.name ?? 'Unmapped tax codes',
            region: meta?.region ?? null,
            tax_collected: 0,
            itc_claimed: 0,
            net_payable: 0,
            reporting_currency: meta?.reporting_currency ?? 'CAD',
          });
        }
        return byAuth.get(key)!;
      };

      for (const t of collected) {
        const authId = (t.tax_code && codeToAuthority.get(t.tax_code)) || null;
        ensure(authId).tax_collected += Number(t.tax_amount ?? 0);
      }
      for (const t of paid) {
        if (!t.is_recoverable) continue;
        const authId = (t.tax_code && codeToAuthority.get(t.tax_code)) || null;
        ensure(authId).itc_claimed += Number(t.tax_amount ?? 0);
      }

      const rows = Array.from(byAuth.values()).map((r) => ({
        ...r,
        tax_collected: round2(r.tax_collected),
        itc_claimed: round2(r.itc_claimed),
        net_payable: round2(r.tax_collected - r.itc_claimed),
      }));

      rows.sort((a, b) => b.net_payable - a.net_payable);
      return rows;
    },
  });
}

/* ------------------- 2. Multi-Jurisdiction Consolidated ------------------- */
export function useJurisdictionConsolidated(range: DateRange | null) {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ['tax-jurisdiction-consolidated', orgId, range?.start, range?.end],
    enabled: Boolean(orgId && range),
    queryFn: async (): Promise<JurisdictionRollupRow[]> => {
      const { collected, paid } = await fetchTaxLines(orgId!, range!);

      const map = new Map<string, JurisdictionRollupRow>();
      const key = (t: TaxLineLike) =>
        `${t.jurisdiction_code ?? '—'}|${t.authority ?? '—'}|${t.tax_type}`;

      const ensure = (t: TaxLineLike): JurisdictionRollupRow => {
        const k = key(t);
        if (!map.has(k)) {
          map.set(k, {
            jurisdiction_code: t.jurisdiction_code ?? '—',
            authority: t.authority ?? '—',
            tax_type: t.tax_type,
            taxable_amount: 0,
            tax_collected: 0,
            itc_claimed: 0,
            net: 0,
          });
        }
        return map.get(k)!;
      };

      for (const t of collected) {
        const r = ensure(t);
        r.taxable_amount += Number(t.taxable_amount ?? 0);
        r.tax_collected += Number(t.tax_amount ?? 0);
      }
      for (const t of paid) {
        if (!t.is_recoverable) continue;
        const r = ensure(t);
        r.itc_claimed += Number(t.tax_amount ?? 0);
      }

      const rows = Array.from(map.values()).map((r) => ({
        ...r,
        taxable_amount: round2(r.taxable_amount),
        tax_collected: round2(r.tax_collected),
        itc_claimed: round2(r.itc_claimed),
        net: round2(r.tax_collected - r.itc_claimed),
      }));

      rows.sort(
        (a, b) =>
          a.jurisdiction_code.localeCompare(b.jurisdiction_code) ||
          a.tax_type.localeCompare(b.tax_type),
      );
      return rows;
    },
  });
}

/* ------------------- 3. Filing Comparison ------------------- */
export function useFilingComparison() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ['tax-filing-comparison', orgId],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<FilingComparisonRow[]> => {
      // Returns + their period link (period carries the authority FK)
      const { data: returns } = await supabase
        .from('tax_returns')
        .select('id, period_start, period_end, status, net_payable, filed_at')
        .eq('organization_id', orgId!)
        .in('status', ['filed', 'paid', 'submitted'])
        .order('period_end', { ascending: false })
        .limit(24);

      if (!returns || returns.length === 0) return [];

      const returnIds = returns.map((r) => r.id as string);
      const { data: periods } = await supabase
        .from('tax_filing_periods')
        .select('tax_return_id, tax_authority_id')
        .in('tax_return_id', returnIds);
      const periodAuthByReturn = new Map<string, string>();
      for (const p of periods ?? []) {
        if (p.tax_return_id && p.tax_authority_id)
          periodAuthByReturn.set(p.tax_return_id as string, p.tax_authority_id as string);
      }

      const { data: authorities } = await supabase
        .from('tax_authorities')
        .select('id, name, region, country_id, reporting_currency')
        .eq('organization_id', orgId!);
      const authMap = new Map((authorities ?? []).map((a) => [a.id as string, a]));

      // Pre-cache codes per authority
      const codesByAuthority = new Map<string, Set<string>>();
      for (const r of returns) {
        const authId = periodAuthByReturn.get(r.id as string);
        if (authId && !codesByAuthority.has(authId)) {
          const { data: codes } = await supabase
            .from('tax_codes')
            .select('code')
            .eq('organization_id', orgId!)
            .eq('tax_authority_id', authId);
          codesByAuthority.set(authId, new Set((codes ?? []).map((c) => c.code)));
        }
      }

      const rows: FilingComparisonRow[] = [];
      for (const r of returns) {
        const authId = periodAuthByReturn.get(r.id as string) ?? null;
        const auth = authId ? authMap.get(authId) : null;
        const range = { start: r.period_start as string, end: r.period_end as string };
        const { collected, paid } = await fetchTaxLines(orgId!, range);

        let recomputedCollected = 0;
        let recomputedItc = 0;
        const codeSet = authId ? codesByAuthority.get(authId) : null;

        for (const t of collected) {
          if (codeSet && (!t.tax_code || !codeSet.has(t.tax_code))) continue;
          recomputedCollected += Number(t.tax_amount ?? 0);
        }
        for (const t of paid) {
          if (!t.is_recoverable) continue;
          if (codeSet && (!t.tax_code || !codeSet.has(t.tax_code))) continue;
          recomputedItc += Number(t.tax_amount ?? 0);
        }

        const recomputedNet = round2(recomputedCollected - recomputedItc);
        const filedNet = Number(r.net_payable ?? 0);
        rows.push({
          return_id: r.id as string,
          authority_name: auth?.name ?? 'Unknown authority',
          period_start: r.period_start as string,
          period_end: r.period_end as string,
          filed_at: (r.filed_at as string) ?? null,
          filed_net: round2(filedNet),
          recomputed_net: recomputedNet,
          variance: round2(recomputedNet - filedNet),
          status: r.status as string,
        });
      }

      return rows;
    },
  });
}

/* ------------------- XML export helper ------------------- */
export function buildFilingXml(authorityName: string, range: DateRange, rows: AuthorityLiabilityRow[]): string {
  const auth = rows.find((r) => r.authority_name === authorityName) ?? rows[0];
  const esc = (s: string) =>
    s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
  return `<?xml version="1.0" encoding="UTF-8"?>
<TaxReturn>
  <Authority>${esc(auth?.authority_name ?? '')}</Authority>
  <Region>${esc(auth?.region ?? '')}</Region>
  <Currency>${esc(auth?.reporting_currency ?? 'CAD')}</Currency>
  <PeriodStart>${range.start}</PeriodStart>
  <PeriodEnd>${range.end}</PeriodEnd>
  <TaxCollected>${auth?.tax_collected ?? 0}</TaxCollected>
  <InputTaxCredits>${auth?.itc_claimed ?? 0}</InputTaxCredits>
  <NetPayable>${auth?.net_payable ?? 0}</NetPayable>
</TaxReturn>`;
}

// Re-export so consumers can build a per-authority filing form
export { buildFilingForm };
