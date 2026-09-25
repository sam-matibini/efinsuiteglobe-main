import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export interface EmployeeBankingProfile {
  id: string;
  organization_id: string;
  employee_id: string;
  institution_number: string | null;
  transit_number: string | null;
  account_number: string | null;
  deposit_type: 'chequing' | 'savings';
  allocation_percent: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useEmployeeBanking(employeeId?: string) {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['employee-banking', orgId, employeeId ?? 'all'],
    enabled: !!orgId,
    queryFn: async () => {
      let q = (supabase as any).from('employee_banking_profiles')
        .select('*').eq('organization_id', orgId!);
      if (employeeId) q = q.eq('employee_id', employeeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EmployeeBankingProfile[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<EmployeeBankingProfile> & { employee_id: string }) => {
      if (!orgId) throw new Error('No organization');
      if (input.transit_number && !/^[0-9]{5}$/.test(input.transit_number)) throw new Error('Transit must be 5 digits');
      if (input.institution_number && !/^[0-9]{3}$/.test(input.institution_number)) throw new Error('Institution must be 3 digits');
      const { error } = await (supabase as any)
        .from('employee_banking_profiles')
        .upsert({ ...input, organization_id: orgId }, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-banking'] });
      toast.success('Employee banking saved');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { profiles: query.data ?? [], isLoading: query.isLoading, upsert };
}
