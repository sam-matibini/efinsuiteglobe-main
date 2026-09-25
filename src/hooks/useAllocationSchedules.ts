import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface AllocationSchedule {
  id: string;
  organization_id: string;
  rule_id: string;
  frequency: 'monthly' | 'quarterly';
  day_of_period: number;
  next_run_at: string;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useAllocationSchedules() {
  const { organization } = useCurrentOrganization();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['allocation-schedules', organization?.id],
    queryFn: async (): Promise<AllocationSchedule[]> => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('allocation_schedules')
        .select('*')
        .eq('organization_id', organization.id)
        .order('next_run_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AllocationSchedule[];
    },
    enabled: !!organization?.id,
  });

  const upsert = useMutation({
    mutationFn: async (
      vars: Partial<AllocationSchedule> & { rule_id: string; frequency: 'monthly' | 'quarterly' },
    ) => {
      const payload: any = {
        organization_id: organization!.id,
        rule_id: vars.rule_id,
        frequency: vars.frequency,
        day_of_period: vars.day_of_period ?? 1,
        next_run_at: vars.next_run_at ?? new Date().toISOString(),
        active: vars.active ?? true,
        notes: vars.notes ?? null,
      };
      if (vars.id) {
        const { error } = await supabase.from('allocation_schedules').update(payload).eq('id', vars.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('allocation_schedules').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allocation-schedules'] });
      toast.success('Schedule saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (vars: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from('allocation_schedules')
        .update({ active: vars.active })
        .eq('id', vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allocation-schedules'] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('allocation_schedules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allocation-schedules'] });
      toast.success('Schedule removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { ...query, upsert, toggleActive, remove };
}
