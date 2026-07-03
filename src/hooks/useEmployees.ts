import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type Employee = Database['public']['Tables']['employees']['Row'];
type EmployeeInsert = Database['public']['Tables']['employees']['Insert'];

export function useEmployees() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const employeesQuery = useQuery({
    queryKey: ['employees', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('organization_id', organization.id)
        .is('deleted_at', null) // Exclude soft-deleted employees
        .order('last_name');

      if (error) throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  const createEmployee = useMutation({
    mutationFn: async (input: Omit<EmployeeInsert, 'organization_id'>) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const { data, error } = await supabase
        .from('employees')
        .insert({ ...input, organization_id: organization.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create employee: ' + error.message);
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Employee> & { id: string }) => {
      const { error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update employee: ' + error.message);
    },
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete: set deleted_at timestamp
      const { error } = await supabase
        .from('employees')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete employee: ' + error.message);
    },
  });

  const getEmployeeById = (id: string) => {
    return employeesQuery.data?.find(e => e.id === id);
  };

  // Stats
  const stats = {
    total: employeesQuery.data?.length ?? 0,
    active: employeesQuery.data?.filter(e => e.status === 'active').length ?? 0,
    onboarding: employeesQuery.data?.filter(e => e.status === 'onboarding').length ?? 0,
    onLeave: employeesQuery.data?.filter(e => e.status === 'on_leave').length ?? 0,
    terminated: employeesQuery.data?.filter(e => e.status === 'terminated').length ?? 0,
  };

  const departments = Array.from(new Set(employeesQuery.data?.map(e => e.department).filter(Boolean) ?? []));

  return {
    employees: employeesQuery.data ?? [],
    isLoading: employeesQuery.isLoading,
    error: employeesQuery.error,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    getEmployeeById,
    stats,
    departments,
  };
}
