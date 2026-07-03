import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';

export interface VendorTaxProfile {
  id: string;
  organization_id: string;
  vendor_id: string;
  country: string;
  legal_name: string | null;
  business_number: string | null;
  sin: string | null;
  tin: string | null;
  ein: string | null;
  w_form_type: string | null;
  td1_on_file: boolean;
  slip_type_override: string | null;
  address_line1: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  tin_match_status: string;
  tin_match_checked_at: string | null;
  tin_match_notes: string | null;
}

export function useVendorTaxProfiles() {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['vendor_tax_profiles', currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_tax_profiles' as any)
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as VendorTaxProfile[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<VendorTaxProfile> & { vendor_id: string }) => {
      const { data, error } = await supabase
        .from('vendor_tax_profiles' as any)
        .upsert(
          { ...input, organization_id: currentOrganization!.id },
          { onConflict: 'organization_id,vendor_id' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor_tax_profiles'] });
      toast.success('Profile saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runTinMatch = useMutation({
    mutationFn: async (profile_ids?: string[]) => {
      const { data, error } = await supabase.functions.invoke('vendor-tin-match', {
        body: { organization_id: currentOrganization!.id, profile_ids },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor_tax_profiles'] });
      toast.success('TIN/SIN match complete');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { profiles: query.data ?? [], isLoading: query.isLoading, upsert, runTinMatch };
}
