import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type BatchStatus = 'draft' | 'approved' | 'processing' | 'completed' | 'partial' | 'failed' | 'cancelled';
export type BatchProvider = 'stripe' | 'plaid' | 'manual' | 'wire' | 'cheque' | 'paysafe_eft' | 'paysafe_card' | 'wise_eft' | 'wise_etransfer' | 'wise_card';

export interface APPaymentBatch {
  id: string;
  organization_id: string;
  batch_number: string;
  pay_date: string;
  funding_bank_account_id: string | null;
  total_amount: number;
  currency: string;
  status: BatchStatus;
  provider: BatchProvider;
  provider_batch_id: string | null;
  notes: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface APPaymentBatchItem {
  id: string;
  batch_id: string;
  bill_id: string | null;
  vendor_id: string | null;
  amount: number;
  currency: string;
  vendor_payment_id: string | null;
  journal_entry_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'reversed';
  provider_transfer_id: string | null;
  failure_reason: string | null;
}

export interface CreateBatchInput {
  pay_date: string;
  funding_bank_account_id?: string | null;
  currency?: string;
  provider: BatchProvider;
  notes?: string | null;
  items: Array<{ bill_id: string; vendor_id: string; amount: number; currency?: string }>;
}

export function useAPPaymentBatches() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['ap-payment-batches', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ap_payment_batches')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as APPaymentBatch[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreateBatchInput) => {
      if (!orgId) throw new Error('No organization');
      const { data: numData, error: numErr } = await supabase.rpc('next_ap_batch_number', { p_org: orgId });
      if (numErr) throw numErr;
      const batchNumber = numData as unknown as string;

      const total = input.items.reduce((s, i) => s + Number(i.amount), 0);

      const { data: batch, error: batchErr } = await supabase
        .from('ap_payment_batches')
        .insert({
          organization_id: orgId,
          batch_number: batchNumber,
          pay_date: input.pay_date,
          funding_bank_account_id: input.funding_bank_account_id ?? null,
          total_amount: total,
          currency: input.currency ?? 'CAD',
          status: 'draft',
          provider: input.provider,
          notes: input.notes ?? null,
          created_by: user?.id,
        })
        .select()
        .single();
      if (batchErr) throw batchErr;

      if (input.items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('ap_payment_batch_items')
          .insert(input.items.map((i) => ({
            batch_id: batch.id,
            bill_id: i.bill_id,
            vendor_id: i.vendor_id,
            amount: i.amount,
            currency: i.currency ?? input.currency ?? 'CAD',
            status: 'pending',
          })));
        if (itemsErr) throw itemsErr;
      }
      return batch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-payment-batches', orgId] });
      toast.success('Payment batch created');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BatchStatus }) => {
      const patch: Record<string, unknown> = { status };
      if (status === 'approved') { patch.approved_at = new Date().toISOString(); patch.approved_by = user?.id; }
      if (status === 'processing') { patch.submitted_at = new Date().toISOString(); patch.submitted_by = user?.id; }
      if (status === 'completed') { patch.completed_at = new Date().toISOString(); }
      const { error } = await supabase.from('ap_payment_batches').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ap-payment-batches', orgId] });
      toast.success('Batch status updated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { batches: query.data ?? [], isLoading: query.isLoading, create, updateStatus };
}

export function useAPPaymentBatchItems(batchId: string | undefined) {
  return useQuery({
    queryKey: ['ap-payment-batch-items', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ap_payment_batch_items')
        .select('*')
        .eq('batch_id', batchId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as APPaymentBatchItem[];
    },
  });
}
