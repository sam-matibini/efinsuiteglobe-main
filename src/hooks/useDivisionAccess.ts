import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface DivisionAccessRow {
  id: string;
  user_id: string;
  department_id: string;
  organization_id: string;
  granted_at?: string;
  granted_by?: string | null;
}

/** Manages `user_division_access` for the current organization. */
export function useDivisionAccess() {
  const { organization } = useCurrentOrganization();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['division-access', organization?.id],
    queryFn: async (): Promise<DivisionAccessRow[]> => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('user_division_access')
        .select('*')
        .eq('organization_id', organization.id);
      if (error) throw error;
      return (data ?? []) as DivisionAccessRow[];
    },
    enabled: !!organization?.id,
  });

  const grant = useMutation({
    mutationFn: async (vars: { user_id: string; department_id: string }) => {
      const { error } = await supabase.from('user_division_access').insert({
        user_id: vars.user_id,
        department_id: vars.department_id,
        organization_id: organization!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['division-access'] });
      toast.success('Access granted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_division_access').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['division-access'] });
      toast.success('Access revoked');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, grant, revoke };
}
