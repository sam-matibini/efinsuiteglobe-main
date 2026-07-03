import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';

export interface WalletBalance {
  id: string;
  organization_id: string;
  provider: 'stripe' | 'paddle' | 'plaid';
  balance: number;
  currency: string;
  last_synced_at: string | null;
}

export function useWalletBalances() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  return useQuery({
    queryKey: ['wallet-balances', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallet_balances' as never).select('*')
        .eq('organization_id', orgId!)
        .order('provider');
      if (error) throw error;
      return (data ?? []) as unknown as WalletBalance[];
    },
  });
}
