import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export interface AuditorSession {
  id: string;
  delegation_id: string;
  organization_id: string;
  auditor_user_id: string | null;
  scopes_used: string[];
  actions_count: number;
  started_at: string;
  ended_at: string | null;
}

export function useAuditorPortal() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;

  const sessions = useQuery({
    queryKey: ['auditor-portal-sessions', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('auditor_portal_sessions')
        .select('*')
        .eq('organization_id', orgId!)
        .order('started_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AuditorSession[];
    },
  });

  const requestAccess = useMutation({
    mutationFn: async (input: { scope: 'evidence' | 'filings' | 'anomalies' | 'all'; resource_id?: string }) => {
      const { data, error } = await supabase.functions.invoke('auditor-portal-access', {
        body: { organization_id: orgId, ...input },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { signed_url?: string };
    },
    onError: (e: Error) => toast.error(`Access denied: ${e.message}`),
  });

  return {
    sessions: sessions.data ?? [],
    isLoading: sessions.isLoading,
    requestAccess,
  };
}
