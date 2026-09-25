import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface CraApprovalRule {
  id: string;
  organization_id: string;
  name: string;
  min_amount: number;
  max_amount: number | null;
  required_role: string;
  required_approver_count: number;
  program_codes: string[];
  priority: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useApprovalRules() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['cra-approval-rules', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cra_approval_rules')
        .select('*')
        .eq('organization_id', orgId!)
        .order('priority', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CraApprovalRule[];
    },
  });

  const upsertRule = useMutation({
    mutationFn: async (rule: Partial<CraApprovalRule> & { id?: string }) => {
      if (!orgId) throw new Error('No organization selected');
      if (rule.id) {
        const { error } = await supabase
          .from('cra_approval_rules')
          .update({ ...rule, updated_at: new Date().toISOString() })
          .eq('id', rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cra_approval_rules').insert({
          organization_id: orgId,
          name: rule.name ?? 'Approval rule',
          min_amount: rule.min_amount ?? 0,
          max_amount: rule.max_amount ?? null,
          required_role: rule.required_role ?? 'admin',
          required_approver_count: rule.required_approver_count ?? 1,
          program_codes: rule.program_codes ?? [],
          priority: rule.priority ?? 100,
          active: rule.active ?? true,
          created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-approval-rules', orgId] });
      toast.success('Rule saved');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cra_approval_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-approval-rules', orgId] });
      toast.success('Rule deleted');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { rules: query.data ?? [], isLoading: query.isLoading, upsertRule, deleteRule };
}
