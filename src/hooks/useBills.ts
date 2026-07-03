import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { createJournalEntry, getDefaultAccounts, getTaxGlAccounts } from './useJournalEntryCreation';
import { parseLocalDate } from '@/lib/utils';

export interface CreateBillInput {
  vendor_id: string;
  bill_number: string;
  bill_date?: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes?: string;
  terms?: string;
  department_id?: string | null;
}

export interface Bill {
  id: string;
  organization_id: string | null;
  vendor_id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  currency: string;
  notes: string | null;
  terms: string | null;
  created_at: string;
  updated_at: string;
  vendor?: {
    id: string;
    name: string;
  };
}

export function useBills() {
  const { organization: currentOrganization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const billsQuery = useQuery({
    queryKey: ['bills', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          vendor:vendors(id, name)
        `)
        .eq('organization_id', currentOrganization.id)
        .is('deleted_at', null)
        .order('bill_date', { ascending: false });

      if (error) throw error;
      return data as Bill[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createBill = useMutation({
    mutationFn: async (input: CreateBillInput) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');
      
      const billDate = input.bill_date || new Date().toISOString().split('T')[0];
      
      // Create bill
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert([{
          organization_id: currentOrganization.id,
          vendor_id: input.vendor_id,
          bill_number: input.bill_number,
          bill_date: billDate,
          due_date: input.due_date,
          subtotal: input.subtotal,
          tax_amount: input.tax_amount,
          total: input.total,
          balance_due: input.total,
          notes: input.notes || null,
          terms: input.terms || null,
          status: 'received',
          department_id: input.department_id || null,
        }])
        .select()
        .single();
      
      if (billError) throw billError;

      // Create journal entry for the bill with source document tracking
      // Debit: Expense accounts (or asset if inventory)
      // Credit: Accounts Payable
      try {
        const [defaultAccounts, taxGl] = await Promise.all([
          getDefaultAccounts(currentOrganization.id),
          getTaxGlAccounts(currentOrganization.id),
        ]);

        if (defaultAccounts.ap) {
          // Find a general expense account
          const { data: expenseAccount } = await supabase
            .from('accounts')
            .select('id')
            .eq('organization_id', currentOrganization.id)
            .eq('account_type', 'expense')
            .eq('is_active', true)
            .limit(1)
            .single();

          if (expenseAccount) {
            const baseDimensions = {
              vendor_id: input.vendor_id,
              source_document_type: 'bill',
              source_document_id: bill.id,
            };

            const journalLines = [
              { 
                account_id: expenseAccount.id, 
                debit: input.subtotal, 
                credit: 0, 
                memo: `Bill ${input.bill_number}`,
                ...baseDimensions,
              },
            ];

            // Add tax debit if applicable (ITC).
            // ITCs go to the GST/HST Paid (Input Tax Credit) account, not the collected
            // liability. Prefer the explicit GL configured in sales_tax_settings.
            const itcAccountId = taxGl.gstPaidAccountId ?? null;
            if (input.tax_amount > 0 && itcAccountId) {
              journalLines.push({
                account_id: itcAccountId,
                debit: input.tax_amount,
                credit: 0,
                memo: `ITC - Bill ${input.bill_number}`,
                ...baseDimensions,
              });
            } else if (input.tax_amount > 0) {
              console.warn(
                `Bill ${input.bill_number}: ITC of ${input.tax_amount} not posted — no GST/HST Paid (ITC) GL configured in Sales Tax Settings.`,
              );
            }
            
            journalLines.push({
              account_id: defaultAccounts.ap.id,
              debit: 0,
              credit: input.total,
              memo: `Bill ${input.bill_number}`,
              ...baseDimensions,
            });
            
            const journalEntryId = await createJournalEntry({
              organizationId: currentOrganization.id,
              date: billDate,
              description: `Bill ${input.bill_number} from vendor`,
              reference: `BILL-${input.bill_number}`,
              journalType: 'purchase',
              departmentId: input.department_id || null,
              lines: journalLines,
            });

            // Update bill with journal entry ID
            await supabase
              .from('bills')
              .update({ journal_entry_id: journalEntryId })
              .eq('id', bill.id);
          }
        }
      } catch (jeError) {
        console.warn('Could not create journal entry for bill:', jeError);
      }
      
      return bill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Bill created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create bill: ' + error.message);
    },
  });

  const updateBillStatus = useMutation({
    mutationFn: async ({ billId, status }: { billId: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      
      if (status === 'paid') {
        updates.paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('bills')
        .update(updates)
        .eq('id', billId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Bill status updated');
    },
    onError: (error) => {
      toast.error('Failed to update bill: ' + error.message);
    },
  });

  const deleteBill = useMutation({
    mutationFn: async (billId: string) => {
      // Get the bill to check status
      const { data: bill, error: fetchError } = await supabase
        .from('bills')
        .select('status')
        .eq('id', billId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Only allow deletion of void or received (issued equivalent) bills
      if (!['void', 'received'].includes(bill.status)) {
        throw new Error('Only voided or received bills can be deleted');
      }

      // Soft delete
      const { error } = await supabase
        .from('bills')
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: (await supabase.auth.getUser()).data.user?.id 
        })
        .eq('id', billId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Bill deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete bill: ' + error.message);
    },
  });

  // Calculate summary stats
  const totalOutstanding = (billsQuery.data ?? [])
    .filter(b => b.status !== 'paid')
    .reduce((sum, b) => sum + b.balance_due, 0);

  const overdueAmount = (billsQuery.data ?? [])
    .filter(b => b.status === 'overdue' || (parseLocalDate(b.due_date) < new Date() && b.status !== 'paid'))
    .reduce((sum, b) => sum + b.balance_due, 0);

  const paidThisMonth = (billsQuery.data ?? [])
    .filter(b => {
      if (b.status !== 'paid') return false;
      const paidDate = new Date(b.updated_at);
      const now = new Date();
      return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, b) => sum + b.total, 0);

  return {
    bills: billsQuery.data ?? [],
    isLoading: billsQuery.isLoading,
    error: billsQuery.error,
    createBill,
    updateBillStatus,
    deleteBill,
    totalOutstanding,
    overdueAmount,
    paidThisMonth,
  };
}
