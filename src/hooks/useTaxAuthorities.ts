/**
 * useTaxAuthorities — CRUD hook for tax_authorities table.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface TaxAuthority {
  id: string;
  organization_id: string;
  name: string;
  country_id: string | null;
  region: string | null;
  filing_frequency: 'monthly' | 'quarterly' | 'annually' | 'semi_annually';
  reporting_currency: string;
  registration_number: string | null;
  next_due_date: string | null;
  efile_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useTaxAuthorities() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  const query = useQuery({
    queryKey: ['tax-authorities', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_authorities')
        .select('*')
        .eq('organization_id', orgId!)
        .order('name');
      if (error) throw error;
      return (data ?? []) as TaxAuthority[];
    },
  });

  const createAuthority = useMutation({
    mutationFn: async (payload: Partial<TaxAuthority>) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await supabase
        .from('tax_authorities')
        .insert({
          organization_id: orgId,
          name: payload.name!,
          country_id: payload.country_id ?? null,
          region: payload.region ?? null,
          filing_frequency: payload.filing_frequency ?? 'quarterly',
          reporting_currency: payload.reporting_currency ?? 'CAD',
          registration_number: payload.registration_number ?? null,
          next_due_date: payload.next_due_date ?? null,
          efile_url: payload.efile_url ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as TaxAuthority;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-authorities', orgId] });
      toast.success('Tax authority created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateAuthority = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TaxAuthority> & { id: string }) => {
      const { data, error } = await supabase
        .from('tax_authorities')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as TaxAuthority;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-authorities', orgId] });
      toast.success('Tax authority updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAuthority = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_authorities').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-authorities', orgId] });
      toast.success('Tax authority removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    authorities: query.data ?? [],
    isLoading: query.isLoading,
    createAuthority,
    updateAuthority,
    deleteAuthority,
  };
}
