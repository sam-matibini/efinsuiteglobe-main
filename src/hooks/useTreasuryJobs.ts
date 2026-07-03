import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useTreasuryJobs(organizationId?: string | null) {
  return useQuery({
    queryKey: ['treasury-job-runs', organizationId],
    queryFn: async () => {
      let q = supabase.from('treasury_job_runs').select('*').order('started_at', { ascending: false }).limit(100);
      if (organizationId) q = q.eq('organization_id', organizationId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: organizationId !== undefined,
  });
}
