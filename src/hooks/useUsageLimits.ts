import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { useSubscription } from './useSubscription';

export function useUsageLimits() {
  const { currentOrganization } = useOrganizationContext();
  const { isAdmin } = useAuth();
  const { plan, isLoading: subLoading } = useSubscription();
  const orgId = currentOrganization?.id;

  const { data: userCount = 0, isLoading: uLoading } = useQuery({
    queryKey: ['usage-limits-users', orgId],
    queryFn: async () => {
      if (!orgId) return 0;
      const { count, error } = await supabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const { data: employeeCount = 0, isLoading: eLoading } = useQuery({
    queryKey: ['usage-limits-employees', orgId],
    queryFn: async () => {
      if (!orgId) return 0;
      const { count, error } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const maxUsers = plan?.max_users ?? null;
  const maxEmployees = plan?.max_employees ?? null;

  const isUsersAtLimit = !isAdmin && maxUsers !== null && userCount >= maxUsers;
  const isEmployeesAtLimit = !isAdmin && maxEmployees !== null && employeeCount >= maxEmployees;

  return {
    userCount,
    employeeCount,
    maxUsers,
    maxEmployees,
    isUsersAtLimit,
    isEmployeesAtLimit,
    canAddUser: !isUsersAtLimit,
    canAddEmployee: !isEmployeesAtLimit,
    isLoading: subLoading || uLoading || eLoading,
  };
}
