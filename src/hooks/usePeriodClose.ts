import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type CloseStatus = 'open' | 'reconciled' | 'filed' | 'paid' | 'closed';

export interface PeriodCloseRow {
  id: string;
  organization_id: string;
  authority: string;
  program_code: string | null;
  period_start: string;
  period_end: string;
  statutory_due_date: string | null;
  status: CloseStatus;
  related_tax_payment_id: string | null;
  related_filing_id: string | null;
  notes: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
}

export const CLOSE_STATUSES: CloseStatus[] = ['open', 'reconciled', 'filed', 'paid', 'closed'];

export function usePeriodClose() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['treasury-period-close', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('treasury_period_close')
        .select('*')
        .eq('organization_id', orgId!)
        .order('period_end', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as PeriodCloseRow[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Partial<PeriodCloseRow> & { authority: string; period_start: string; period_end: string }) => {
      const { error } = await (supabase as any).from('treasury_period_close').insert({
        organization_id: orgId,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treasury-period-close', orgId] });
      toast.success('Period added');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CloseStatus }) => {
      const patch: Record<string, unknown> = { status };
      if (status === 'closed') {
        patch.closed_at = new Date().toISOString();
        patch.closed_by = user?.id ?? null;
      }
      const { error } = await (supabase as any).from('treasury_period_close').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treasury-period-close', orgId] });
      toast.success('Status updated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    byStatus: (s: CloseStatus) => (query.data ?? []).filter((r) => r.status === s),
    dueSoon: (query.data ?? []).filter((r) => {
      if (!r.statutory_due_date || r.status === 'closed') return false;
      const due = new Date(r.statutory_due_date + 'T00:00:00').getTime();
      const days = (due - Date.now()) / 86400000;
      return days <= 7 && days >= -30;
    }),
    create,
    setStatus,
  };
}
