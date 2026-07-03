import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InventoryValuation {
  id: string;
  organization_id: string | null;
  valuation_date: string;
  total_items: number;
  total_quantity: number;
  total_value: number;
  valuation_method: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

export function useInventoryValuations(organizationId?: string) {
  return useQuery({
    queryKey: ['inventory-valuations', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('inventory_valuations')
        .select('*')
        .eq('organization_id', organizationId)
        .order('valuation_date', { ascending: false });

      if (error) throw error;
      return data as InventoryValuation[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateInventoryValuation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (valuation: Omit<InventoryValuation, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('inventory_valuations')
        .insert(valuation)
        .select()
        .single();

      if (error) throw error;
      return data as InventoryValuation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-valuations'] });
      toast.success('Valuation recorded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to record valuation: ${error.message}`);
    },
  });
}
