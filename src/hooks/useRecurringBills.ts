import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { parseLocalDate } from '@/lib/utils';

export interface RecurringBill {
  id: string;
  organization_id: string | null;
  vendor_id: string;
  template_name: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  next_bill_date: string;
  days_until_due: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  status: string;
  terms: string | null;
  notes: string | null;
  bills_generated: number;
  last_generated_at: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { name: string };
}

export interface RecurringBillLine {
  id: string;
  recurring_bill_id: string;
  expense_account_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number | null;
  tax_amount: number | null;
  amount: number;
  line_order: number;
}

export interface CreateRecurringBillInput {
  vendor_id: string;
  template_name: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  days_until_due?: number;
  terms?: string;
  notes?: string;
  lines: Omit<RecurringBillLine, 'id' | 'recurring_bill_id'>[];
}

export function useRecurringBills() {
  const { organization: currentOrganization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const recurringBillsQuery = useQuery({
    queryKey: ['recurring_bills', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_bills')
        .select(`
          *,
          vendor:vendors(name)
        `)
        .eq('organization_id', currentOrganization!.id)
        .order('next_bill_date', { ascending: true });
      
      if (error) throw error;
      return data as RecurringBill[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createRecurringBill = useMutation({
    mutationFn: async (input: CreateRecurringBillInput) => {
      // Calculate totals
      const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
      const taxAmount = input.lines.reduce((sum, line) => {
        const lineAmount = line.quantity * line.unit_price;
        return sum + (lineAmount * (line.tax_rate || 0) / 100);
      }, 0);
      const total = subtotal + taxAmount;

      const { data: recurringBill, error: rbError } = await supabase
        .from('recurring_bills')
        .insert({
          organization_id: currentOrganization!.id,
          vendor_id: input.vendor_id,
          template_name: input.template_name,
          frequency: input.frequency,
          start_date: input.start_date,
          end_date: input.end_date,
          next_bill_date: input.start_date,
          days_until_due: input.days_until_due || 30,
          terms: input.terms,
          notes: input.notes,
          subtotal,
          tax_amount: taxAmount,
          total,
        })
        .select()
        .single();

      if (rbError) throw rbError;

      // Insert lines
      const lines = input.lines.map((line, index) => ({
        recurring_bill_id: recurringBill.id,
        expense_account_id: line.expense_account_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate || 0,
        tax_amount: (line.quantity * line.unit_price) * (line.tax_rate || 0) / 100,
        amount: line.quantity * line.unit_price,
        line_order: index,
      }));

      const { error: linesError } = await supabase
        .from('recurring_bill_lines')
        .insert(lines);

      if (linesError) throw linesError;

      return recurringBill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_bills'] });
      toast.success('Recurring bill schedule created');
    },
    onError: (error) => {
      toast.error(`Failed to create recurring bill: ${error.message}`);
    },
  });

  const updateRecurringBillStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('recurring_bills')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_bills'] });
      toast.success('Recurring bill status updated');
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  const generateBillNow = useMutation({
    mutationFn: async (recurringBillId: string) => {
      // Get the recurring bill and its lines
      const { data: rb, error: rbError } = await supabase
        .from('recurring_bills')
        .select('*, recurring_bill_lines(*)')
        .eq('id', recurringBillId)
        .single();

      if (rbError) throw rbError;

      // Generate bill number
      const { count } = await supabase
        .from('bills')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization!.id);
      
      const billNumber = `BILL-${String((count || 0) + 1).padStart(5, '0')}`;
      const billDate = new Date().toISOString().split('T')[0];
      const dueDate = new Date(Date.now() + rb.days_until_due * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Create the bill
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert({
          organization_id: currentOrganization!.id,
          vendor_id: rb.vendor_id,
          bill_number: billNumber,
          bill_date: billDate,
          due_date: dueDate,
          subtotal: rb.subtotal,
          tax_amount: rb.tax_amount,
          total: rb.total,
          balance_due: rb.total,
          terms: rb.terms,
          notes: rb.notes,
        })
        .select()
        .single();

      if (billError) throw billError;

      // Create bill lines
      const billLines = (rb.recurring_bill_lines as RecurringBillLine[]).map((line, index) => ({
        bill_id: bill.id,
        expense_account_id: line.expense_account_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate || 0,
        tax_amount: line.tax_amount || 0,
        amount: line.amount,
        line_order: index,
      }));

      const { error: linesError } = await supabase
        .from('bill_lines')
        .insert(billLines);

      if (linesError) throw linesError;

      // Update the recurring bill with new next date
      const nextDate = calculateNextDate(rb.frequency, parseLocalDate(rb.next_bill_date));
      
      await supabase
        .from('recurring_bills')
        .update({
          last_generated_at: new Date().toISOString(),
          bills_generated: rb.bills_generated + 1,
          next_bill_date: nextDate.toISOString().split('T')[0],
        })
        .eq('id', recurringBillId);

      return bill;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_bills'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Bill generated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to generate bill: ${error.message}`);
    },
  });

  // Summary statistics
  const recurringBills = recurringBillsQuery.data || [];
  const activeSchedules = recurringBills.filter(rb => rb.status === 'active').length;
  const monthlyTotal = recurringBills
    .filter(rb => rb.status === 'active' && rb.frequency === 'monthly')
    .reduce((sum, rb) => sum + Number(rb.total), 0);
  const nextSevenDays = recurringBills.filter(rb => {
    if (rb.status !== 'active') return false;
    const nextDate = parseLocalDate(rb.next_bill_date);
    const now = new Date();
    const diff = nextDate.getTime() - now.getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  return {
    recurringBills,
    isLoading: recurringBillsQuery.isLoading,
    error: recurringBillsQuery.error,
    createRecurringBill,
    updateRecurringBillStatus,
    generateBillNow,
    activeSchedules,
    monthlyTotal,
    nextSevenDays,
  };
}

function calculateNextDate(frequency: string, currentDate: Date): Date {
  const next = new Date(currentDate);
  
  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'annually':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }
  
  return next;
}
