import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useAuditorExports(organizationId?: string | null) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['auditor-export-runs', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('auditor_export_runs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!organizationId,
  });

  const generate = useMutation({
    mutationFn: async (input: { organization_id: string; period_start: string; period_end: string }) => {
      const { data, error } = await supabase.functions.invoke('auditor-export-bundle', { body: input });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auditor-export-runs', organizationId] });
      toast.success('Auditor bundle generated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const download = useMutation({
    mutationFn: async (path: string) => {
      const { data, error } = await supabase.storage.from('auditor-bundles').createSignedUrl(path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    },
    onError: (e: Error) => toast.error(`Download failed: ${e.message}`),
  });

  return { ...list, generate, download };
}
