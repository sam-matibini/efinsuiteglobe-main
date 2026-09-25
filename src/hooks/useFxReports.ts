import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { useReportFilters } from './useReportFilters';

export interface FxLineItem {
  date: string;
  account_code: string;
  account_name: string;
  account_id: string;
  currency: string;
  amount_fc: number;
  rate: number;
  base_amount: number;
  type: 'realized' | 'unrealized';
  reference: string;
}

export interface FxReportSummary {
  totalRealizedGain: number;
  totalRealizedLoss: number;
  totalUnrealizedGain: number;
  totalUnrealizedLoss: number;
  netImpact: number;
  byCurrency: Record<string, { realized: number; unrealized: number; net: number }>;
  lines: FxLineItem[];
}

/** Aggregates realized + unrealized FX gain/loss postings for the current period. */
export function useFxGainLossReport() {
  const { organization } = useCurrentOrganization();
  const { startDate, endDate } = useReportFilters();
  const orgId = organization?.id;

  const startStr = startDate instanceof Date ? startDate.toISOString().slice(0, 10) : String(startDate);
  const endStr = endDate instanceof Date ? endDate.toISOString().slice(0, 10) : String(endDate);

  return useQuery({
    queryKey: ['fx-gain-loss-report', orgId, startStr, endStr],
    queryFn: async (): Promise<FxReportSummary> => {
      if (!orgId) throw new Error('No organization');

      // Find FX accounts via organization settings
      const { data: org } = await supabase
        .from('organizations')
        .select('realized_fx_account_id, unrealized_fx_account_id, cta_account_id')
        .eq('id', orgId)
        .single();

      const fxAccountIds = [
        org?.realized_fx_account_id,
        org?.unrealized_fx_account_id,
        org?.cta_account_id,
      ].filter(Boolean) as string[];

      const summary: FxReportSummary = {
        totalRealizedGain: 0,
        totalRealizedLoss: 0,
        totalUnrealizedGain: 0,
        totalUnrealizedLoss: 0,
        netImpact: 0,
        byCurrency: {},
        lines: [],
      };

      if (fxAccountIds.length === 0) return summary;

      // Query JE lines posted to FX accounts in the period
      const { data: lines, error } = await supabase
        .from('journal_entry_lines')
        .select(`
          id,
          debit,
          credit,
          currency,
          exchange_rate,
          description,
          account_id,
          accounts!inner(id, code, name),
          journal_entries!inner(id, entry_date, status, reference, organization_id)
        `)
        .in('account_id', fxAccountIds)
        .gte('journal_entries.entry_date', startStr)
        .lte('journal_entries.entry_date', endStr)
        .in('journal_entries.status', ['posted', 'reversed'])
        .eq('journal_entries.organization_id', orgId);

      if (error) throw error;

      for (const line of lines || []) {
        const lineAny = line as any;
        const acct = lineAny.accounts;
        const je = lineAny.journal_entries;
        const debit = Number(lineAny.debit) || 0;
        const credit = Number(lineAny.credit) || 0;
        // For revenue/expense FX accounts: credit = gain, debit = loss
        const baseAmount = credit - debit;
        const isRealized = acct.id === org?.realized_fx_account_id;
        const type: 'realized' | 'unrealized' = isRealized ? 'realized' : 'unrealized';
        const currency = lineAny.currency || 'USD';

        summary.lines.push({
          date: je.entry_date,
          account_code: acct.code,
          account_name: acct.name,
          account_id: acct.id,
          currency,
          amount_fc: 0,
          rate: Number(lineAny.exchange_rate) || 1,
          base_amount: baseAmount,
          type,
          reference: je.reference || lineAny.description || '',
        });

        if (type === 'realized') {
          if (baseAmount >= 0) summary.totalRealizedGain += baseAmount;
          else summary.totalRealizedLoss += Math.abs(baseAmount);
        } else {
          if (baseAmount >= 0) summary.totalUnrealizedGain += baseAmount;
          else summary.totalUnrealizedLoss += Math.abs(baseAmount);
        }

        if (!summary.byCurrency[currency]) {
          summary.byCurrency[currency] = { realized: 0, unrealized: 0, net: 0 };
        }
        if (type === 'realized') summary.byCurrency[currency].realized += baseAmount;
        else summary.byCurrency[currency].unrealized += baseAmount;
        summary.byCurrency[currency].net += baseAmount;
      }

      summary.netImpact =
        summary.totalRealizedGain -
        summary.totalRealizedLoss +
        summary.totalUnrealizedGain -
        summary.totalUnrealizedLoss;

      // Sort lines descending by date
      summary.lines.sort((a, b) => b.date.localeCompare(a.date));

      return summary;
    },
    enabled: !!orgId,
  });
}
