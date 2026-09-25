import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export type PayoutProviderKey =
  | 'wise'
  | 'stripe'
  | 'square'
  | 'efinmoney'
  | 'paysafe'
  | 'plaid'
  | 'wire'
  | 'cheque'
  | 'manual';

export const PAYOUT_PROVIDER_DEFAULTS: Record<PayoutProviderKey, boolean> = {
  wise: true,
  stripe: true,
  square: false,
  efinmoney: false,
  paysafe: false,
  plaid: false,
  wire: false,
  cheque: false,
  manual: false,
};

type Toggles = Partial<Record<PayoutProviderKey, boolean>>;

/**
 * Per-organization on/off switches for payout providers, persisted inside the
 * existing `organizations.efinconnect_preferences` JSON under `payoutProviders`.
 */
export function usePayoutProviderToggles() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['payout-provider-toggles', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ prefs: Record<string, unknown>; toggles: Toggles }> => {
      const { data, error } = await supabase
        .from('organizations')
        .select('efinconnect_preferences')
        .eq('id', orgId!)
        .maybeSingle();
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prefs = (((data as any)?.efinconnect_preferences ?? {}) as Record<string, unknown>);
      return { prefs, toggles: (prefs.payoutProviders ?? {}) as Toggles };
    },
  });

  const toggles = data?.toggles ?? {};
  const isEnabled = (key: PayoutProviderKey) => toggles[key] ?? PAYOUT_PROVIDER_DEFAULTS[key];

  const setEnabled = useMutation({
    mutationFn: async ({ key, value }: { key: PayoutProviderKey; value: boolean }) => {
      if (!orgId) throw new Error('No organization selected');
      const next = {
        ...(data?.prefs ?? {}),
        payoutProviders: { ...toggles, [key]: value },
      };
      const { error } = await supabase
        .from('organizations')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ efinconnect_preferences: next } as any)
        .eq('id', orgId);
      if (error) throw error;
      return next;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payout-provider-toggles', orgId] });
      qc.invalidateQueries({ queryKey: ['efinconnect-preferences', orgId] });
    },
    onError: (e: Error) => toast.error(e.message || 'Could not save provider setting'),
  });

  return {
    isLoading,
    isEnabled,
    toggle: (key: PayoutProviderKey, value: boolean) => setEnabled.mutate({ key, value }),
    saving: setEnabled.isPending,
  };
}
