/**
 * useTaxReconciliation — compares GL income totals to GST/HST tax-coded sales
 * and surfaces revenue lines posted without a tax_code_id, in base currency.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';

const PAGE_SIZE = 1000;

export interface ReconAccountRow {
  account_id: string;
  account_code: string;
  account_name: string;
  gl_net: number;            // base-currency credit-debit net
  taxed_net: number;         // portion that has tax_code_id set
  untaxed_net: number;       // portion with no tax_code_id
  is_zero_or_exempt: boolean;
  untaxed_lines: number;     // count
}

export interface UntaxedLine {
  id: string;
  journal_entry_id: string;
  entry_date: string;
  reference: string | null;
  description: string | null;
  account_id: string;
  account_code: string;
  account_name: string;
  amount: number;            // base-currency credit-debit
  source_document_type: string | null;
  source_document_id: string | null;
}

export interface TaxReconciliationResult {
  glIncomeTotal: number;
  taxCodedSales: number;
  reportedTaxCollected: number;
  expectedTaxAtDefaultRate: number;
  defaultRate: number | null;
  defaultRateCode: string | null;
  untaxedRevenue: number;
  byAccount: ReconAccountRow[];
  untaxedLines: UntaxedLine[];
  fxExcluded: number;
  settlementsExcluded: number;
}

const ZERO_EXEMPT_RE = /(export|exempt|zero[- ]?rated|out[- ]?of[- ]?scope|interest income|dividend)/i;
const FX_RE = /(foreign exchange|fx gain|fx loss|realized fx|unrealized fx|currency gain|currency loss)/i;

interface Args {
  organizationId: string | null | undefined;
  authorityId: string | null | undefined;
  periodStart: string | null | undefined;
  periodEnd: string | null | undefined;
}

export function useTaxReconciliation({
  organizationId,
  authorityId,
  periodStart,
  periodEnd,
}: Args) {
  return useQuery({
    queryKey: ['tax-reconciliation', organizationId, authorityId, periodStart, periodEnd],
    enabled: Boolean(organizationId && periodStart && periodEnd),
    queryFn: async (): Promise<TaxReconciliationResult> => {
      const orgId = organizationId!;

      // 1) GL revenue total (base currency, FX/settlements excluded by RPC)
      const { data: glTotal, error: glErr } = await (supabase.rpc as any)(
        'get_period_revenue_total',
        { p_org_id: orgId, p_start_date: periodStart, p_end_date: periodEnd },
      );
      if (glErr) throw glErr;

      // 2) Tax-coded movements
      const { data: movements, error: mvErr } = await (supabase.rpc as any)(
        'get_tax_movements_by_code',
        { p_org_id: orgId, p_start_date: periodStart, p_end_date: periodEnd },
      );
      if (mvErr) throw mvErr;

      const collected = ((movements ?? []) as any[]).filter(
        (m) =>
          m.side === 'collected' &&
          (!authorityId || !m.authority_id || m.authority_id === authorityId),
      );
      const taxCodedSales = Math.round(
        collected.reduce((s, m) => s + Number(m.taxable_amount ?? 0), 0) * 100,
      ) / 100;
      const reportedTaxCollected = Math.round(
        collected.reduce((s, m) => s + Number(m.tax_amount ?? 0), 0) * 100,
      ) / 100;

      // Default GST/HST rate for this authority (highest active rate)
      let defaultRate: number | null = null;
      let defaultRateCode: string | null = null;
      if (authorityId) {
        const { data: tc } = await supabase
          .from('tax_codes')
          .select('code, rate, is_active')
          .eq('organization_id', orgId)
          .eq('tax_authority_id', authorityId)
          .eq('is_active', true)
          .order('rate', { ascending: false })
          .limit(1);
        if (tc && tc.length > 0) {
          defaultRate = Number(tc[0].rate ?? 0);
          defaultRateCode = tc[0].code ?? null;
        }
      }

      // 3) Income accounts for this org
      const { data: accounts, error: aErr } = await supabase
        .from('accounts')
        .select('id, code, name, account_type')
        .eq('organization_id', orgId)
        .eq('account_type', 'income');
      if (aErr) throw aErr;

      const accountMap = new Map<string, { code: string; name: string }>();
      for (const a of accounts ?? []) {
        accountMap.set(a.id, { code: a.code, name: a.name });
      }
      const incomeAccountIds = (accounts ?? []).map((a: any) => a.id);
      if (incomeAccountIds.length === 0) {
        return emptyResult(Number(glTotal ?? 0), taxCodedSales, reportedTaxCollected, defaultRate, defaultRateCode);
      }

      // 4) Pull all journal_entry_lines on income accounts in window
      // PostgREST: filter via inner join on journal_entries
      type Row = {
        id: string;
        account_id: string;
        debit: number | null;
        credit: number | null;
        base_currency_debit: number | null;
        base_currency_credit: number | null;
        tax_code_id: string | null;
        description: string | null;
        source_document_type: string | null;
        source_document_id: string | null;
        journal_entry_id: string;
        journal_entries: {
          id: string;
          organization_id: string;
          entry_date: string;
          status: string;
          reference: string | null;
        };
      };
      const allRows: Row[] = [];
      let from = 0;
      // Chunk by accounts to keep `in()` lists small enough
      const chunkSize = 200;
      const accountChunks: string[][] = [];
      for (let i = 0; i < incomeAccountIds.length; i += chunkSize) {
        accountChunks.push(incomeAccountIds.slice(i, i + chunkSize));
      }
      for (const chunk of accountChunks) {
        from = 0;
        // Paginate within chunk
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await supabase
            .from('journal_entry_lines')
            .select(
              `id, account_id, debit, credit, base_currency_debit, base_currency_credit,
               tax_code_id, description, source_document_type, source_document_id,
               journal_entry_id,
               journal_entries!inner(id, organization_id, entry_date, status, reference)`,
            )
            .in('account_id', chunk)
            .eq('journal_entries.organization_id', orgId)
            .in('journal_entries.status', ['posted', 'reversed'])
            .gte('journal_entries.entry_date', periodStart!)
            .lte('journal_entries.entry_date', periodEnd!)
            .range(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allRows.push(...(data as unknown as Row[]));
          if (data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
      }

      // 5) Detect "settlement-only" entries (no income/expense lines on entry)
      // Any income line in our scope means the entry has an income line, so
      // these by definition are not settlement-only. Nothing to filter here.
      // FX accounts are already excluded from GL total by the RPC; we exclude
      // them here too so the by-account table ties to line 101.
      const byAccount = new Map<string, ReconAccountRow>();
      const untaxedLines: UntaxedLine[] = [];
      let fxExcluded = 0;

      for (const r of allRows) {
        const acct = accountMap.get(r.account_id);
        if (!acct) continue;
        const credit = Number(r.base_currency_credit ?? r.credit ?? 0);
        const debit = Number(r.base_currency_debit ?? r.debit ?? 0);
        const net = credit - debit;
        if (FX_RE.test(acct.name)) {
          fxExcluded += net;
          continue;
        }
        let row = byAccount.get(r.account_id);
        if (!row) {
          row = {
            account_id: r.account_id,
            account_code: acct.code,
            account_name: acct.name,
            gl_net: 0,
            taxed_net: 0,
            untaxed_net: 0,
            is_zero_or_exempt: ZERO_EXEMPT_RE.test(acct.name),
            untaxed_lines: 0,
          };
          byAccount.set(r.account_id, row);
        }
        row.gl_net += net;
        if (r.tax_code_id) {
          row.taxed_net += net;
        } else {
          row.untaxed_net += net;
          row.untaxed_lines += 1;
          if (Math.abs(net) >= 0.01) {
            untaxedLines.push({
              id: r.id,
              journal_entry_id: r.journal_entry_id,
              entry_date: r.journal_entries.entry_date,
              reference: r.journal_entries.reference,
              description: r.description,
              account_id: r.account_id,
              account_code: acct.code,
              account_name: acct.name,
              amount: net,
              source_document_type: r.source_document_type,
              source_document_id: r.source_document_id,
            });
          }
        }
      }

      // Round
      const round = (n: number) => Math.round(n * 100) / 100;
      const byAccountArr = Array.from(byAccount.values())
        .map((r) => ({
          ...r,
          gl_net: round(r.gl_net),
          taxed_net: round(r.taxed_net),
          untaxed_net: round(r.untaxed_net),
        }))
        .sort((a, b) => Math.abs(b.untaxed_net) - Math.abs(a.untaxed_net));

      const glIncomeTotal = round(Number(glTotal ?? 0));
      const untaxedRevenue = round(
        byAccountArr
          .filter((r) => !r.is_zero_or_exempt)
          .reduce((s, r) => s + r.untaxed_net, 0),
      );
      const expectedTaxAtDefaultRate =
        defaultRate != null ? round((untaxedRevenue * defaultRate) / 100) : 0;

      untaxedLines.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

      return {
        glIncomeTotal,
        taxCodedSales,
        reportedTaxCollected,
        expectedTaxAtDefaultRate,
        defaultRate,
        defaultRateCode,
        untaxedRevenue,
        byAccount: byAccountArr,
        untaxedLines: untaxedLines.slice(0, 500),
        fxExcluded: round(fxExcluded),
        settlementsExcluded: 0,
      };
    },
  });
}

function emptyResult(
  glIncomeTotal: number,
  taxCodedSales: number,
  reportedTaxCollected: number,
  defaultRate: number | null,
  defaultRateCode: string | null,
): TaxReconciliationResult {
  return {
    glIncomeTotal: Math.round(glIncomeTotal * 100) / 100,
    taxCodedSales,
    reportedTaxCollected,
    expectedTaxAtDefaultRate: 0,
    defaultRate,
    defaultRateCode,
    untaxedRevenue: 0,
    byAccount: [],
    untaxedLines: [],
    fxExcluded: 0,
    settlementsExcluded: 0,
  };
}

export function useDefaultGstHstAuthority() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['default-gst-hst-authority', organization?.id],
    enabled: Boolean(organization?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_authorities')
        .select('id, name, region, reporting_currency, country_id')
        .eq('organization_id', organization!.id)
        .eq('is_active', true);
      if (error) throw error;
      const list = data ?? [];
      const gst =
        list.find((a) => /gst|hst/i.test(a.name)) ??
        list[0] ??
        null;
      return gst;
    },
  });
}
