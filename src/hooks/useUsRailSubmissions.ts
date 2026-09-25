import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';

export interface UsRailSubmission {
  id: string;
  submission_type: string;
  batch_reference: string | null;
  status: string;
  submitted_at: string;
  ack: any;
  file_hash: string | null;
}

export function useUsRailSubmissions() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  return useQuery({
    queryKey: ['us_payment_rail_submissions', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('us_payment_rail_submissions' as any)
        .select('*')
        .eq('organization_id', orgId!)
        .order('submitted_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as UsRailSubmission[];
    },
  });
}
