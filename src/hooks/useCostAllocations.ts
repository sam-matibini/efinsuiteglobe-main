import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CostAllocation {
  id: string;
  organization_id: string | null;
  product_service_id: string | null;
  cost_type: 'direct_labor' | 'direct_material' | 'overhead' | 'fixed' | 'variable';
  description: string | null;
  amount: number;
  allocation_method: 'percentage' | 'fixed' | 'per_unit' | 'hourly';
  allocation_rate: number | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCostAllocations(organizationId?: string, productServiceId?: string) {
  return useQuery({
    queryKey: ['cost-allocations', organizationId, productServiceId],
    queryFn: async () => {
      if (!organizationId) return [];
      let query = supabase
        .from('cost_allocations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (productServiceId) {
        query = query.eq('product_service_id', productServiceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CostAllocation[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateCostAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (allocation: Omit<CostAllocation, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('cost_allocations')
        .insert(allocation)
        .select()
        .single();

      if (error) throw error;
      return data as CostAllocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-allocations'] });
      toast.success('Cost allocation created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create allocation: ${error.message}`);
    },
  });
}

export function useUpdateCostAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...allocation }: Partial<CostAllocation> & { id: string }) => {
      const { data, error } = await supabase
        .from('cost_allocations')
        .update(allocation)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CostAllocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-allocations'] });
      toast.success('Allocation updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

export function useDeleteCostAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cost_allocations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-allocations'] });
      toast.success('Allocation deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });
}
