import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { useMultiCurrencySettings } from './useMultiCurrencySettings';
import { unrealizedFxGainLoss } from '@/lib/fxPosting';
import { createJournalEntry } from './useJournalEntryCreation';
import { toast } from 'sonner';

export interface RevaluationPreviewLine {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  currency: string;
  balance_fc: number;
  base_balance_before: number;
  closing_rate: number;
  historical_rate: number | null;
  base_balance_after: number;
  gain_loss: number;
}

export interface RevaluationHeader {
  id: string;
  period_end: string;
  status: 'draft' | 'posted' | 'reversed';
  total_unrealized_gain: number;
  total_unrealized_loss: number;
  journal_entry_id: string | null;
  reversal_journal_entry_id: string | null;
  created_at: string;
  notes: string | null;
}

const toCents = (n: number) => Math.round(n * 100);

/**
 * Builds revaluation preview lines for a given period-end.
 * Pulls foreign-currency JE lines (AR/AP/Bank) grouped by account+currency,
 * sums FC balance, applies the closing rate, computes unrealized gain/loss.
 */
async function buildPreview(
  organizationId: string,
  periodEnd: string,
  baseCurrency: string,
): Promise<RevaluationPreviewLine[]> {
  // 1) Fetch all posted JE lines up to period_end with non-null currency != base
  const { data: lines, error: linesErr } = await supabase
    .from('journal_entry_lines')
    .select(`
      account_id, debit, credit, currency, exchange_rate,
      accounts!inner(id, code, name, account_type, organization_id),
      journal_entries!inner(entry_date, status, organization_id)
    `)
    .eq('accounts.organization_id', organizationId)
    .eq('journal_entries.organization_id', organizationId)
    .eq('journal_entries.status', 'posted')
    .lte('journal_entries.entry_date', periodEnd)
    .not('currency', 'is', null);

  if (linesErr) throw linesErr;

  // Filter foreign-currency lines on relevant account types
  const relevantTypes = ['asset', 'liability'];
  const filtered = (lines || []).filter((l: any) =>
    l.currency && l.currency !== baseCurrency &&
    relevantTypes.includes(l.accounts.account_type),
  );

  // 2) Group by account+currency, sum FC and base balances
  const groups = new Map<string, RevaluationPreviewLine>();
  for (const l of filtered as any[]) {
    const key = `${l.account_id}__${l.currency}`;
    const fcAmt = (Number(l.debit) || 0) - (Number(l.credit) || 0);
    const rate = Number(l.exchange_rate) || 1;
    const baseAmt = (toCents(fcAmt) * rate) / 100;
    const existing = groups.get(key);
    if (existing) {
      existing.balance_fc += fcAmt;
      existing.base_balance_before += baseAmt;
    } else {
      groups.set(key, {
        account_id: l.account_id,
        account_code: l.accounts.code,
        account_name: l.accounts.name,
        account_type: l.accounts.account_type,
        currency: l.currency,
        balance_fc: fcAmt,
        base_balance_before: baseAmt,
        closing_rate: rate,
        historical_rate: rate,
        base_balance_after: baseAmt,
        gain_loss: 0,
      });
    }
  }

  if (groups.size === 0) return [];

  // 3) Fetch closing rates per currency at period_end
  const currencies = [...new Set([...groups.values()].map(g => g.currency))];
  const { data: rates } = await supabase
    .from('exchange_rates')
    .select('from_currency, to_currency, rate, effective_date')
    .eq('organization_id', organizationId)
    .in('from_currency', currencies)
    .eq('to_currency', baseCurrency)
    .lte('effective_date', periodEnd)
    .order('effective_date', { ascending: false });

  const closingRates = new Map<string, number>();
  for (const r of rates || []) {
    if (!closingRates.has(r.from_currency)) {
      closingRates.set(r.from_currency, Number(r.rate));
    }
  }

  // 4) Compute closing balance + gain/loss
  const result: RevaluationPreviewLine[] = [];
  for (const g of groups.values()) {
    if (Math.abs(g.balance_fc) < 0.005) continue; // skip zero balances
    const closing = closingRates.get(g.currency) ?? g.closing_rate;
    const historical = g.base_balance_before / (g.balance_fc || 1);
    const baseAfterCents = Math.round(toCents(g.balance_fc) * closing);
    const gainLossCents = baseAfterCents - toCents(g.base_balance_before);
    result.push({
      ...g,
      closing_rate: closing,
      historical_rate: historical,
      base_balance_after: baseAfterCents / 100,
      gain_loss: gainLossCents / 100,
    });
  }
  return result.sort((a, b) => a.account_code.localeCompare(b.account_code));
}

export function useRevaluationPreview(periodEnd: string | null) {
  const { organization } = useCurrentOrganization();
  const { settings } = useMultiCurrencySettings();
  const orgId = organization?.id;
  const baseCurrency = settings?.base_currency || 'USD';

  return useQuery({
    queryKey: ['revaluation-preview', orgId, periodEnd, baseCurrency],
    queryFn: () => buildPreview(orgId!, periodEnd!, baseCurrency),
    enabled: !!orgId && !!periodEnd && !!settings?.multi_currency_enabled,
  });
}

export function useRevaluations() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;

  return useQuery({
    queryKey: ['currency-revaluations', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('currency_revaluations')
        .select('*')
        .eq('organization_id', orgId)
        .order('period_end', { ascending: false });
      if (error) throw error;
      return data as RevaluationHeader[];
    },
    enabled: !!orgId,
  });
}

export function usePostRevaluation() {
  const { organization } = useCurrentOrganization();
  const { settings } = useMultiCurrencySettings();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodEnd, lines, notes }: {
      periodEnd: string;
      lines: RevaluationPreviewLine[];
      notes?: string;
    }) => {
      if (!organization?.id) throw new Error('No organization');
      if (!settings?.unrealized_fx_account_id) {
        throw new Error('Configure the Unrealized FX Gain/Loss account in Multi-Currency settings');
      }

      const totalGain = lines.filter(l => l.gain_loss > 0).reduce((s, l) => s + l.gain_loss, 0);
      const totalLoss = lines.filter(l => l.gain_loss < 0).reduce((s, l) => s + Math.abs(l.gain_loss), 0);

      // Create header (draft)
      const { data: header, error: headerErr } = await supabase
        .from('currency_revaluations')
        .insert({
          organization_id: organization.id,
          period_end: periodEnd,
          status: 'draft',
          total_unrealized_gain: totalGain,
          total_unrealized_loss: totalLoss,
          notes: notes || null,
        })
        .select()
        .single();
      if (headerErr) throw headerErr;

      // Insert lines
      if (lines.length > 0) {
        const { error: linesErr } = await supabase
          .from('currency_revaluation_lines')
          .insert(lines.map(l => ({
            revaluation_id: header.id,
            account_id: l.account_id,
            currency: l.currency,
            balance_fc: l.balance_fc,
            base_balance_before: l.base_balance_before,
            base_balance_after: l.base_balance_after,
            closing_rate: l.closing_rate,
            historical_rate: l.historical_rate,
            gain_loss: l.gain_loss,
          })));
        if (linesErr) throw linesErr;
      }

      // Build JE: per-account adjustment vs unrealized FX account
      const jeLines: { account_id: string; debit: number; credit: number; memo?: string }[] = [];
      for (const l of lines) {
        if (Math.abs(l.gain_loss) < 0.005) continue;
        if (l.gain_loss > 0) {
          // Asset gain: DR Asset, CR Unrealized FX (gain) — or for liability, opposite
          if (l.account_type === 'asset') {
            jeLines.push({ account_id: l.account_id, debit: l.gain_loss, credit: 0, memo: `FX reval ${l.currency}` });
            jeLines.push({ account_id: settings.unrealized_fx_account_id!, debit: 0, credit: l.gain_loss, memo: `FX gain ${l.account_code}` });
          } else {
            jeLines.push({ account_id: settings.unrealized_fx_account_id!, debit: l.gain_loss, credit: 0, memo: `FX loss ${l.account_code}` });
            jeLines.push({ account_id: l.account_id, debit: 0, credit: l.gain_loss, memo: `FX reval ${l.currency}` });
          }
        } else {
          const amt = Math.abs(l.gain_loss);
          if (l.account_type === 'asset') {
            jeLines.push({ account_id: settings.unrealized_fx_account_id!, debit: amt, credit: 0, memo: `FX loss ${l.account_code}` });
            jeLines.push({ account_id: l.account_id, debit: 0, credit: amt, memo: `FX reval ${l.currency}` });
          } else {
            jeLines.push({ account_id: l.account_id, debit: amt, credit: 0, memo: `FX reval ${l.currency}` });
            jeLines.push({ account_id: settings.unrealized_fx_account_id!, debit: 0, credit: amt, memo: `FX gain ${l.account_code}` });
          }
        }
      }

      let jeId: string | null = null;
      if (jeLines.length > 0) {
        jeId = await createJournalEntry({
          organizationId: organization.id,
          date: periodEnd,
          description: `Currency revaluation @ ${periodEnd}`,
          journalType: 'adjustment',
          status: 'posted',
          lines: jeLines,
        });
      }

      // Promote to posted, link JE
      const { error: updErr } = await supabase
        .from('currency_revaluations')
        .update({ status: 'posted', journal_entry_id: jeId })
        .eq('id', header.id);
      if (updErr) throw updErr;

      return header.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currency-revaluations'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast.success('Revaluation posted');
    },
    onError: (e: Error) => toast.error(`Revaluation failed: ${e.message}`),
  });
}
