import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FirmWorkspace {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
}

export interface FirmClientSummary {
  organization_id: string;
  name: string;
  open_alerts: number;
  critical_alerts: number;
  next_due_date: string | null;
  last_consolidation_at: string | null;
  last_export_at: string | null;
}

export function useFirmWorkspaces() {
  const qc = useQueryClient();
  const workspaces = useQuery({
    queryKey: ['firm_workspaces'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('firm_workspaces' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FirmWorkspace[];
    },
  });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('firm_workspaces' as any)
        .insert({ name, owner_user_id: u.user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as FirmWorkspace;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firm_workspaces'] });
      toast.success('Firm workspace created');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkClient = useMutation({
    mutationFn: async (input: { workspace_id: string; organization_id: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('firm_client_links' as any)
        .insert({ ...input, linked_by: u.user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['firm_portal_summary'] });
      toast.success('Client linked');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { workspaces: workspaces.data ?? [], isLoading: workspaces.isLoading, create, linkClient };
}

export function useFirmPortalSummary(workspaceId?: string) {
  return useQuery({
    queryKey: ['firm_portal_summary', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('firm-portal-summary', {
        body: { workspace_id: workspaceId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { workspace: FirmWorkspace; clients: FirmClientSummary[] };
    },
  });
}
