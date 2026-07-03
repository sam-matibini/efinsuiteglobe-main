import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface CraPaymentBatch {
  id: string;
  organization_id: string;
  reference: string;
  period_start: string;
  period_end: string;
  program_code: string;
  total_amount: number;
  item_count: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'submitted' | 'completed' | 'failed' | 'cancelled';
  bank_account_id: string | null;
  pad_agreement_id: string | null;
  notes: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CraPaymentBatchItem {
  id: string;
  batch_id: string;
  tax_payment_id: string | null;
  pay_run_id: string | null;
  amount: number;
  employee_count: number | null;
  status: 'pending' | 'submitted' | 'completed' | 'failed' | 'cancelled';
  failure_reason: string | null;
  created_at: string;
}

export function useCraPaymentBatches() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['cra-payment-batches', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cra_payment_batches')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CraPaymentBatch[];
    },
  });

  const createBatch = useMutation({
    mutationFn: async (input: {
      period_start: string;
      period_end: string;
      program_code: string;
      bank_account_id?: string | null;
      pad_agreement_id?: string | null;
      notes?: string;
      items: Array<{ amount: number; pay_run_id?: string | null; employee_count?: number | null }>;
    }) => {
      if (!orgId) throw new Error('No organization selected');
      const ref = `CRABATCH-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0')}`;
      const { data: batch, error } = await supabase
        .from('cra_payment_batches')
        .insert({
          organization_id: orgId,
          reference: ref,
          period_start: input.period_start,
          period_end: input.period_end,
          program_code: input.program_code,
          bank_account_id: input.bank_account_id ?? null,
          pad_agreement_id: input.pad_agreement_id ?? null,
          notes: input.notes ?? null,
          status: 'draft',
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      if (input.items.length > 0) {
        const { error: itemsErr } = await supabase.from('cra_payment_batch_items').insert(
          input.items.map((it) => ({
            batch_id: batch.id,
            amount: it.amount,
            pay_run_id: it.pay_run_id ?? null,
            employee_count: it.employee_count ?? null,
          })),
        );
        if (itemsErr) throw itemsErr;
      }
      return batch as unknown as CraPaymentBatch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-payment-batches', orgId] });
      toast.success('Batch created');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CraPaymentBatch['status'] }) => {
      const patch: Partial<CraPaymentBatch> = { status };
      if (status === 'submitted') patch.submitted_at = new Date().toISOString();
      if (status === 'completed') patch.completed_at = new Date().toISOString();
      const { error } = await supabase.from('cra_payment_batches').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-payment-batches', orgId] });
      toast.success('Batch updated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return {
    batches: query.data ?? [],
    isLoading: query.isLoading,
    createBatch,
    updateStatus,
  };
}
