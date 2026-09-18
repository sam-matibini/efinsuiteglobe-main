import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  buildPeriodFilingForm,
  buildTaxDetailRows,
  classifyTaxAccountName,
  groupTaxDetailByCode,
  isProvincialTaxHaystack,
  mergePeriodSummary,
  summarizeJournalTaxLines,
  summarizeTaxMovements,
  toISODate,
  type JournalTaxLine,
  type TaxComparisonRange,
  type TaxMovementRow,
  type TaxReportCategory,
} from '@/lib/taxPeriodReport';

export interface TaxPeriodAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  type: 'collected' | 'paid' | 'pst';
}

export interface TaxPeriodActivityInput {
  organizationId?: string;
  countryCode: string;
  periodStart: string;
  periodEnd: string;
  category: TaxReportCategory;
  accountTypeFilter?: 'all' | 'collected' | 'paid' | 'pst';
  selectedTaxCodes?: string[];
  authorityLabel: string;
}

export function useTaxPeriodActivity({
  organizationId,
  countryCode,
  periodStart,
  periodEnd,
  category,
  accountTypeFilter = 'all',
  selectedTaxCodes = [],
  authorityLabel,
}: TaxPeriodActivityInput) {
  const isCanada = countryCode === 'CA';

  const accountsQuery = useQuery({
    queryKey: ['tax-report-accounts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as TaxPeriodAccount[];
      const { data, error } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('organization_id', organizationId)
        .or('name.ilike.%gst%,name.ilike.%hst%,name.ilike.%pst%,name.ilike.%vat%,name.ilike.%tax collected%,name.ilike.%tax paid%,name.ilike.%input tax%,name.ilike.%qst%,name.ilike.%tva%');
      if (error) throw error;
      return (data || []).flatMap((acc) => {
        const nameLower = acc.name.toLowerCase();
        const side = classifyTaxAccountName(acc.name);
        if (!side) return [];
        let type: TaxPeriodAccount['type'] = side;
        if (isProvincialTaxHaystack(nameLower) && side === 'collected') type = 'pst';
        return [{
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          type,
        }];
      });
    },
    enabled: !!organizationId,
  });

  const taxCodesQuery = useQuery({
    queryKey: ['tax-codes-filter', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('tax_codes')
        .select('id, code, name, jurisdiction, rate, gl_collected_account_id, gl_paid_account_id')
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  const movementsQuery = useQuery({
    queryKey: ['tax-period-movements', organizationId, periodStart, periodEnd],
    queryFn: async () => {
      if (!organizationId) return { movements: [] as TaxMovementRow[], revenue: 0 };
      return fetchPeriodMovements(organizationId, periodStart, periodEnd);
    },
    enabled: !!organizationId,
  });

  const taxAccounts = accountsQuery.data ?? [];

  const journalQuery = useQuery({
    queryKey: ['tax-report-journal', organizationId, periodStart, periodEnd, taxAccounts.map((a) => a.accountId).join(',')],
    queryFn: async () => {
      if (!organizationId || taxAccounts.length === 0) return [] as JournalTaxLine[];
      const accountsMap = new Map(taxAccounts.map((a) => [a.accountId, a]));
      const PAGE_SIZE = 1000;
      const rows: JournalTaxLine[] = [];

      for (let offset = 0; offset < 20; offset += 1) {
        const from = offset * PAGE_SIZE;
        const { data: lines, error: linesError } = await supabase
          .from('journal_entry_lines')
          .select(`
            id,
            journal_entry_id,
            account_id,
            debit,
            credit,
            description,
            journal_entries!inner(id, entry_date, description, reference, status, organization_id)
          `)
          .in('account_id', taxAccounts.map((a) => a.accountId))
          .eq('journal_entries.organization_id', organizationId)
          .in('journal_entries.status', ['posted', 'reversed'])
          .gte('journal_entries.entry_date', periodStart)
          .lte('journal_entries.entry_date', periodEnd)
          .range(from, from + PAGE_SIZE - 1);

        if (linesError) throw linesError;
        if (!lines || lines.length === 0) break;

        for (const line of lines as any[]) {
          const je = line.journal_entries;
          if (String(je?.reference || '').startsWith('CLOSE-')) continue;
          const acc = accountsMap.get(line.account_id);
          const taxCodeMatch = String(line.description || je?.description || '').match(/^(GST|HST|PST|QST|VAT)(\s*-\s*\w+)?/i);
          rows.push({
            entry_date: je?.entry_date,
            description: je?.description || line.description,
            line_description: line.description,
            reference: je?.reference,
            debit: Number(line.debit || 0),
            credit: Number(line.credit || 0),
            account_code: acc?.accountCode,
            account_name: acc?.accountName || '',
            tax_code: taxCodeMatch ? taxCodeMatch[0].trim() : undefined,
          });
        }

        if (lines.length < PAGE_SIZE) break;
      }

      return rows;
    },
    enabled: !!organizationId && taxAccounts.length > 0,
  });

  const journalDetails = useMemo(() => {
    const codeByAccount = new Map<string, string>();
    for (const tc of taxCodesQuery.data ?? []) {
      const collectedId = (tc as { gl_collected_account_id?: string | null }).gl_collected_account_id;
      const paidId = (tc as { gl_paid_account_id?: string | null }).gl_paid_account_id;
      if (collectedId) {
        const acc = taxAccounts.find((a) => a.accountId === collectedId);
        if (acc?.accountCode) codeByAccount.set(acc.accountCode, tc.code);
        if (acc?.accountName) codeByAccount.set(acc.accountName, tc.code);
      }
      if (paidId) {
        const acc = taxAccounts.find((a) => a.accountId === paidId);
        if (acc?.accountCode) codeByAccount.set(acc.accountCode, tc.code);
        if (acc?.accountName) codeByAccount.set(acc.accountName, tc.code);
      }
    }

    let details = (journalQuery.data ?? []).map((line) => ({
      ...line,
      tax_code: line.tax_code
        || (line.account_code ? codeByAccount.get(line.account_code) : undefined)
        || codeByAccount.get(line.account_name)
        || undefined,
    }));
    if (isCanada && category !== 'all') {
      details = details.filter((line) => {
        const nameLower = line.account_name?.toLowerCase() || '';
        const codeLower = line.tax_code?.toLowerCase() || '';
        if (category === 'gst') {
          return (nameLower.includes('gst') || nameLower.includes('hst') ||
                  codeLower.includes('gst') || codeLower.includes('hst')) &&
                 !nameLower.includes('pst') && !codeLower.includes('pst') &&
                 !nameLower.includes('qst') && !codeLower.includes('qst');
        }
        return nameLower.includes('pst') || nameLower.includes('qst') ||
               codeLower.includes('pst') || codeLower.includes('qst');
      });
    }
    if (selectedTaxCodes.length > 0) {
      details = details.filter((j) => j.tax_code && selectedTaxCodes.includes(j.tax_code));
    }
    if (accountTypeFilter === 'collected' || accountTypeFilter === 'paid') {
      details = details.filter((j) => classifyTaxAccountName(j.account_name) === accountTypeFilter);
    }
    return details;
  }, [journalQuery.data, isCanada, category, selectedTaxCodes, accountTypeFilter, taxCodesQuery.data, taxAccounts]);

  const allTaxCodes = useMemo(() => {
    const tableCodes = taxCodesQuery.data ?? [];
    if (tableCodes.length > 0) return tableCodes;
    const codes = new Set<string>();
    (journalQuery.data ?? []).forEach((line) => {
      if (line.tax_code) codes.add(line.tax_code);
    });
    return Array.from(codes).map((code) => ({
      id: code,
      code,
      name: code,
      jurisdiction: null as string | null,
      rate: 0,
    }));
  }, [taxCodesQuery.data, journalQuery.data]);

  const rateByCode = useMemo(() => {
    const rates: Record<string, number> = {};
    for (const code of allTaxCodes) {
      if (code.code) rates[code.code] = Number((code as { rate?: number }).rate ?? 0);
    }
    return rates;
  }, [allTaxCodes]);

  const reportCategory: TaxReportCategory = isCanada ? category : 'all';

  const periodSummary = useMemo(() => {
    const journal = summarizeJournalTaxLines(journalDetails, reportCategory, rateByCode);
    const rpc = summarizeTaxMovements(
      movementsQuery.data?.movements ?? [],
      reportCategory,
      movementsQuery.data?.revenue ?? 0,
    );
    const journalReady =
      accountsQuery.isSuccess &&
      (taxAccounts.length === 0 || journalQuery.isSuccess);
    return mergePeriodSummary(journal, rpc, journalReady);
  }, [
    journalDetails,
    reportCategory,
    rateByCode,
    movementsQuery.data,
    accountsQuery.isSuccess,
    taxAccounts.length,
    journalQuery.isSuccess,
  ]);

  const detailRows = useMemo(
    () => buildTaxDetailRows(journalDetails, rateByCode),
    [journalDetails, rateByCode],
  );

  const detailGroups = useMemo(() => groupTaxDetailByCode(detailRows), [detailRows]);

  const filingForm = useMemo(() => buildPeriodFilingForm(periodSummary, {
    authority: authorityLabel,
    periodStart,
    periodEnd,
    currency: countryCode === 'US' ? 'USD' : countryCode === 'GB' ? 'GBP' : countryCode === 'BI' ? 'BIF' : 'CAD',
    countryCode,
    region: isCanada ? (category === 'pst' ? 'CA-BC' : 'CA-ON') : countryCode,
  }), [periodSummary, authorityLabel, periodStart, periodEnd, countryCode, isCanada, category]);

  const filteredTaxCodes = useMemo(() => {
    if (!isCanada) return allTaxCodes;
    return allTaxCodes.filter((tc) => {
      const codeLower = tc.code.toLowerCase();
      if (category === 'gst') {
        return codeLower.includes('gst') || codeLower.includes('hst') ||
               (!codeLower.includes('pst') && !codeLower.includes('qst'));
      }
      return codeLower.includes('pst') || codeLower.includes('qst');
    });
  }, [allTaxCodes, isCanada, category]);

  return {
    taxAccounts,
    allTaxCodes: filteredTaxCodes,
    journalDetails,
    periodSummary,
    detailRows,
    detailGroups,
    filingForm,
    isLoading: accountsQuery.isLoading || (taxAccounts.length > 0 && journalQuery.isLoading) || movementsQuery.isLoading,
    isRefreshing: journalQuery.isFetching || movementsQuery.isFetching,
    refetch: () => Promise.all([movementsQuery.refetch(), journalQuery.refetch()]),
  };
}

async function fetchPeriodMovements(organizationId: string, periodStart: string, periodEnd: string) {
  const [{ data, error }, { data: revenue, error: revErr }] = await Promise.all([
    (supabase.rpc as any)('get_tax_movements_by_code', {
      p_org_id: organizationId,
      p_start_date: periodStart,
      p_end_date: periodEnd,
    }),
    (supabase.rpc as any)('get_period_revenue_total', {
      p_org_id: organizationId,
      p_start_date: periodStart,
      p_end_date: periodEnd,
    }),
  ]);
  if (error) throw error;
  if (revErr) throw revErr;
  return {
    movements: (data ?? []) as TaxMovementRow[],
    revenue: Number(revenue ?? 0),
  };
}

export function useTaxPeriodComparisonSummaries({
  organizationId,
  ranges,
  category,
  enabled,
}: {
  organizationId?: string;
  ranges: TaxComparisonRange[];
  category: TaxReportCategory;
  enabled: boolean;
}) {
  const queries = useQueries({
    queries: ranges.map((range) => {
      const start = toISODate(range.start);
      const end = toISODate(range.end);
      return {
        queryKey: ['tax-period-movements', organizationId, start, end],
        enabled: enabled && !!organizationId,
        queryFn: () => fetchPeriodMovements(organizationId!, start, end),
      };
    }),
  });

  return ranges.map((range, index) => {
    const data = queries[index]?.data;
    return {
      ...range,
      isLoading: queries[index]?.isLoading ?? false,
      summary: summarizeTaxMovements(data?.movements ?? [], category, data?.revenue ?? 0),
    };
  });
}
