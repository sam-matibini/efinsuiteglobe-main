import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ProvincialPayeeAccount {
  id: string;
  organization_id: string;
  authority_id: string;
  program_code: string;
  account_number: string;
  account_label: string | null;
  period_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProvincialPayeeInput {
  authority_id: string;
  program_code: string;
  account_number: string;
  account_label?: string;
  period_type?: string;
}

export function useProvincialPayeeAccounts() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['provincial-payees', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('provincial_payee_accounts')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProvincialPayeeAccount[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreateProvincialPayeeInput) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await (supabase as any)
        .from('provincial_payee_accounts')
        .insert({
          organization_id: orgId,
          created_by: user?.id ?? null,
          period_type: input.period_type ?? 'monthly',
          ...input,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provincial-payees'] });
      toast.success('Payee account saved');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('provincial_payee_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provincial-payees'] });
      toast.success('Removed');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { payees: query.data ?? [], isLoading: query.isLoading, create, remove };
}
