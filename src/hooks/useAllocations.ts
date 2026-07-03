import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export type AllocationMethod = 'revenue_pct' | 'headcount' | 'fixed_pct' | 'equal' | 'user_count' | 'manual';

export interface AllocationRule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  source_account_id: string | null;
  source_department_id: string | null;
  method: AllocationMethod;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'on_demand';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AllocationRuleTarget {
  id: string;
  rule_id: string;
  target_department_id: string;
  weight: number;
  driver_metric: string | null;
}

export interface AllocationRun {
  id: string;
  organization_id: string;
  rule_id: string | null;
  period_start: string;
  period_end: string;
  status: 'draft' | 'preview' | 'posted' | 'reversed' | 'failed';
  total_allocated: number;
  journal_entry_id: string | null;
  reversal_journal_entry_id: string | null;
  error_message: string | null;
  notes: string | null;
  created_at: string;
}

export function useAllocationRules() {
  const { organization } = useCurrentOrganization();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['allocation-rules', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('allocation_rules')
        .select('*, allocation_rule_targets(*)')
        .eq('organization_id', organization.id)
        .order('name');
      if (error) throw error;
      return data as (AllocationRule & { allocation_rule_targets: AllocationRuleTarget[] })[];
    },
    enabled: !!organization?.id,
  });

  const createRule = useMutation({
    mutationFn: async (input: {
      rule: Omit<AllocationRule, 'id' | 'organization_id' | 'created_at' | 'updated_at'>;
      targets: Array<Omit<AllocationRuleTarget, 'id' | 'rule_id'>>;
    }) => {
      const { data: rule, error } = await supabase
        .from('allocation_rules')
        .insert({ ...input.rule, organization_id: organization!.id })
        .select()
        .single();
      if (error) throw error;
      if (input.targets.length) {
        const { error: tErr } = await supabase
          .from('allocation_rule_targets')
          .insert(input.targets.map((t) => ({ ...t, rule_id: rule.id })));
        if (tErr) throw tErr;
      }
      return rule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allocation-rules'] });
      toast.success('Allocation rule created');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('allocation_rules').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allocation-rules'] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('allocation_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allocation-rules'] });
      toast.success('Rule deleted');
    },
  });

  return { ...query, createRule, toggleRule, deleteRule };
}

export function useAllocationRuns() {
  const { organization } = useCurrentOrganization();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['allocation-runs', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('allocation_runs')
        .select('*, allocation_rules(name)')
        .eq('organization_id', organization.id)
        .order('period_end', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as (AllocationRun & { allocation_rules: { name: string } | null })[];
    },
    enabled: !!organization?.id,
  });

  const runRule = useMutation({
    mutationFn: async ({
      rule_id,
      period_start,
      period_end,
      preview,
    }: { rule_id: string; period_start: string; period_end: string; preview?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('run-allocations', {
        body: { rule_id, period_start, period_end, preview: !!preview },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allocation-runs'] });
      toast.success('Allocation run completed');
    },
    onError: (e: Error) => toast.error(`Allocation failed: ${e.message}`),
  });

  return { ...query, runRule };
}
