import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';

export interface VendorTaxSlip {
  id: string;
  organization_id: string;
  vendor_id: string;
  tax_year: number;
  slip_type: string;
  slip_number: string | null;
  status: string;
  total_amount: number;
  box_totals: Record<string, number>;
  currency: string;
  pdf_url: string | null;
  xml_url: string | null;
  issued_at: string | null;
  notes: string | null;
}

export function useVendorSlips(taxYear?: number) {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['vendor_tax_slips', currentOrganization?.id, taxYear],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      let q = supabase
        .from('vendor_tax_slips' as any)
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .order('tax_year', { ascending: false });
      if (taxYear) q = q.eq('tax_year', taxYear);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as VendorTaxSlip[];
    },
  });

  const generate = useMutation({
    mutationFn: async (input: { tax_year: number; slip_type?: string; vendor_ids?: string[] }) => {
      const { data, error } = await supabase.functions.invoke('vendor-slip-generate', {
        body: { organization_id: currentOrganization!.id, ...input },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['vendor_tax_slips'] });
      toast.success(`Generated ${r?.count ?? 0} slips`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const efile = useMutation({
    mutationFn: async (input: { tax_year: number; slip_type: string }) => {
      const { data, error } = await supabase.functions.invoke('vendor-slip-efile', {
        body: { organization_id: currentOrganization!.id, ...input },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor_tax_slips'] });
      toast.success('Slips e-filed');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { slips: query.data ?? [], isLoading: query.isLoading, generate, efile };
}
