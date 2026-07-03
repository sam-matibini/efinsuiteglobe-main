import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export function useRpaaSettings() {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['rpaa-settings', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('rpaa_settings').select('*').eq('organization_id', orgId!).maybeSingle();
      if (error) throw error;
      return data as any | null;
    },
  });

  const upsert = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await (supabase as any).from('rpaa_settings')
        .upsert({ ...patch, organization_id: orgId }, { onConflict: 'organization_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rpaa-settings', orgId] });
      toast.success('RPAA settings saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { settings: query.data, isLoading: query.isLoading, upsert };
}

export function useRpaaSnapshots() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  return useQuery({
    queryKey: ['rpaa-snapshots', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('rpaa_safeguarding_snapshots').select('*')
        .eq('organization_id', orgId!)
        .order('snapshot_date', { ascending: false })
        .limit(90);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useRpaaIncidents() {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['rpaa-incidents', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('rpaa_incidents').select('*')
        .eq('organization_id', orgId!)
        .order('occurred_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: async (incident: Record<string, unknown>) => {
      const { error } = await (supabase as any).from('rpaa_incidents')
        .insert({ ...incident, organization_id: orgId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rpaa-incidents', orgId] });
      toast.success('Incident logged');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markNotified = useMutation({
    mutationFn: async ({ id, boc_reference }: { id: string; boc_reference: string }) => {
      const { error } = await (supabase as any).from('rpaa_incidents').update({
        boc_notified_at: new Date().toISOString(),
        boc_reference,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rpaa-incidents', orgId] });
      toast.success('Marked as notified');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { incidents: query.data ?? [], isLoading: query.isLoading, create, markNotified };
}
