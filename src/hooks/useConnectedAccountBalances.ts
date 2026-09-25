import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ConnectedAccountBalance {
  id: string;
  organization_id: string;
  connected_account_id: string;
  currency: string;
  available_amount: number;
  pending_amount: number;
  reserved_amount: number;
  as_of: string;
}

export function useConnectedAccountBalances(organizationId?: string | null, connectedAccountId?: string | null) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['stripe-connected-account-balances', organizationId, connectedAccountId ?? 'all'],
    enabled: !!organizationId,
    queryFn: async (): Promise<ConnectedAccountBalance[]> => {
      let q = supabase
        .from('stripe_connected_account_balances' as any)
        .select('*')
        .eq('organization_id', organizationId!)
        .order('as_of', { ascending: false });
      if (connectedAccountId) q = q.eq('connected_account_id', connectedAccountId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const refresh = useMutation({
    mutationFn: async (input: { connected_account_id?: string; organization_id?: string }) => {
      const { data, error } = await supabase.functions.invoke('stripe-connect-balance-refresh', {
        body: {
          connected_account_id: input.connected_account_id ?? 'all',
          organization_id: input.organization_id ?? organizationId,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stripe-connected-account-balances'] });
      toast.success('Balances refreshed');
    },
    onError: (e: Error) => toast.error(`Balance refresh failed: ${e.message}`),
  });

  return { balances: list.data ?? [], isLoading: list.isLoading, refresh };
}
