import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type PayrollBatchStatus =
  | 'draft' | 'approved' | 'processing' | 'completed' | 'partial' | 'failed' | 'cancelled';
export type PayrollBatchProvider =
  | 'stripe' | 'plaid' | 'manual' | 'wire' | 'cheque' | 'wallet' | 'paysafe_eft' | 'paysafe_card'
  | 'wise_eft' | 'wise_etransfer' | 'wise_card' | 'efinmoney';
export type Rail =
  | 'instant' | 'ach' | 'eft' | 'wire' | 'wallet_stripe' | 'wallet_paddle' | 'cheque' | 'manual' | 'card'
  | 'wise_eft' | 'wise_etransfer' | 'wallet_efinmoney';
export type ApprovalState =
  | 'draft' | 'pending_review' | 'pending_approval' | 'approved' | 'rejected';

export interface PayrollPaymentBatch {
  id: string;
  organization_id: string;
  pay_run_id: string;
  batch_number: string;
  pay_date: string;
  funding_bank_account_id: string | null;
  total_net: number;
  currency: string;
  status: PayrollBatchStatus;
  provider: PayrollBatchProvider;
  provider_batch_id: string | null;
  approval_state: ApprovalState;
  originator_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  notes: string | null;
  journal_entry_id: string | null;
  created_at: string;
}

export interface PayrollPaymentItem {
  id: string;
  batch_id: string;
  pay_stub_id: string | null;
  employee_id: string | null;
  amount: number;
  currency: string;
  rail: Rail;
  destination_institution: string | null;
  destination_transit: string | null;
  destination_account_masked: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'reversed';
  provider_transfer_id: string | null;
  failure_reason: string | null;
  journal_entry_id: string | null;
}

export interface CreatePayrollBatchInput {
  pay_run_id: string;
  pay_date: string;
  funding_bank_account_id?: string | null;
  currency?: string;
  provider: PayrollBatchProvider;
  notes?: string | null;
  default_rail?: Rail;
}

function mask(acc: string | null | undefined): string | null {
  if (!acc) return null;
  const s = String(acc);
  return s.length <= 3 ? `***${s}` : `***${s.slice(-3)}`;
}

export function usePayrollPaymentBatches() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['payroll-payment-batches', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_payment_batches' as never)
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PayrollPaymentBatch[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreatePayrollBatchInput) => {
      if (!orgId) throw new Error('No organization');

      // Pull stubs + employees for the pay run
      const { data: stubs, error: stubsErr } = await supabase
        .from('pay_stubs')
        .select('id, employee_id, net_pay, employee:employees(id, bank_institution, bank_transit, bank_account)')
        .eq('pay_run_id', input.pay_run_id);
      if (stubsErr) throw stubsErr;
      if (!stubs || stubs.length === 0) throw new Error('No pay stubs found for this pay run');

      const total = stubs.reduce((s, r) => s + Number((r as { net_pay: number }).net_pay || 0), 0);
      const batchNumber = `PAY-${input.pay_date.replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;

      // Determine initial approval state via org policy
      const { data: org } = await supabase
        .from('organizations')
        .select('treasury_approval_policy')
        .eq('id', orgId)
        .single();
      const policy = (org?.treasury_approval_policy as {
        dual_control?: boolean; approval_threshold?: number;
      } | null) ?? {};
      const requiresWorkflow = policy.dual_control || total >= (policy.approval_threshold ?? Infinity);
      const initialState: ApprovalState = requiresWorkflow ? 'pending_review' : 'approved';

      const { data: batch, error: batchErr } = await supabase
        .from('payroll_payment_batches' as never)
        .insert({
          organization_id: orgId,
          pay_run_id: input.pay_run_id,
          batch_number: batchNumber,
          pay_date: input.pay_date,
          funding_bank_account_id: input.funding_bank_account_id ?? null,
          total_net: total,
          currency: input.currency ?? 'CAD',
          status: 'draft',
          provider: input.provider,
          approval_state: initialState,
          originator_id: user?.id,
          notes: input.notes ?? null,
          created_by: user?.id,
        } as never)
        .select()
        .single();
      if (batchErr) throw batchErr;

      const defaultRail: Rail = input.default_rail ?? providerDefaultRail(input.provider);
      const items = stubs.map((r) => {
        const emp = (r as { employee?: { bank_institution?: string | null; bank_transit?: string | null; bank_account?: string | null } }).employee;
        const hasBank = !!(emp?.bank_institution && emp?.bank_transit && emp?.bank_account);
        // e-Transfer and wallet rails don't need bank coordinates; bank rails fall back to cheque.
        const railNeedsBank = !['wise_etransfer', 'wallet_efinmoney', 'wallet_stripe', 'wallet_paddle', 'cheque', 'manual', 'card'].includes(defaultRail);
        return {
          batch_id: (batch as { id: string }).id,
          pay_stub_id: (r as { id: string }).id,
          employee_id: (r as { employee_id: string }).employee_id,
          amount: Number((r as { net_pay: number }).net_pay || 0),
          currency: input.currency ?? 'CAD',
          rail: (railNeedsBank && !hasBank ? 'cheque' : defaultRail) as Rail,
          destination_institution: emp?.bank_institution ?? null,
          destination_transit: emp?.bank_transit ?? null,
          destination_account_masked: mask(emp?.bank_account),
          status: 'pending',
        };
      });

      const { error: itemsErr } = await supabase
        .from('payroll_payment_items' as never)
        .insert(items as never);
      if (itemsErr) throw itemsErr;
      return batch as PayrollPaymentBatch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-payment-batches', orgId] });
      toast.success('Payroll payment batch created');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const process = useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase.functions.invoke('treasury-pay-payroll-batch', {
        body: { batch_id: batchId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-payment-batches', orgId] });
      toast.success('Payroll batch processed');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { batches: query.data ?? [], isLoading: query.isLoading, create, process };
}

export function usePayrollPaymentItems(batchId: string | undefined) {
  return useQuery({
    queryKey: ['payroll-payment-items', batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_payment_items' as never)
        .select('*')
        .eq('batch_id', batchId!)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as unknown as PayrollPaymentItem[];
    },
  });
}
