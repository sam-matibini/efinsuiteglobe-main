import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { RuleCondition, RuleAction } from '@/types/bankingRules';
import type { Json } from '@/integrations/supabase/types';

export interface TransactionRule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  conditions: RuleCondition[];
  logic_operator: 'and' | 'or';
  actions: RuleAction[];
  priority: number;
  matches_count: number;
  last_matched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRuleInput {
  name: string;
  description?: string;
  is_active?: boolean;
  conditions: RuleCondition[];
  logic_operator?: 'and' | 'or';
  actions: RuleAction[];
  priority?: number;
}

export function useTransactionRules() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading, error } = useQuery({
    queryKey: ['transaction-rules', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('transaction_rules')
        .select('*')
        .eq('organization_id', organization.id)
        .order('priority', { ascending: false });
      
      if (error) throw error;
      
      // Parse JSONB fields
      return data.map(rule => ({
        ...rule,
        conditions: (rule.conditions as unknown as RuleCondition[]) || [],
        actions: (rule.actions as unknown as RuleAction[]) || [],
        logic_operator: rule.logic_operator as 'and' | 'or',
      })) as TransactionRule[];
    },
    enabled: !!organization?.id,
  });

  const createRule = useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const insertData: {
        organization_id: string;
        name: string;
        description: string | null;
        is_active: boolean;
        conditions: Json;
        logic_operator: string;
        actions: Json;
        priority: number;
      } = {
        organization_id: organization.id,
        name: input.name,
        description: input.description || null,
        is_active: input.is_active ?? true,
        conditions: JSON.parse(JSON.stringify(input.conditions)),
        logic_operator: input.logic_operator || 'and',
        actions: JSON.parse(JSON.stringify(input.actions)),
        priority: input.priority || 0,
      };
      
      const { data, error } = await supabase
        .from('transaction_rules')
        .insert([insertData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-rules'] });
      toast.success('Rule created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create rule: ' + error.message);
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TransactionRule> & { id: string }) => {
      const updateData: {
        name?: string;
        description?: string | null;
        is_active?: boolean;
        conditions?: Json;
        logic_operator?: string;
        actions?: Json;
        priority?: number;
      } = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.conditions !== undefined) updateData.conditions = JSON.parse(JSON.stringify(updates.conditions));
      if (updates.logic_operator !== undefined) updateData.logic_operator = updates.logic_operator;
      if (updates.actions !== undefined) updateData.actions = JSON.parse(JSON.stringify(updates.actions));
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      
      const { data, error } = await supabase
        .from('transaction_rules')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-rules'] });
      toast.success('Rule updated');
    },
    onError: (error) => {
      toast.error('Failed to update rule: ' + error.message);
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transaction_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-rules'] });
      toast.success('Rule deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete rule: ' + error.message);
    },
  });

  const toggleRuleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('transaction_rules')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transaction-rules'] });
      toast.success(variables.is_active ? 'Rule activated' : 'Rule deactivated');
    },
    onError: (error) => {
      toast.error('Failed to update rule: ' + error.message);
    },
  });

  const refreshRule = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('transaction_rules')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-rules'] });
      toast.success('Rule refreshed');
    },
    onError: (error) => {
      toast.error('Failed to refresh rule: ' + error.message);
    },
  });

  const activeRules = rules.filter(r => r.is_active);

  return {
    rules,
    activeRules,
    isLoading,
    error,
    createRule,
    updateRule,
    deleteRule,
    toggleRuleActive,
    refreshRule,
  };
}
