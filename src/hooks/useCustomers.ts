import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface Customer {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  tax_number: string | null;
  payment_terms: number | null;
  credit_limit: number | null;
  notes: string | null;
  default_currency: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  tax_number?: string;
  payment_terms?: number;
  credit_limit?: number;
  notes?: string;
  default_currency?: string;
}

export function useCustomers() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading, error } = useQuery({
    queryKey: ['customers', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!organization?.id,
  });

  const createCustomer = useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          organization_id: organization.id,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          address_line1: input.address_line1 || null,
          address_line2: input.address_line2 || null,
          city: input.city || null,
          province: input.province || null,
          postal_code: input.postal_code || null,
          country: input.country || 'CA',
          tax_number: input.tax_number || null,
          payment_terms: input.payment_terms || 30,
          credit_limit: input.credit_limit || 0,
          notes: input.notes || null,
          default_currency: input.default_currency || null,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create customer: ' + error.message);
    },
  });

  const updateCustomer = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Customer> & { id: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update customer: ' + error.message);
    },
  });

  const deleteCustomer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer removed');
    },
    onError: (error) => {
      toast.error('Failed to remove customer: ' + error.message);
    },
  });

  return {
    customers,
    isLoading,
    error,
    createCustomer,
    updateCustomer,
    deleteCustomer,
  };
}

export function useBulkCreateCustomers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: Array<{
      organization_id: string;
      name: string;
      email: string | null;
      phone: string | null;
      address_line1: string | null;
      address_line2: string | null;
      city: string | null;
      province: string | null;
      postal_code: string | null;
      country: string | null;
      tax_number: string | null;
      payment_terms: number;
      credit_limit: number;
      notes: string | null;
    }>) => {
      const { data, error } = await supabase
        .from('customers')
        .insert(items)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success(`${data.length} customers imported successfully`);
    },
    onError: (error) => {
      toast.error('Failed to import customers: ' + error.message);
    },
  });
}
