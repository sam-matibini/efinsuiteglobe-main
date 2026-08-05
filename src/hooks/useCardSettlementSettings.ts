import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export type CardSettlementProvider = 'processor' | 'wise';

export interface CardSettlementSettings {
  provider: CardSettlementProvider;
  wiseRecipientId: string | null;
  currency: string | null;
}

const DEFAULTS: CardSettlementSettings = {
  provider: 'processor',
  wiseRecipientId: null,
  currency: null,
};

/**
 * Where invoice card collections settle once captured. Persisted per
 * organization in `organizations.efinconnect_preferences.cardSettlement`.
 */
export function useCardSettlementSettings() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['card-settlement-settings', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ prefs: Record<string, unknown>; settings: CardSettlementSettings }> => {
      const { data, error } = await supabase
        .from('organizations')
        .select('efinconnect_preferences')
        .eq('id', orgId!)
        .maybeSingle();
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prefs = (((data as any)?.efinconnect_preferences ?? {}) as Record<string, unknown>);
      const cs = (prefs.cardSettlement ?? {}) as Partial<CardSettlementSettings>;
      return {
        prefs,
        settings: {
          provider: cs.provider === 'wise' ? 'wise' : 'processor',
          wiseRecipientId: cs.wiseRecipientId ?? null,
          currency: cs.currency ?? null,
        },
      };
    },
  });

  const settings = data?.settings ?? DEFAULTS;

  const save = useMutation({
    mutationFn: async (next: Partial<CardSettlementSettings>) => {
      if (!orgId) throw new Error('No organization selected');
      const merged = { ...settings, ...next };
      const payload = { ...(data?.prefs ?? {}), cardSettlement: merged };
      const { error } = await supabase
        .from('organizations')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ efinconnect_preferences: payload } as any)
        .eq('id', orgId);
      if (error) throw error;
      return merged;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card-settlement-settings', orgId] });
      qc.invalidateQueries({ queryKey: ['efinconnect-preferences', orgId] });
      toast.success('Card settlement settings saved');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not save settlement settings'),
  });

  return {
    settings,
    isLoading,
    isWiseSettlement: settings.provider === 'wise',
    save: (next: Partial<CardSettlementSettings>) => save.mutate(next),
    saving: save.isPending,
  };
}
