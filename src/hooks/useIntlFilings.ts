import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useIntlFilings(orgId?: string) {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['intl_filings', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intl_filing_submissions' as any)
        .select('*').eq('organization_id', orgId!)
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const submitMtdVat = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('hmrc-mtd-vat-submit', { body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(d?.live ? 'HMRC submission sent' : 'HMRC simulated (no secrets)');
      qc.invalidateQueries({ queryKey: ['intl_filings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitOssVat = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('eu-oss-vat-submit', { body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(d?.live ? 'OSS submission sent' : 'OSS simulated (no secrets)');
      qc.invalidateQueries({ queryKey: ['intl_filings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { filings: (list.data ?? []) as any[], isLoading: list.isLoading, submitMtdVat, submitOssVat };
}
