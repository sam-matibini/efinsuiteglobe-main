import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface AccountantDelegation {
  id: string;
  organization_id: string;
  delegated_user_id: string;
  granted_by: string | null;
  scope: { treasury?: boolean; payroll_remit?: boolean; approve?: boolean };
  notes: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  updated_at: string;
}

export function useAccountantDelegations() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['accountant-delegations', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accountant_delegations')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AccountantDelegation[];
    },
  });

  const grantDelegation = useMutation({
    mutationFn: async (input: {
      delegated_user_id: string;
      scope: AccountantDelegation['scope'];
      expires_at?: string | null;
      notes?: string;
    }) => {
      if (!orgId) throw new Error('No organization selected');
      const { error } = await supabase.from('accountant_delegations').insert({
        organization_id: orgId,
        delegated_user_id: input.delegated_user_id,
        scope: input.scope,
        expires_at: input.expires_at ?? null,
        notes: input.notes ?? null,
        granted_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-delegations', orgId] });
      toast.success('Delegation granted');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const revoke = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await supabase
        .from('accountant_delegations')
        .update({ revoked_at: new Date().toISOString(), revoked_reason: reason ?? null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accountant-delegations', orgId] });
      toast.success('Delegation revoked');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const active = (query.data ?? []).filter(
    (d) => !d.revoked_at && (!d.expires_at || new Date(d.expires_at) > new Date()),
  );

  return { delegations: query.data ?? [], active, isLoading: query.isLoading, grantDelegation, revoke };
}
