import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useDepartments, type Department } from '@/hooks/useDimensions';

/**
 * Returns the divisions the current user is allowed to see.
 *
 * Rule (mirrors DB `user_can_access_division`):
 *   - Global admins → all divisions
 *   - Users with zero grants → all divisions (consolidated default)
 *   - Users with one or more grants → only those granted divisions
 */
export function useAccessibleDepartments() {
  const { user, isAdmin } = useAuth();
  const { organization } = useCurrentOrganization();
  const all = useDepartments();

  const grants = useQuery({
    queryKey: ['my-division-grants', user?.id, organization?.id],
    enabled: !!user?.id && !!organization?.id,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('user_division_access')
        .select('department_id')
        .eq('user_id', user!.id)
        .eq('organization_id', organization!.id);
      if (error) throw error;
      return (data ?? []).map((r: { department_id: string }) => r.department_id);
    },
  });

  const data = useMemo<Department[]>(() => {
    const list = (all.data ?? []) as Department[];
    if (isAdmin) return list;
    const ids = grants.data ?? [];
    if (ids.length === 0) return list;
    const set = new Set(ids);
    return list.filter((d) => set.has(d.id));
  }, [all.data, grants.data, isAdmin]);

  return {
    data,
    isLoading: all.isLoading || grants.isLoading,
    isRestricted: !isAdmin && (grants.data?.length ?? 0) > 0,
  };
}
