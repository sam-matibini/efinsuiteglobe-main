import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { countryCurrency, currencyOption, recommendedBaseCurrency } from '@/lib/currencyOptions';

export interface MultiCurrencySettings {
  multi_currency_enabled: boolean;
  base_currency: string;
  reporting_currency: string | null;
  base_currency_locked_at: string | null;
  realized_fx_account_id: string | null;
  unrealized_fx_account_id: string | null;
  cta_account_id: string | null;
  fx_rate_source: 'manual' | 'automated';
  fx_rate_sync_frequency: 'daily' | 'hourly';
  /** Country the organization is based in, and that country's currency (e.g. Nigeria → NGN). */
  country_name: string | null;
  country_currency: string | null;
  /** Base currency to suggest when enabling: the country's currency first. */
  recommended_base: string;
}

export function useMultiCurrencySettings() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  const settingsQuery = useQuery({
    queryKey: ['multi-currency-settings', orgId],
    queryFn: async (): Promise<MultiCurrencySettings | null> => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select(`
          currency,
          country,
          multi_currency_enabled,
          reporting_currency,
          base_currency_locked_at,
          realized_fx_account_id,
          unrealized_fx_account_id,
          cta_account_id,
          fx_rate_source,
          fx_rate_sync_frequency
        `)
        .eq('id', orgId)
        .single();
      if (error) throw error;
      const row = data as typeof data & { currency: string | null; country: string | null };
      const cc = countryCurrency(row.country);
      const recommended = recommendedBaseCurrency(row);
      return {
        multi_currency_enabled: !!data.multi_currency_enabled,
        base_currency: (row.currency || recommended).toUpperCase(),
        country_name: cc?.countryName ?? row.country ?? null,
        country_currency: cc?.currency ?? null,
        recommended_base: recommended,
        reporting_currency: data.reporting_currency,
        base_currency_locked_at: data.base_currency_locked_at,
        realized_fx_account_id: data.realized_fx_account_id,
        unrealized_fx_account_id: data.unrealized_fx_account_id,
        cta_account_id: data.cta_account_id,
        fx_rate_source: (data.fx_rate_source as 'manual' | 'automated') || 'manual',
        fx_rate_sync_frequency: (data.fx_rate_sync_frequency as 'daily' | 'hourly') || 'daily',
      };
    },
    enabled: !!orgId,
  });

  // Journal lines recorded in a currency other than the base currency. While
  // there are none, a wrongly locked base currency can still be corrected.
  const baseForCheck = settingsQuery.data?.base_currency;
  const foreignActivityQuery = useQuery({
    queryKey: ['multi-currency-foreign-lines', orgId, baseForCheck],
    enabled: !!orgId && !!baseForCheck,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('journal_entry_lines')
        .select('id, journal_entries!inner(organization_id)', { count: 'exact', head: true })
        .eq('journal_entries.organization_id', orgId!)
        .not('currency', 'is', null)
        .neq('currency', baseForCheck!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  /** Marks `code` as the base in the currency master list, adding it if missing. */
  const syncBaseCurrencyRow = async (code: string) => {
    const { data: rows, error } = await supabase.from('currencies').select('id, code').eq('organization_id', orgId!);
    if (error) throw error;
    await supabase.from('currencies').update({ is_base: false }).eq('organization_id', orgId!).neq('code', code);
    const existing = (rows ?? []).find((r) => r.code === code);
    if (existing) {
      const { error: e } = await supabase.from('currencies').update({ is_base: true, is_active: true }).eq('id', existing.id);
      if (e) throw e;
    } else {
      const opt = currencyOption(code);
      const { error: e } = await supabase.from('currencies').insert({
        organization_id: orgId!, code, name: opt?.name ?? code, symbol: opt?.symbol ?? code,
        decimal_places: code === 'JPY' ? 0 : 2, is_base: true, is_active: true,
      });
      if (e) throw e;
    }
  };

  const updateSettings = useMutation({
    mutationFn: async (input: Partial<MultiCurrencySettings>) => {
      if (!orgId) throw new Error('No organization');
      const payload: Record<string, unknown> = {};
      if (input.multi_currency_enabled !== undefined) payload.multi_currency_enabled = input.multi_currency_enabled;
      if (input.base_currency !== undefined) payload.currency = input.base_currency;
      if (input.reporting_currency !== undefined) payload.reporting_currency = input.reporting_currency;
      if (input.base_currency_locked_at !== undefined) payload.base_currency_locked_at = input.base_currency_locked_at;
      if (input.realized_fx_account_id !== undefined) payload.realized_fx_account_id = input.realized_fx_account_id;
      if (input.unrealized_fx_account_id !== undefined) payload.unrealized_fx_account_id = input.unrealized_fx_account_id;
      if (input.cta_account_id !== undefined) payload.cta_account_id = input.cta_account_id;
      if (input.fx_rate_source !== undefined) payload.fx_rate_source = input.fx_rate_source;
      if (input.fx_rate_sync_frequency !== undefined) payload.fx_rate_sync_frequency = input.fx_rate_sync_frequency;

      const { error } = await supabase.from('organizations').update(payload).eq('id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multi-currency-settings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Multi-currency settings updated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const enableAndLock = useMutation({
    mutationFn: async (baseCurrency: string) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('organizations')
        .update({
          multi_currency_enabled: true,
          currency: baseCurrency,
          base_currency_locked_at: new Date().toISOString(),
          reporting_currency: baseCurrency,
        })
        .eq('id', orgId);
      if (error) throw error;
      await syncBaseCurrencyRow(baseCurrency);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multi-currency-settings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['currencies'] });
      queryClient.invalidateQueries({ queryKey: ['multi-currency-foreign-lines'] });
      toast.success('Multi-currency enabled and base currency locked');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    /** Lines in a non-base currency; null while unknown. */
    foreignLineCount: foreignActivityQuery.data ?? null,
    /** The base currency can be set or corrected until foreign-currency transactions exist. */
    canChangeBase: !settingsQuery.data?.base_currency_locked_at || foreignActivityQuery.data === 0,
    updateSettings,
    enableAndLock,
  };
}

export function useFxRateSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fx-rate-sync', { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: { inserted?: number } | null) => {
      queryClient.invalidateQueries({ queryKey: ['exchange_rates'] });
      toast.success(`Synced ${data?.inserted ?? 0} exchange rates`);
    },
    onError: (e: Error) => toast.error(`FX sync failed: ${e.message}`),
  });
}

export function useFxRateBackfill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { startDate?: string; endDate?: string }) => {
      let startDate = input?.startDate || '2024-01-01';
      const endDate = input?.endDate;
      let totalInserted = 0;
      let totalDays = 0;
      let lastEnd = startDate;
      // Chain calls until backfill completes (server caps each call to ~120 days)
      for (let i = 0; i < 30; i++) {
        const { data, error } = await supabase.functions.invoke('fx-rate-sync', {
          body: { mode: 'backfill', startDate, endDate },
        });
        if (error) throw error;
        totalInserted += data?.inserted ?? 0;
        totalDays += data?.days ?? 0;
        lastEnd = data?.endDate || lastEnd;
        toast.message(`Backfilled ${totalDays} days through ${lastEnd}…`);
        if (!data?.nextStartDate) break;
        startDate = data.nextStartDate;
      }
      return { inserted: totalInserted, days: totalDays, endDate: lastEnd };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['exchange_rates'] });
      toast.success(`Backfill complete: ${data.inserted} rates across ${data.days} days`);
    },
    onError: (e: Error) => toast.error(`Backfill failed: ${e.message}`),
  });
}
