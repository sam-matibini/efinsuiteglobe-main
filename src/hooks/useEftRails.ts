import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export type EftProvider = 'paysafe' | 'vopay' | 'telpay';

export interface EftRailSettings {
  eft_provider: EftProvider;
  vopay_daily_cap: number | null;
  telpay_daily_cap: number | null;
  stripe_payout_funding_enabled: boolean;
}

const DEFAULT: EftRailSettings = {
  eft_provider: 'paysafe',
  vopay_daily_cap: null,
  telpay_daily_cap: null,
  stripe_payout_funding_enabled: false,
};

export function useEftRails() {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['eft-rails', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('treasury_settings')
        .select('eft_provider, vopay_daily_cap, telpay_daily_cap, stripe_payout_funding_enabled')
        .eq('organization_id', orgId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? DEFAULT) as EftRailSettings;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<EftRailSettings>) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await (supabase as any)
        .from('treasury_settings')
        .update(patch)
        .eq('organization_id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eft-rails'] });
      toast.success('EFT rail settings updated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { settings: query.data ?? DEFAULT, isLoading: query.isLoading, update };
}
