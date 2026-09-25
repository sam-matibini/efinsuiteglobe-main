import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';

export interface CraAuditEntry {
  id: string;
  organization_id: string;
  tax_payment_id: string | null;
  actor_user_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export function useCraAuditLog(opts?: { taxPaymentId?: string; limit?: number }) {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  return useQuery({
    queryKey: ['cra-audit-log', orgId, opts?.taxPaymentId ?? 'all', opts?.limit ?? 200],
    enabled: !!orgId,
    queryFn: async () => {
      let q = (supabase as any).from('cra_audit_log').select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(opts?.limit ?? 200);
      if (opts?.taxPaymentId) q = q.eq('tax_payment_id', opts.taxPaymentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CraAuditEntry[];
    },
  });
}

export function useWriteCraAudit() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  return useMutation({
    mutationFn: async (input: { tax_payment_id?: string; action: string; payload?: Record<string, unknown> }) => {
      if (!orgId) return;
      await (supabase as any).from('cra_audit_log').insert({
        organization_id: orgId,
        tax_payment_id: input.tax_payment_id ?? null,
        actor_user_id: user?.id ?? null,
        action: input.action,
        payload: input.payload ?? {},
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cra-audit-log'] }),
  });
}
