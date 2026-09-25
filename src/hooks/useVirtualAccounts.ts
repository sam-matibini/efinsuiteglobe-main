import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export interface VirtualAccount {
  id: string;
  organization_id: string;
  provider: string;
  
  currency: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  bvn_or_nin: string | null;
  provider_account_id: string | null;
  account_number: string | null;
  bank_name: string | null;
  account_name: string | null;
  status: 'pending' | 'active' | 'failed';
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface CreateVirtualAccountInput {
  currency: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  bvn_or_nin?: string | null;
}

export function useVirtualAccounts() {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const list = useQuery({
    queryKey: ['virtual-accounts', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('virtual_accounts')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as VirtualAccount[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreateVirtualAccountInput) => {
      if (!orgId) throw new Error('No organization selected');
      const { data, error } = await supabase.functions.invoke('efincash-proxy', {
        body: { organization_id: orgId, ...input },
      });
      if (error) throw error;
      if ((data as any)?.error) {
        const msg = typeof (data as any).error === 'string'
          ? (data as any).error
          : JSON.stringify((data as any).error);
        throw new Error(msg);
      }
      return data as { success: boolean; virtual_account: VirtualAccount };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['virtual-accounts', orgId] });
      const va = result?.virtual_account;
      if (va?.account_number) {
        toast.success(`Virtual account created: ${va.account_number} (${va.bank_name ?? va.currency})`);
      } else {
        toast.success('Virtual account request submitted. Awaiting provider confirmation.');
      }
    },
    onError: (e: Error) => toast.error(`Failed to create virtual account: ${e.message}`),
  });

  return { accounts: list.data ?? [], isLoading: list.isLoading, create };
}
