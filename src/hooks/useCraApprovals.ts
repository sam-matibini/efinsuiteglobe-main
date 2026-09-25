import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface CraApproval {
  id: string;
  organization_id: string;
  tax_payment_id: string;
  approver_user_id: string;
  level: number;
  decision: 'approved' | 'rejected';
  comment: string | null;
  decided_at: string;
  created_at: string;
}

export function requiredApprovals(amount: number) {
  if (amount < 5000) return 1;
  return 2;
}

export function useCraApprovals(taxPaymentId?: string) {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['cra-approvals', orgId, taxPaymentId ?? 'all'],
    enabled: !!orgId,
    queryFn: async () => {
      let q = (supabase as any).from('cra_remittance_approvals').select('*')
        .eq('organization_id', orgId!)
        .order('decided_at', { ascending: false });
      if (taxPaymentId) q = q.eq('tax_payment_id', taxPaymentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CraApproval[];
    },
  });

  const record = useMutation({
    mutationFn: async (input: { tax_payment_id: string; decision: 'approved' | 'rejected'; comment?: string; level?: number }) => {
      if (!orgId || !user?.id) throw new Error('Not authenticated');
      const { error } = await (supabase as any).from('cra_remittance_approvals').insert({
        organization_id: orgId,
        tax_payment_id: input.tax_payment_id,
        approver_user_id: user.id,
        decision: input.decision,
        comment: input.comment ?? null,
        level: input.level ?? 1,
      });
      if (error) throw error;
      await (supabase as any).from('cra_audit_log').insert({
        organization_id: orgId,
        tax_payment_id: input.tax_payment_id,
        actor_user_id: user.id,
        action: `approval.${input.decision}`,
        payload: { comment: input.comment ?? null },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-approvals'] });
      qc.invalidateQueries({ queryKey: ['cra-audit-log'] });
      toast.success('Decision recorded');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { approvals: query.data ?? [], isLoading: query.isLoading, record };
}
