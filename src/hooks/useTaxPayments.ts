import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type TaxPaymentType = 'source_deductions' | 'gst_hst' | 'corporate_tax' | 'provision' | 'withholding' | 'other';
export type TaxPaymentStatus =
  | 'draft' | 'pending' | 'authorized' | 'processing' | 'completed' | 'returned'
  // legacy values kept for backwards compatibility
  | 'scheduled' | 'submitted' | 'paid' | 'failed' | 'reversed' | 'cancelled';
export type TaxPaymentMethod = 'eft' | 'pad' | 'stripe' | 'plaid_ach' | 'manual' | 'cra_my_payment' | 'wire' | 'cheque' | 'paysafe_card' | 'paysafe_eft' | 'paysafe_interac';
export type TaxPaymentRail =
  | 'manual' | 'stripe_card' | 'vopay_eft' | 'vopay_pad' | 'vopay_instant'
  | 'cra_my_payment' | 'wire' | 'cheque' | 'paysafe_card' | 'paysafe_eft' | 'paysafe_interac';

export interface TaxPayment {
  id: string;
  organization_id: string;
  reference: string;
  authority_id: string | null;
  payment_type: TaxPaymentType;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  currency: string;
  status: TaxPaymentStatus;
  scheduled_for: string | null;
  bank_account_id: string | null;
  payment_method: TaxPaymentMethod;
  confirmation_number: string | null;
  journal_entry_id: string | null;
  remittance_id: string | null;
  tax_filing_period_id: string | null;
  provider_transfer_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  submitted_at: string | null;
  paid_at: string | null;
  created_at: string;
  cra_account_id?: string | null;
  confirmation_pdf_url?: string | null;
  initiated_by?: string | null;
  approved_by?: string | null;
  payment_rail?: TaxPaymentRail | null;
  rail_payment_id?: string | null;
  settlement_reference?: string | null;
  settled_at?: string | null;
  scheduled_payment_id?: string | null;
  requires_mfa?: boolean | null;
  card_brand?: string | null;
  card_last4?: string | null;
  filing_period_label?: string | null;
}

export interface CreateTaxPaymentInput {
  authority_id?: string | null;
  payment_type: TaxPaymentType;
  period_start?: string | null;
  period_end?: string | null;
  amount: number;
  currency?: string;
  bank_account_id?: string | null;
  payment_method: TaxPaymentMethod;
  remittance_id?: string | null;
  tax_filing_period_id?: string | null;
  scheduled_for?: string | null;
  notes?: string | null;
  confirmation_number?: string | null;
  cra_account_id?: string | null;
  // PD7A breakdown (payroll source deductions)
  number_of_employees?: number | null;
  gross_payroll?: number | null;
  income_tax?: number | null;
  cpp_employee?: number | null;
  cpp_employer?: number | null;
  ei_employee?: number | null;
  ei_employer?: number | null;
  receipt_email?: string | null;
  payment_rail?: TaxPaymentRail | null;
  filing_period_label?: string | null;
  requires_mfa?: boolean | null;
}

export function useTaxPayments() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['tax-payments', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_payments')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TaxPayment[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreateTaxPaymentInput) => {
      if (!orgId) throw new Error('No organization');
      const { data: refData, error: refErr } = await supabase.rpc('next_tax_payment_reference', { p_org: orgId });
      if (refErr) throw refErr;
      const reference = refData as unknown as string;

      // Strip non-column fields; stash PD7A breakdown into metadata.
      const {
        receipt_email,
        number_of_employees,
        gross_payroll,
        income_tax,
        cpp_employee,
        cpp_employer,
        ei_employee,
        ei_employer,
        ...row
      } = input as CreateTaxPaymentInput & Record<string, unknown>;

      const pd7a = {
        number_of_employees, gross_payroll, income_tax,
        cpp_employee, cpp_employer, ei_employee, ei_employer,
      };
      const hasPd7a = Object.values(pd7a).some((v) => v !== undefined && v !== null);
      const metadata = hasPd7a ? { pd7a } : undefined;
      void receipt_email;

      const { data, error } = await supabase
        .from('tax_payments')
        .insert({
          organization_id: orgId,
          reference,
          status: 'draft',
          currency: input.currency ?? 'CAD',
          created_by: user?.id,
          ...row,
          ...(metadata ? { metadata } : {}),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-payments', orgId] });
      toast.success('Tax payment created');
    },
    onError: (e: Error) => toast.error(`Failed to create tax payment: ${e.message}`),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, confirmation_number, receipt_email }: { id: string; status: TaxPaymentStatus; confirmation_number?: string; receipt_email?: string }) => {
      const patch: Record<string, unknown> = { status };
      if (confirmation_number) patch.confirmation_number = confirmation_number;
      if (status === 'submitted') patch.submitted_at = new Date().toISOString();
      if (status === 'paid') patch.paid_at = new Date().toISOString();
      const { error } = await supabase.from('tax_payments').update(patch).eq('id', id);
      if (error) throw error;
      if (status === 'paid' && receipt_email) {
        try {
          await supabase.functions.invoke('send-tax-payment-receipt', {
            body: { tax_payment_id: id, recipient_email: receipt_email },
          });
        } catch (err) {
          console.error('Failed to send receipt email', err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-payments', orgId] });
      toast.success('Status updated');
    },
    onError: (e: Error) => toast.error(`Failed to update: ${e.message}`),
  });

  const sendReceipt = useMutation({
    mutationFn: async ({ id, recipient_email }: { id: string; recipient_email: string }) => {
      const { error } = await supabase.functions.invoke('send-tax-payment-receipt', {
        body: { tax_payment_id: id, recipient_email },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Receipt email sent'),
    onError: (e: Error) => toast.error(`Failed to send receipt: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_payments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-payments', orgId] });
      toast.success('Payment deleted');
    },
    onError: (e: Error) => toast.error(`Failed to delete: ${e.message}`),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<TaxPayment,
      'amount' | 'period_start' | 'period_end' | 'payment_method' | 'notes' |
      'scheduled_for' | 'bank_account_id' | 'cra_account_id' | 'currency'
    >> }) => {
      if (patch.amount !== undefined) {
        const { data: existing, error: fetchErr } = await supabase
          .from('tax_payments')
          .select('journal_entry_id, status')
          .eq('id', id)
          .single();
        if (fetchErr) throw fetchErr;
        if ((existing as { journal_entry_id?: string | null })?.journal_entry_id) {
          throw new Error('Cannot edit amount: payment already has a posted journal entry');
        }
        const st = (existing as { status?: string })?.status;
        if (!['draft', 'scheduled', 'failed'].includes(st as string)) {
          throw new Error(`Cannot edit a payment in status "${st}"`);
        }
      }
      const { error } = await supabase.from('tax_payments').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-payments', orgId] });
      toast.success('Payment updated');
    },
    onError: (e: Error) => toast.error(`Failed to update: ${e.message}`),
  });

  const recordConfirmation = useMutation({
    mutationFn: async ({ id, confirmation_number, paid_at, notes }: { id: string; confirmation_number: string; paid_at: string; notes?: string }) => {
      const patch: Record<string, unknown> = {
        status: 'completed',
        confirmation_number,
        paid_at: new Date(paid_at).toISOString(),
      };
      if (notes && notes.trim()) patch.notes = notes.trim();
      const { error } = await supabase.from('tax_payments').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-payments', orgId] });
      queryClient.invalidateQueries({ queryKey: ['payment-history', orgId] });
      toast.success('CRA confirmation recorded');
    },
    onError: (e: Error) => toast.error(`Failed to record confirmation: ${e.message}`),
  });

  return {
    payments: query.data ?? [],
    isLoading: query.isLoading,
    create,
    updateStatus,
    update,
    remove,
    sendReceipt,
    recordConfirmation,
  };
}
