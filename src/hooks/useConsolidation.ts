import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface ConsolidationGroup {
  id: string;
  name: string;
  description: string | null;
  consolidation_type: 'domestic' | 'international';
  base_currency: string;
  parent_organization_id: string | null;
  fiscal_year_end_month: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsolidationGroupMember {
  id: string;
  group_id: string;
  organization_id: string;
  ownership_percentage: number;
  consolidation_method: 'full' | 'proportional' | 'equity';
  functional_currency: string;
  is_parent: boolean;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
  organization?: {
    id: string;
    name: string;
    country: string | null;
    currency: string | null;
  };
}

export interface ConsolidationReport {
  id: string;
  group_id: string;
  report_type: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'changes_in_equity';
  period_start: string;
  period_end: string;
  base_currency: string;
  status: 'draft' | 'final' | 'archived';
  report_data: Record<string, unknown> | null;
  elimination_entries: Record<string, unknown>[] | null;
  currency_translations: Record<string, unknown> | null;
  notes: string | null;
  generated_by: string | null;
  generated_at: string;
  finalized_at: string | null;
  created_at: string;
}

export interface ConsolidationExchangeRate {
  id: string;
  group_id: string;
  from_currency: string;
  to_currency: string;
  rate_date: string;
  spot_rate: number;
  average_rate: number | null;
  closing_rate: number | null;
  source: string | null;
  created_at: string;
}

export function useConsolidationGroups() {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['consolidation-groups', organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consolidation_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ConsolidationGroup[];
    },
    enabled: !!organization?.id,
  });
}

export function useConsolidationGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: ['consolidation-group-members', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      
      const { data, error } = await supabase
        .from('consolidation_group_members')
        .select(`
          *,
          organization:organizations(id, name, country, currency)
        `)
        .eq('group_id', groupId)
        .order('is_parent', { ascending: false });

      if (error) throw error;
      return data as ConsolidationGroupMember[];
    },
    enabled: !!groupId,
  });
}

export function useConsolidationReports(groupId: string | null) {
  return useQuery({
    queryKey: ['consolidation-reports', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      
      const { data, error } = await supabase
        .from('consolidation_reports')
        .select('*')
        .eq('group_id', groupId)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      return data as ConsolidationReport[];
    },
    enabled: !!groupId,
  });
}

export function useCreateConsolidationGroup() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      consolidation_type: 'domestic' | 'international';
      base_currency: string;
      fiscal_year_end_month?: number;
    }) => {
      const { data: result, error } = await supabase
        .from('consolidation_groups')
        .insert({
          ...data,
          parent_organization_id: organization?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consolidation-groups'] });
      toast.success('Consolidation group created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create group: ${error.message}`);
    },
  });
}

export function useAddGroupMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      group_id: string;
      organization_id: string;
      ownership_percentage: number;
      consolidation_method: 'full' | 'proportional' | 'equity';
      functional_currency: string;
      is_parent?: boolean;
    }) => {
      const { data: result, error } = await supabase
        .from('consolidation_group_members')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consolidation-group-members', variables.group_id] });
      toast.success('Organization added to group');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add member: ${error.message}`);
    },
  });
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, groupId }: { id: string; groupId: string }) => {
      const { error } = await supabase
        .from('consolidation_group_members')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return groupId;
    },
    onSuccess: (groupId) => {
      queryClient.invalidateQueries({ queryKey: ['consolidation-group-members', groupId] });
      toast.success('Organization removed from group');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove member: ${error.message}`);
    },
  });
}

export function useGenerateConsolidatedReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      group_id: string;
      report_type: 'balance_sheet' | 'income_statement' | 'cash_flow' | 'changes_in_equity';
      period_start: string;
      period_end: string;
      base_currency: string;
      report_data?: Record<string, unknown>;
      elimination_entries?: Record<string, unknown>[];
      currency_translations?: Record<string, unknown>;
    }) => {
      const insertData = {
        group_id: data.group_id,
        report_type: data.report_type,
        period_start: data.period_start,
        period_end: data.period_end,
        base_currency: data.base_currency,
        report_data: data.report_data || null,
        elimination_entries: data.elimination_entries || null,
        currency_translations: data.currency_translations || null,
        status: 'draft' as const,
      };
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error } = await supabase
        .from('consolidation_reports')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consolidation-reports', variables.group_id] });
      toast.success('Consolidated report generated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate report: ${error.message}`);
    },
  });
}

export function useConsolidationExchangeRates(groupId: string | null) {
  return useQuery({
    queryKey: ['consolidation-exchange-rates', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      
      const { data, error } = await supabase
        .from('consolidation_exchange_rates')
        .select('*')
        .eq('group_id', groupId)
        .order('rate_date', { ascending: false });

      if (error) throw error;
      return data as ConsolidationExchangeRate[];
    },
    enabled: !!groupId,
  });
}

export function useAddExchangeRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      group_id: string;
      from_currency: string;
      to_currency: string;
      rate_date: string;
      spot_rate: number;
      average_rate?: number;
      closing_rate?: number;
      source?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('consolidation_exchange_rates')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['consolidation-exchange-rates', variables.group_id] });
      toast.success('Exchange rate added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add exchange rate: ${error.message}`);
    },
  });
}
