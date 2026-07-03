import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface Vendor {
  id: string;
  organization_id: string | null;
  name: string;
  vendor_type: 'organization' | 'individual';
  first_name: string | null;
  last_name: string | null;
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
  is_active: boolean;
  is_contractor: boolean;
  t4a_required: boolean;
  sin_last_four: string | null;
  notes: string | null;
  default_currency: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVendorInput {
  name: string;
  vendor_type?: 'organization' | 'individual';
  first_name?: string;
  last_name?: string;
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
  is_contractor?: boolean;
  t4a_required?: boolean;
  sin_last_four?: string;
  notes?: string;
  default_currency?: string;
}

export function useVendors() {
  const { organization: currentOrganization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const vendorsQuery = useQuery({
    queryKey: ['vendors', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('name');

      if (error) throw error;
      return data as Vendor[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createVendor = useMutation({
    mutationFn: async (input: CreateVendorInput) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');

      const { data, error } = await supabase
        .from('vendors')
        .insert({
          organization_id: currentOrganization.id,
          name: input.name,
          vendor_type: input.vendor_type || 'organization',
          first_name: input.first_name || null,
          last_name: input.last_name || null,
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
          is_contractor: input.is_contractor || false,
          t4a_required: input.t4a_required || false,
          sin_last_four: input.sin_last_four || null,
          notes: input.notes || null,
          default_currency: input.default_currency || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create vendor: ' + error.message);
    },
  });

  const deactivateVendor = useMutation({
    mutationFn: async (vendorId: string) => {
      const { error } = await supabase
        .from('vendors')
        .update({ is_active: false })
        .eq('id', vendorId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor deactivated');
    },
    onError: (error) => {
      toast.error('Failed to deactivate vendor: ' + error.message);
    },
  });

  return {
    vendors: vendorsQuery.data ?? [],
    isLoading: vendorsQuery.isLoading,
    error: vendorsQuery.error,
    createVendor,
    deactivateVendor,
  };
}
