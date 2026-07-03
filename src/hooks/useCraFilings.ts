import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type CraFilingType = 't4_summary' | 't4_slips' | 't5018' | 'pd7a' | 'gst_hst_netfile';
export type CraFilingStatus = 'draft' | 'generated' | 'submitted' | 'accepted' | 'rejected';

export interface CraFiling {
  id: string;
  organization_id: string;
  filing_type: CraFilingType;
  period_start: string;
  period_end: string;
  xml_storage_path: string | null;
  human_summary: Record<string, unknown>;
  status: CraFilingStatus;
  confirmation_number: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCraFilings() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['cra-filings', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('cra_filings')
        .select('*')
        .eq('organization_id', orgId!)
        .order('period_end', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CraFiling[];
    },
  });

  const generate = useMutation({
    mutationFn: async (input: { filing_type: CraFilingType; period_start: string; period_end: string }) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await supabase.functions.invoke('cra-xml-generate', {
        body: { organization_id: orgId, ...input },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-filings'] });
      toast.success('Filing generated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const markSubmitted = useMutation({
    mutationFn: async (input: { id: string; confirmation_number: string }) => {
      const { error } = await (supabase as any).from('cra_filings')
        .update({
          status: 'submitted',
          confirmation_number: input.confirmation_number,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-filings'] });
      toast.success('Filing marked submitted');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const downloadXml = async (filing: CraFiling) => {
    if (!filing.xml_storage_path) {
      toast.error('No XML available');
      return;
    }
    const { data, error } = await supabase.storage
      .from('cra-filings')
      .createSignedUrl(filing.xml_storage_path, 300);
    if (error) {
      toast.error(error.message);
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  return { filings: query.data ?? [], isLoading: query.isLoading, generate, markSubmitted, downloadXml };
}
