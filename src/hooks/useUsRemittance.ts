import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';

export interface SalesTaxJurisdiction {
  id: string;
  organization_id: string;
  country: string;
  state_code: string;
  county: string | null;
  city: string | null;
  economic_nexus_revenue: number;
  economic_nexus_transactions: number;
  ytd_revenue: number;
  ytd_transactions: number;
  nexus_status: string;
  registered: boolean;
  registration_number: string | null;
  last_checked_at: string | null;
}

export interface IrsFiling {
  id: string;
  organization_id: string;
  filing_type: string;
  tax_year: number;
  period: string | null;
  status: string;
  xml_url: string | null;
  pdf_url: string | null;
  submitted_at: string | null;
  payload: any;
}

export function useUsRemittance() {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();

  const jurisdictions = useQuery({
    queryKey: ['sales_tax_jurisdictions', currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_tax_jurisdictions' as any)
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .order('state_code');
      if (error) throw error;
      return (data ?? []) as unknown as SalesTaxJurisdiction[];
    },
  });

  const filings = useQuery({
    queryKey: ['irs_filings', currentOrganization?.id],
    enabled: !!currentOrganization?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('irs_filings' as any)
        .select('*')
        .eq('organization_id', currentOrganization!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as IrsFiling[];
    },
  });

  const upsertJurisdiction = useMutation({
    mutationFn: async (input: Partial<SalesTaxJurisdiction> & { state_code: string }) => {
      const { error } = await supabase
        .from('sales_tax_jurisdictions' as any)
        .upsert(
          { ...input, organization_id: currentOrganization!.id, country: input.country ?? 'US' },
          { onConflict: 'organization_id,country,state_code,county,city' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales_tax_jurisdictions'] });
      toast.success('Jurisdiction saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runNexusCheck = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sales-tax-nexus-check', {
        body: { organization_id: currentOrganization!.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['sales_tax_jurisdictions'] });
      toast.success(`Nexus scan: ${r?.alerts?.length ?? 0} alerts`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const generate941 = useMutation({
    mutationFn: async (input: { tax_year: number; quarter: number }) => {
      const { data, error } = await supabase.functions.invoke('irs-941-generate', {
        body: { organization_id: currentOrganization!.id, ...input },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['irs_filings'] });
      toast.success('941 filing generated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    jurisdictions: jurisdictions.data ?? [],
    filings: filings.data ?? [],
    isLoading: jurisdictions.isLoading || filings.isLoading,
    upsertJurisdiction,
    runNexusCheck,
    generate941,
  };
}
