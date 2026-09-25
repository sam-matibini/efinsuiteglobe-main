import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { createJournalEntry, getDefaultAccounts } from './useJournalEntryCreation';

export interface CustomerPayment {
  id: string;
  organization_id: string;
  customer_id: string;
  invoice_id: string | null;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  bank_account_id: string | null;
  bank_transaction_id: string | null;
  journal_entry_id: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    name: string;
  };
  invoice?: {
    id: string;
    invoice_number: string;
  };
}

export interface CreatePaymentInput {
  customer_id: string;
  invoice_id?: string;
  payment_date?: string;
  amount: number;
  payment_method?: string;
  reference?: string;
  notes?: string;
  bank_account_id?: string;
  department_id?: string | null;
}

export function useCustomerPayments() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ['customer-payments', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('customer_payments')
        .select(`
          *,
          customer:customers(id, name),
          invoice:invoices(id, invoice_number)
        `)
        .eq('organization_id', organization.id)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data as CustomerPayment[];
    },
    enabled: !!organization?.id,
  });

  const createPayment = useMutation({
    mutationFn: async (input: CreatePaymentInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      // Create payment
      const { data: payment, error: paymentError } = await supabase
        .from('customer_payments')
        .insert([{
          organization_id: organization.id,
          customer_id: input.customer_id,
          invoice_id: input.invoice_id || null,
          payment_date: input.payment_date || new Date().toISOString().split('T')[0],
          amount: input.amount,
          payment_method: input.payment_method || null,
          reference: input.reference || null,
          notes: input.notes || null,
          bank_account_id: input.bank_account_id || null,
          department_id: input.department_id || null,
        }])
        .select()
        .single();
      
      if (paymentError) throw paymentError;
      
      // If linked to an invoice, update the invoice
      if (input.invoice_id) {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('amount_paid, total')
          .eq('id', input.invoice_id)
          .single();
        
        if (invoice) {
          const newAmountPaid = Number(invoice.amount_paid) + input.amount;
          const newBalance = Number(invoice.total) - newAmountPaid;
          const newStatus = newBalance <= 0 ? 'paid' : 'partial';
          
          await supabase
            .from('invoices')
            .update({
              amount_paid: newAmountPaid,
              balance_due: Math.max(0, newBalance),
              status: newStatus,
              paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
            })
            .eq('id', input.invoice_id);
        }
      }

      // Create journal entry for the payment
      // Debit: Cash/Bank
      // Credit: Accounts Receivable
      try {
        const defaultAccounts = await getDefaultAccounts(organization.id);
        const paymentDate = input.payment_date || new Date().toISOString().split('T')[0];
        
        // Use bank account if specified, otherwise use cash
        let cashAccountId = defaultAccounts.cash?.id;
        if (input.bank_account_id) {
          const { data: bankAccount } = await supabase
            .from('bank_accounts')
            .select('gl_account_id')
            .eq('id', input.bank_account_id)
            .single();
          if (bankAccount?.gl_account_id) {
            cashAccountId = bankAccount.gl_account_id;
          }
        }
        
        if (cashAccountId && defaultAccounts.ar) {
          const journalEntryId = await createJournalEntry({
            organizationId: organization.id,
            date: paymentDate,
            description: `Customer payment received`,
            reference: input.reference || `PMT-${payment.id.slice(0, 8)}`,
            departmentId: input.department_id || null,
            lines: [
              { account_id: cashAccountId, debit: input.amount, credit: 0, memo: 'Customer payment' },
              { account_id: defaultAccounts.ar.id, debit: 0, credit: input.amount, memo: 'Customer payment' },
            ],
          });

          // Update payment with journal entry ID
          await supabase
            .from('customer_payments')
            .update({ journal_entry_id: journalEntryId })
            .eq('id', payment.id);
        }
      } catch (jeError) {
        console.warn('Could not create journal entry for customer payment:', jeError);
      }
      
      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment recorded successfully');
    },
    onError: (error) => {
      toast.error('Failed to record payment: ' + error.message);
    },
  });

  const deletePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customer_payments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete payment: ' + error.message);
    },
  });

  const totalReceived = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    payments,
    isLoading,
    error,
    totalReceived,
    createPayment,
    deletePayment,
  };
}
