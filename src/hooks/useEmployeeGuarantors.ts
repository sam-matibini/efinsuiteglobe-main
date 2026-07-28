import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface EmployeeGuarantor {
  id?: string;
  employee_id: string;
  organization_id?: string;
  guarantor_order: 1 | 2;
  full_name: string;
  sex?: string | null;
  phone_number?: string | null;
  email?: string | null;
  marital_status?: string | null;
  relationship?: string | null;
  profession?: string | null;
  residential_address?: string | null;
  residential_city?: string | null;
  residential_postal_code?: string | null;
  residential_state?: string | null;
  residential_country?: string | null;
  office_address?: string | null;
  office_city?: string | null;
  office_postal_code?: string | null;
  office_state?: string | null;
  office_country?: string | null;
  notes?: string | null;
}

export function useEmployeeGuarantors(employeeId?: string) {
  const { organization } = useCurrentOrganization();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['employee_guarantors', employeeId],
    queryFn: async (): Promise<EmployeeGuarantor[]> => {
      if (!employeeId) return [];
      const { data, error } = await (supabase as any)
        .from('employee_guarantors')
        .select('*')
        .eq('employee_id', employeeId)
        .order('guarantor_order');
      if (error) throw error;
      return (data ?? []) as EmployeeGuarantor[];
    },
    enabled: !!employeeId,
  });

  const upsert = useMutation({
    mutationFn: async (g: EmployeeGuarantor) => {
      if (!organization?.id) throw new Error('No organization');
      const payload = { ...g, organization_id: organization.id };
      const { error } = await (supabase as any)
        .from('employee_guarantors')
        .upsert(payload, { onConflict: 'employee_id,guarantor_order' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee_guarantors', employeeId] });
    },
    onError: (e: any) => toast.error('Failed to save guarantor: ' + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('employee_guarantors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee_guarantors', employeeId] });
      toast.success('Guarantor removed');
    },
  });

  return { guarantors: query.data ?? [], isLoading: query.isLoading, upsert, remove };
}

/** Bulk-save guarantors for a newly created employee (used during Add flow). */
export async function saveGuarantorsForEmployee(
  employeeId: string,
  organizationId: string,
  guarantors: Array<Partial<EmployeeGuarantor> & { guarantor_order: 1 | 2; full_name: string }>,
) {
  const rows = guarantors
    .filter((g) => g.full_name && g.full_name.trim().length > 0)
    .map((g) => ({ ...g, employee_id: employeeId, organization_id: organizationId }));
  if (rows.length === 0) return;
  const { error } = await (supabase as any)
    .from('employee_guarantors')
    .upsert(rows, { onConflict: 'employee_id,guarantor_order' });
  if (error) throw error;
}
