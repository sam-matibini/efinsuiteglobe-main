import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type ScheduledPaymentKind = 'cra' | 'ap_batch' | 'payroll';
export type ScheduledFrequency = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';

export interface ScheduledPayment {
  id: string;
  organization_id: string;
  payment_kind: ScheduledPaymentKind;
  description: string | null;
  cra_account_id: string | null;
  source_ref: string | null;
  funding_bank_account_id: string | null;
  amount: number | null;
  currency: string;
  frequency: ScheduledFrequency;
  next_run_date: string;
  end_date: string | null;
  auto_submit: boolean;
  requires_approval: boolean;
  is_active: boolean;
  last_run_at: string | null;
  last_status: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useScheduledPayments() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['scheduled-payments', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('scheduled_payments')
        .select('*')
        .eq('organization_id', orgId!)
        .order('next_run_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ScheduledPayment[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Partial<ScheduledPayment>) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await (supabase as any)
        .from('scheduled_payments')
        .insert({ ...input, organization_id: orgId, created_by: user?.id })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-payments'] });
      toast.success('Schedule created');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from('scheduled_payments').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scheduled-payments'] }),
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('scheduled_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-payments'] });
      toast.success('Removed');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { schedules: query.data ?? [], isLoading: query.isLoading, create, toggle, remove };
}
