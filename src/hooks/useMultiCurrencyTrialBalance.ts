import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { useReportFilters } from './useReportFilters';

export interface McTrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  currency: string;
  fc_debit: number;
  fc_credit: number;
  fc_balance: number;
  rate: number;
  base_debit: number;
  base_credit: number;
  base_balance: number;
}

/**
 * Computes a multi-currency trial balance — one row per (account, currency).
 * Pass `divisionIds` to filter by Division (multidimensional accounting).
 * Empty array = consolidated across all divisions.
 */
export function useMultiCurrencyTrialBalance(divisionIds: string[] = []) {
  const { organization } = useCurrentOrganization();
  const { startDate, endDate } = useReportFilters();
  const orgId = organization?.id;

  const startStr = startDate instanceof Date ? startDate.toISOString().slice(0, 10) : String(startDate);
  const endStr = endDate instanceof Date ? endDate.toISOString().slice(0, 10) : String(endDate);
  const divKey = divisionIds.slice().sort().join(',');

  return useQuery({
    queryKey: ['mc-trial-balance', orgId, startStr, endStr, divKey],
    queryFn: async (): Promise<McTrialBalanceRow[]> => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit,
          credit,
          currency,
          exchange_rate,
          account_id,
          department_id,
          accounts!inner(id, code, name, organization_id),
          journal_entries!inner(entry_date, status, organization_id, department_id)
        `)
        .eq('accounts.organization_id', orgId)
        .gte('journal_entries.entry_date', startStr)
        .lte('journal_entries.entry_date', endStr)
        .in('journal_entries.status', ['posted', 'reversed']);

      if (error) throw error;

      const allowed = divisionIds.length > 0 ? new Set(divisionIds) : null;
      const map = new Map<string, McTrialBalanceRow>();

      for (const line of (data || []) as any[]) {
        const effDept = line.department_id ?? line.journal_entries?.department_id ?? null;
        if (allowed && (!effDept || !allowed.has(effDept))) continue;

        const a = line.accounts;
        const cur = line.currency || 'USD';
        const key = `${a.id}|${cur}`;
        const rate = Number(line.exchange_rate) || 1;
        const debit = Number(line.debit) || 0;
        const credit = Number(line.credit) || 0;
        const baseDebit = Math.round(debit * rate * 100) / 100;
        const baseCredit = Math.round(credit * rate * 100) / 100;

        if (!map.has(key)) {
          map.set(key, {
            account_id: a.id,
            account_code: a.code,
            account_name: a.name,
            currency: cur,
            fc_debit: 0,
            fc_credit: 0,
            fc_balance: 0,
            rate,
            base_debit: 0,
            base_credit: 0,
            base_balance: 0,
          });
        }
        const row = map.get(key)!;
        row.fc_debit += debit;
        row.fc_credit += credit;
        row.base_debit += baseDebit;
        row.base_credit += baseCredit;
        row.rate = rate;
      }

      const rows = Array.from(map.values()).map(r => ({
        ...r,
        fc_balance: Math.round((r.fc_debit - r.fc_credit) * 100) / 100,
        base_balance: Math.round((r.base_debit - r.base_credit) * 100) / 100,
      }));

      rows.sort((a, b) => a.account_code.localeCompare(b.account_code) || a.currency.localeCompare(b.currency));
      return rows;
    },
    enabled: !!orgId,
  });
}
