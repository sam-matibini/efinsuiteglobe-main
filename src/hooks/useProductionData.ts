import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';
import type { 
  ProductionBom, 
  ProductionBomItem, 
  ProductionRouting, 
  ProductionRoutingStep,
  ProductionCapacity 
} from '@/types/budget';

export function useProductionBoms() {
  const { currentOrganization } = useOrganizationContext();
  const queryClient = useQueryClient();

  const bomsQuery = useQuery({
    queryKey: ['production-boms', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('production_boms')
        .select(`
          *,
          production_bom_items (*)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map((bom: any) => ({
        ...bom,
        items: bom.production_bom_items,
      })) as ProductionBom[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createBom = useMutation({
    mutationFn: async (bom: Partial<ProductionBom>) => {
      const insertData = {
        ...bom,
        organization_id: currentOrganization?.id,
      } as any;
      
      const { data, error } = await supabase
        .from('production_boms')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-boms'] });
      toast.success('Bill of Materials created');
    },
    onError: (error) => {
      toast.error('Failed to create BoM: ' + error.message);
    },
  });

  const addBomItem = useMutation({
    mutationFn: async (item: Partial<ProductionBomItem>) => {
      const { data, error } = await supabase
        .from('production_bom_items')
        .insert(item as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-boms'] });
      toast.success('BoM item added');
    },
    onError: (error) => {
      toast.error('Failed to add BoM item: ' + error.message);
    },
  });

  return {
    boms: bomsQuery.data || [],
    isLoading: bomsQuery.isLoading,
    createBom,
    addBomItem,
    refetch: bomsQuery.refetch,
  };
}

export function useProductionRoutings() {
  const { currentOrganization } = useOrganizationContext();
  const queryClient = useQueryClient();

  const routingsQuery = useQuery({
    queryKey: ['production-routings', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('production_routings')
        .select(`
          *,
          production_routing_steps (*)
        `)
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map((routing: any) => ({
        ...routing,
        steps: routing.production_routing_steps?.sort((a: any, b: any) => a.step_number - b.step_number),
      })) as ProductionRouting[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createRouting = useMutation({
    mutationFn: async (routing: Partial<ProductionRouting>) => {
      const insertData = {
        ...routing,
        organization_id: currentOrganization?.id,
      } as any;
      
      const { data, error } = await supabase
        .from('production_routings')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-routings'] });
      toast.success('Routing created');
    },
    onError: (error) => {
      toast.error('Failed to create routing: ' + error.message);
    },
  });

  const addRoutingStep = useMutation({
    mutationFn: async (step: Partial<ProductionRoutingStep>) => {
      const { data, error } = await supabase
        .from('production_routing_steps')
        .insert(step as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-routings'] });
      toast.success('Routing step added');
    },
    onError: (error) => {
      toast.error('Failed to add step: ' + error.message);
    },
  });

  return {
    routings: routingsQuery.data || [],
    isLoading: routingsQuery.isLoading,
    createRouting,
    addRoutingStep,
    refetch: routingsQuery.refetch,
  };
}

export function useProductionCapacity() {
  const { currentOrganization } = useOrganizationContext();
  const queryClient = useQueryClient();

  const capacityQuery = useQuery({
    queryKey: ['production-capacity', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('production_capacity')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('period_start', { ascending: false });

      if (error) throw error;
      return data as ProductionCapacity[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createCapacity = useMutation({
    mutationFn: async (capacity: Partial<ProductionCapacity>) => {
      const insertData = {
        ...capacity,
        organization_id: currentOrganization?.id,
      } as any;
      
      const { data, error } = await supabase
        .from('production_capacity')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-capacity'] });
      toast.success('Capacity record created');
    },
    onError: (error) => {
      toast.error('Failed to create capacity: ' + error.message);
    },
  });

  const updateCapacity = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductionCapacity> & { id: string }) => {
      const { data, error } = await supabase
        .from('production_capacity')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-capacity'] });
      toast.success('Capacity updated');
    },
    onError: (error) => {
      toast.error('Failed to update capacity: ' + error.message);
    },
  });

  return {
    capacities: capacityQuery.data || [],
    isLoading: capacityQuery.isLoading,
    createCapacity,
    updateCapacity,
    refetch: capacityQuery.refetch,
  };
}

export function useBudgetDrivers() {
  const { currentOrganization } = useOrganizationContext();
  const queryClient = useQueryClient();

  const driversQuery = useQuery({
    queryKey: ['budget-drivers', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('budget_drivers')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('is_active', true)
        .order('driver_name', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  const createDriver = useMutation({
    mutationFn: async (driver: any) => {
      const { data, error } = await supabase
        .from('budget_drivers')
        .insert({
          ...driver,
          organization_id: currentOrganization?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-drivers'] });
      toast.success('Driver created');
    },
    onError: (error) => {
      toast.error('Failed to create driver: ' + error.message);
    },
  });

  return {
    drivers: driversQuery.data || [],
    isLoading: driversQuery.isLoading,
    createDriver,
    refetch: driversQuery.refetch,
  };
}

export function useBudgetAssumptions(budgetId?: string) {
  const { currentOrganization } = useOrganizationContext();
  const queryClient = useQueryClient();

  const assumptionsQuery = useQuery({
    queryKey: ['budget-assumptions', currentOrganization?.id, budgetId],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      let query = supabase
        .from('budget_assumptions')
        .select('*')
        .eq('organization_id', currentOrganization.id);

      if (budgetId) {
        query = query.eq('budget_master_id', budgetId);
      }

      const { data, error } = await query.order('assumption_name', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  const createAssumption = useMutation({
    mutationFn: async (assumption: any) => {
      const { data, error } = await supabase
        .from('budget_assumptions')
        .insert({
          ...assumption,
          organization_id: currentOrganization?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-assumptions'] });
      toast.success('Assumption created');
    },
    onError: (error) => {
      toast.error('Failed to create assumption: ' + error.message);
    },
  });

  return {
    assumptions: assumptionsQuery.data || [],
    isLoading: assumptionsQuery.isLoading,
    createAssumption,
    refetch: assumptionsQuery.refetch,
  };
}
