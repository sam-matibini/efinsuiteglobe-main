import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { postBillToGL, type BillGLLine } from '@/lib/postBillToGL';
import { parseLocalDate } from '@/lib/utils';
import { reverseLinkedJournalEntry, recalculateAndInvalidate } from './useGLPropagation';

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
  /** Optional per-line GL breakdown; falls back to a single subtotal line. */
  lines?: BillGLLine[];

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

      // Post the bill to the General Ledger (shared with the Create Bill dialog).
      try {
        await postBillToGL({
          organizationId: currentOrganization.id,
          billId: bill.id,
          billNumber: input.bill_number,
          billDate,
          vendorId: input.vendor_id,
          taxAmount: input.tax_amount,
          total: input.total,
          departmentId: input.department_id || null,
          lines:
            input.lines && input.lines.length > 0
              ? input.lines
              : [{ amount: input.subtotal }],
        });
      } catch (jeError) {
        // Roll the bill back so no un-posted document is left behind.
        await supabase.from('bills').delete().eq('id', bill.id);
        throw jeError instanceof Error ? jeError : new Error('Failed to post bill to the General Ledger');
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

  /**
   * Voids a bill: reverses the linked journal entry (audit-safe) so the GL,
   * Trial Balance and financial statements no longer include the bill, then
   * marks the bill as void with a zero balance.
   */
  const voidBill = useMutation({
    mutationFn: async (billId: string) => {
      const { data: bill, error: fetchError } = await supabase
        .from('bills')
        .select('id, status, amount_paid, journal_entry_id, organization_id, notes')
        .eq('id', billId)
        .single();
      if (fetchError) throw fetchError;

      if (bill.status === 'void') throw new Error('This bill is already voided.');
      if (Number(bill.amount_paid || 0) > 0) {
        throw new Error('This bill has payments applied. Reverse the payment before voiding.');
      }

      const orgId = bill.organization_id || currentOrganization?.id;

      if (bill.journal_entry_id && orgId) {
        await reverseLinkedJournalEntry({
          journalEntryId: bill.journal_entry_id,
          organizationId: orgId,
        });
      }

      const { error } = await supabase
        .from('bills')
        .update({
          status: 'void',
          balance_due: 0,
          journal_entry_id: null,
          notes: [bill.notes, `Voided on ${new Date().toISOString().split('T')[0]}`]
            .filter(Boolean)
            .join('\n'),
        })
        .eq('id', billId);
      if (error) throw error;

      if (orgId) await recalculateAndInvalidate(orgId, queryClient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Bill voided and journal entry reversed');
    },
    onError: (error: Error) => {
      toast.error('Failed to void bill: ' + error.message);
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
    voidBill,
    totalOutstanding,
    overdueAmount,
    paidThisMonth,
  };
}
