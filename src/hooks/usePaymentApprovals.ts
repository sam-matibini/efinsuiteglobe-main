import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export type EntityType = 'tax_payment' | 'ap_batch' | 'payroll_batch';
export type ApprovalStep = 'review' | 'approve';

export interface PaymentApproval {
  id: string;
  organization_id: string;
  entity_type: EntityType;
  entity_id: string;
  step: ApprovalStep;
  decided_by: string | null;
  decision: 'pending' | 'approved' | 'rejected';
  comment: string | null;
  created_at: string;
  decided_at: string | null;
}

export function usePaymentApprovals(entityType?: EntityType, entityId?: string) {
  const { currentOrganization } = useOrganizationContext();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const list = useQuery({
    queryKey: ['payment-approvals', orgId, entityType, entityId],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase.from('payment_approvals' as never).select('*')
        .eq('organization_id', orgId!).order('created_at', { ascending: false });
      if (entityType) q = q.eq('entity_type', entityType);
      if (entityId) q = q.eq('entity_id', entityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PaymentApproval[];
    },
  });

  const decide = useMutation({
    mutationFn: async (input: {
      entity_type: EntityType;
      entity_id: string;
      step: ApprovalStep;
      decision: 'approved' | 'rejected';
      comment?: string;
    }) => {
      const { data, error } = await supabase.rpc('record_payment_decision' as never, {
        p_entity_type: input.entity_type,
        p_entity_id: input.entity_id,
        p_step: input.step,
        p_decision: input.decision,
        p_comment: input.comment ?? null,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['payment-approvals'] });
      if (vars.entity_type === 'tax_payment') queryClient.invalidateQueries({ queryKey: ['tax-payments'] });
      if (vars.entity_type === 'ap_batch') queryClient.invalidateQueries({ queryKey: ['ap-payment-batches'] });
      if (vars.entity_type === 'payroll_batch') queryClient.invalidateQueries({ queryKey: ['payroll-payment-batches'] });
      toast.success(`${vars.step === 'review' ? 'Review' : 'Approval'} ${vars.decision}`);
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const submitForReview = useMutation({
    mutationFn: async (input: { entity_type: EntityType; entity_id: string }) => {
      const table =
        input.entity_type === 'tax_payment' ? 'tax_payments'
        : input.entity_type === 'ap_batch' ? 'ap_payment_batches'
        : 'payroll_payment_batches';
      const { error } = await supabase.from(table as never)
        .update({ approval_state: 'pending_review' } as never)
        .eq('id', input.entity_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Submitted for review');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { approvals: list.data ?? [], isLoading: list.isLoading, decide, submitForReview };
}

export function usePendingApprovalsForUser() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  return useQuery({
    queryKey: ['pending-approvals', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [tax, ap, payroll] = await Promise.all([
        supabase.from('tax_payments').select('id, reference, amount, currency, approval_state, originator_id, created_at')
          .eq('organization_id', orgId!).in('approval_state', ['pending_review', 'pending_approval']),
        supabase.from('ap_payment_batches').select('id, batch_number, total_amount, currency, approval_state, originator_id, created_at')
          .eq('organization_id', orgId!).in('approval_state', ['pending_review', 'pending_approval']),
        supabase.from('payroll_payment_batches' as never).select('id, batch_number, total_net, currency, approval_state, originator_id, created_at')
          .eq('organization_id', orgId!).in('approval_state', ['pending_review', 'pending_approval']),
      ]);
      return {
        tax_payments: tax.data ?? [],
        ap_batches: ap.data ?? [],
        payroll_batches: payroll.data ?? [],
      };
    },
  });
}
