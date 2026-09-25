import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';
import type { BudgetMaster, BudgetLineItem, BudgetVersion, BudgetType, BudgetStatus } from '@/types/budget';

export function useBudgets() {
  const { currentOrganization } = useOrganizationContext();
  const queryClient = useQueryClient();

  const budgetsQuery = useQuery({
    queryKey: ['budgets', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('budget_masters')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BudgetMaster[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createBudget = useMutation({
    mutationFn: async (budget: Partial<BudgetMaster>) => {
      const insertData = {
        ...budget,
        organization_id: currentOrganization?.id,
      } as any;
      
      const { data, error } = await supabase
        .from('budget_masters')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create budget: ' + error.message);
    },
  });

  const updateBudget = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BudgetMaster> & { id: string }) => {
      const { data, error } = await supabase
        .from('budget_masters')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update budget: ' + error.message);
    },
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('budget_masters')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete budget: ' + error.message);
    },
  });

  return {
    budgets: budgetsQuery.data || [],
    isLoading: budgetsQuery.isLoading,
    error: budgetsQuery.error,
    createBudget,
    updateBudget,
    deleteBudget,
    refetch: budgetsQuery.refetch,
  };
}

export function useBudgetDetails(budgetId: string | undefined) {
  const queryClient = useQueryClient();

  const budgetQuery = useQuery({
    queryKey: ['budget', budgetId],
    queryFn: async () => {
      if (!budgetId) return null;
      
      const { data, error } = await supabase
        .from('budget_masters')
        .select('*')
        .eq('id', budgetId)
        .single();

      if (error) throw error;
      return data as BudgetMaster;
    },
    enabled: !!budgetId,
  });

  const lineItemsQuery = useQuery({
    queryKey: ['budget-line-items', budgetId],
    queryFn: async () => {
      if (!budgetId) return [];
      
      const { data, error } = await supabase
        .from('budget_line_items')
        .select(`
          *,
          accounts:account_id (name, code)
        `)
        .eq('budget_master_id', budgetId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data.map((item: any) => ({
        ...item,
        account_name: item.accounts?.name,
        account_code: item.accounts?.code,
      })) as BudgetLineItem[];
    },
    enabled: !!budgetId,
  });

  const versionsQuery = useQuery({
    queryKey: ['budget-versions', budgetId],
    queryFn: async () => {
      if (!budgetId) return [];
      
      const { data, error } = await supabase
        .from('budget_versions')
        .select('*')
        .eq('budget_master_id', budgetId)
        .order('version_number', { ascending: true });

      if (error) throw error;
      return data as BudgetVersion[];
    },
    enabled: !!budgetId,
  });

  const createLineItem = useMutation({
    mutationFn: async (lineItem: Partial<BudgetLineItem>) => {
      const insertData = {
        ...lineItem,
        budget_master_id: budgetId,
      } as any;
      
      const { data, error } = await supabase
        .from('budget_line_items')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-line-items', budgetId] });
      toast.success('Line item added');
    },
    onError: (error) => {
      toast.error('Failed to add line item: ' + error.message);
    },
  });

  const updateLineItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BudgetLineItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('budget_line_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-line-items', budgetId] });
    },
    onError: (error) => {
      toast.error('Failed to update line item: ' + error.message);
    },
  });

  const deleteLineItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('budget_line_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-line-items', budgetId] });
      toast.success('Line item deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete line item: ' + error.message);
    },
  });

  const createVersion = useMutation({
    mutationFn: async (version: Partial<BudgetVersion>) => {
      const insertData = {
        ...version,
        budget_master_id: budgetId,
      } as any;
      
      const { data, error } = await supabase
        .from('budget_versions')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-versions', budgetId] });
      toast.success('Scenario version created');
    },
    onError: (error) => {
      toast.error('Failed to create version: ' + error.message);
    },
  });

  return {
    budget: budgetQuery.data,
    lineItems: lineItemsQuery.data || [],
    versions: versionsQuery.data || [],
    isLoading: budgetQuery.isLoading || lineItemsQuery.isLoading,
    createLineItem,
    updateLineItem,
    deleteLineItem,
    createVersion,
    refetch: () => {
      budgetQuery.refetch();
      lineItemsQuery.refetch();
      versionsQuery.refetch();
    },
  };
}

export function useBudgetsByType(budgetType?: BudgetType) {
  const { currentOrganization } = useOrganizationContext();

  return useQuery({
    queryKey: ['budgets', currentOrganization?.id, budgetType],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      let query = supabase
        .from('budget_masters')
        .select('*')
        .eq('organization_id', currentOrganization.id);

      if (budgetType) {
        query = query.eq('budget_type', budgetType);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as BudgetMaster[];
    },
    enabled: !!currentOrganization?.id,
  });
}

export function useProductionBudgets() {
  const { currentOrganization } = useOrganizationContext();

  return useQuery({
    queryKey: ['production-budgets', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const productionTypes = [
        'master_production', 'production_volume', 'direct_materials', 'direct_labor',
        'manufacturing_overhead', 'wip', 'production_cost_unit', 'production_variance', 'production_capacity'
      ];

      const { data, error } = await supabase
        .from('budget_masters')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .in('budget_type', productionTypes)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BudgetMaster[];
    },
    enabled: !!currentOrganization?.id,
  });
}
