import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductService {
  id: string;
  organization_id: string | null;
  type: 'product' | 'service';
  name: string;
  sku: string | null;
  description: string | null;
  selling_price: number;
  cost_price: number | null;
  unit_of_measure: string | null;
  is_taxable: boolean | null;
  tax_rate: number | null;
  income_account_id: string | null;
  expense_account_id: string | null;
  inventory_item_id: string | null;
  is_active: boolean | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductServiceInput {
  organization_id: string;
  type: 'product' | 'service';
  name: string;
  sku?: string;
  description?: string;
  selling_price: number;
  cost_price?: number;
  unit_of_measure?: string;
  is_taxable?: boolean;
  tax_rate?: number;
  income_account_id?: string;
  expense_account_id?: string;
  inventory_item_id?: string;
  category?: string;
}

export function useProductsServices(organizationId?: string) {
  return useQuery({
    queryKey: ['products-services', organizationId],
    queryFn: async () => {
      let query = supabase
        .from('products_services')
        .select('*')
        .order('name');

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductService[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateProductService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductServiceInput) => {
      const { data, error } = await supabase
        .from('products_services')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as ProductService;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products-services'] });
      toast.success(`${data.type === 'product' ? 'Product' : 'Service'} created successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });
}

export function useBulkCreateProductsServices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: CreateProductServiceInput[]) => {
      const { data, error } = await supabase
        .from('products_services')
        .insert(items)
        .select();

      if (error) throw error;
      return data as ProductService[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products-services'] });
      toast.success(`${data.length} items imported successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to import: ${error.message}`);
    },
  });
}

export function useUpdateProductService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProductService> & { id: string }) => {
      const { data, error } = await supabase
        .from('products_services')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ProductService;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-services'] });
      toast.success('Updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

export function useDeleteProductService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products_services')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-services'] });
      toast.success('Deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });
}
