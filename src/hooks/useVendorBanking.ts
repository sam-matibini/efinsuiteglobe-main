import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export interface VendorBankingProfile {
  id: string;
  organization_id: string;
  vendor_id: string;
  transit_number: string | null;
  institution_number: string | null;
  account_number: string | null;
  payment_method: 'eft' | 'wire' | 'cheque';
  currency: string;
  remittance_email: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useVendorBanking(vendorId?: string) {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['vendor-banking', orgId, vendorId ?? 'all'],
    enabled: !!orgId,
    queryFn: async () => {
      let q = (supabase as any).from('vendor_banking_profiles')
        .select('*').eq('organization_id', orgId!);
      if (vendorId) q = q.eq('vendor_id', vendorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as VendorBankingProfile[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<VendorBankingProfile> & { vendor_id: string }) => {
      if (!orgId) throw new Error('No organization');
      if (input.transit_number && !/^[0-9]{5}$/.test(input.transit_number)) throw new Error('Transit must be 5 digits');
      if (input.institution_number && !/^[0-9]{3}$/.test(input.institution_number)) throw new Error('Institution must be 3 digits');
      const { error } = await (supabase as any)
        .from('vendor_banking_profiles')
        .upsert({ ...input, organization_id: orgId }, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-banking'] });
      toast.success('Vendor banking saved');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { profiles: query.data ?? [], isLoading: query.isLoading, upsert };
}
