import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { createJournalEntry, getDefaultAccounts } from './useJournalEntryCreation';
import { markBillWhtWithheld } from '@/lib/ngTax/integration';
import { parseLocalDate } from '@/lib/utils';

export interface VendorPayment {
  id: string;
  organization_id: string;
  vendor_id: string;
  bill_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  reference: string | null;
  bank_account_id: string | null;
  bank_transaction_id: string | null;
  journal_entry_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vendor?: {
    id: string;
    name: string;
  };
  bill?: {
    id: string;
    bill_number: string;
    total: number;
    balance_due: number;
  };
}

export interface CreateVendorPaymentInput {
  vendor_id: string;
  bill_id?: string;
  amount: number;
  payment_date?: string;
  payment_method?: string;
  reference?: string;
  bank_account_id?: string;
  notes?: string;
  department_id?: string | null;
}

export function useVendorPayments() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ['vendor-payments', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('vendor_payments')
        .select(`
          *,
          vendor:vendors(id, name),
          bill:bills(id, bill_number, total, balance_due)
        `)
        .eq('organization_id', organization.id)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data as VendorPayment[];
    },
    enabled: !!organization?.id,
  });

  const createPayment = useMutation({
    mutationFn: async (input: CreateVendorPaymentInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      // Create the payment record
      const { data: payment, error: paymentError } = await supabase
        .from('vendor_payments')
        .insert([{
          organization_id: organization.id,
          vendor_id: input.vendor_id,
          bill_id: input.bill_id || null,
          amount: input.amount,
          payment_date: input.payment_date || new Date().toISOString().split('T')[0],
          payment_method: input.payment_method || null,
          reference: input.reference || null,
          bank_account_id: input.bank_account_id || null,
          notes: input.notes || null,
          department_id: input.department_id || null,
        }])
        .select()
        .single();
      
      if (paymentError) throw paymentError;

      // If there's a bill, update its paid amount and status
      if (input.bill_id) {
        const { data: bill } = await supabase
          .from('bills')
          .select('amount_paid, total')
          .eq('id', input.bill_id)
          .single();
        
        if (bill) {
          const newAmountPaid = (bill.amount_paid || 0) + input.amount;
          const newBalanceDue = bill.total - newAmountPaid;
          const newStatus = newBalanceDue <= 0 ? 'paid' : newAmountPaid > 0 ? 'partial' : 'received';
          
          await supabase
            .from('bills')
            .update({
              amount_paid: newAmountPaid,
              balance_due: Math.max(0, newBalanceDue),
              status: newStatus,
              paid_at: newBalanceDue <= 0 ? new Date().toISOString() : null,
            })
            .eq('id', input.bill_id);
        }
      }

      // Create journal entry for the payment
      // Debit: Accounts Payable
      // Credit: Cash/Bank
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
        
        if (cashAccountId && defaultAccounts.ap) {
          const journalEntryId = await createJournalEntry({
            organizationId: organization.id,
            date: paymentDate,
            description: `Vendor payment`,
            reference: input.reference || `VPMT-${payment.id.slice(0, 8)}`,
            departmentId: input.department_id || null,
            lines: [
              { account_id: defaultAccounts.ap.id, debit: input.amount, credit: 0, memo: 'Vendor payment' },
              { account_id: cashAccountId, debit: 0, credit: input.amount, memo: 'Vendor payment' },
            ],
          });

          // Update payment with journal entry ID
          await supabase
            .from('vendor_payments')
            .update({ journal_entry_id: journalEntryId })
            .eq('id', payment.id);
        }
      } catch (jeError) {
        console.warn('Could not create journal entry for vendor payment:', jeError);
      }
      
      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-payments'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Payment recorded successfully');
    },
    onError: (error) => {
      toast.error('Failed to record payment: ' + error.message);
    },
  });

  // Summary stats
  const totalPaidThisMonth = payments
    .filter(p => {
      const paymentDate = parseLocalDate(p.payment_date);
      const now = new Date();
      return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    payments,
    isLoading,
    error,
    totalPaidThisMonth,
    createPayment,
  };
}
