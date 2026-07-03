import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ReconciliationItem {
  id: string;
  organization_id: string;
  tax_payment_id: string | null;
  bank_transaction_id: string | null;
  candidates: Array<{ id: string; date: string; amount: number; description: string; reference?: string }>;
  status: 'open' | 'resolved' | 'dismissed';
  reason: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export function useReconciliationQueue() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['reconciliation-queue', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reconciliation_review_queue')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ReconciliationItem[];
    },
  });

  const resolve = useMutation({
    mutationFn: async ({ id, bank_transaction_id, tax_payment_id }: { id: string; bank_transaction_id: string; tax_payment_id: string }) => {
      // Mark the chosen bank transaction matched + complete the tax payment
      const txDate = new Date().toISOString().slice(0, 10);
      const { error: upTxErr } = await supabase
        .from('tax_payments')
        .update({
          status: 'completed',
          confirmation_number: `MANUAL-${bank_transaction_id.slice(0, 8)}`,
          paid_at: new Date().toISOString(),
          reconciliation_source: 'manual_review',
        })
        .eq('id', tax_payment_id);
      if (upTxErr) throw upTxErr;

      await supabase
        .from('bank_transactions')
        .update({ status: 'matched', is_cleared: true, cleared_at: new Date().toISOString() })
        .eq('id', bank_transaction_id);

      const { error } = await supabase
        .from('reconciliation_review_queue')
        .update({
          status: 'resolved',
          bank_transaction_id,
          resolved_by: user?.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation-queue', orgId] });
      qc.invalidateQueries({ queryKey: ['tax-payments', orgId] });
      toast.success('Reconciliation resolved');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reconciliation_review_queue')
        .update({ status: 'dismissed', resolved_by: user?.id, resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation-queue', orgId] });
      toast.success('Dismissed');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return {
    items: query.data ?? [],
    open: (query.data ?? []).filter((i) => i.status === 'open'),
    isLoading: query.isLoading,
    resolve,
    dismiss,
  };
}
