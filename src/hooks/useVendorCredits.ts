import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface VendorCredit {
  id: string;
  organization_id: string | null;
  vendor_id: string;
  bill_id: string | null;
  credit_number: string;
  credit_date: string;
  reason: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_applied: number;
  balance_remaining: number;
  currency: string;
  notes: string | null;
  journal_entry_id: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { name: string };
  bill?: { bill_number: string };
}

export interface VendorCreditLine {
  id: string;
  vendor_credit_id: string;
  expense_account_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number | null;
  tax_amount: number | null;
  amount: number;
  line_order: number;
}

export interface CreateVendorCreditInput {
  vendor_id: string;
  bill_id?: string;
  credit_date: string;
  reason?: string;
  notes?: string;
  lines: Omit<VendorCreditLine, 'id' | 'vendor_credit_id'>[];
}

export function useVendorCredits() {
  const { organization: currentOrganization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const vendorCreditsQuery = useQuery({
    queryKey: ['vendor_credits', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_credits')
        .select(`
          *,
          vendor:vendors(name),
          bill:bills(bill_number)
        `)
        .eq('organization_id', currentOrganization!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as VendorCredit[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createVendorCredit = useMutation({
    mutationFn: async (input: CreateVendorCreditInput) => {
      // Generate credit number
      const { count } = await supabase
        .from('vendor_credits')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization!.id);
      
      const creditNumber = `VC-${String((count || 0) + 1).padStart(5, '0')}`;
      
      // Calculate totals
      const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
      const taxAmount = input.lines.reduce((sum, line) => {
        const lineAmount = line.quantity * line.unit_price;
        return sum + (lineAmount * (line.tax_rate || 0) / 100);
      }, 0);
      const total = subtotal + taxAmount;

      const { data: vendorCredit, error: vcError } = await supabase
        .from('vendor_credits')
        .insert({
          organization_id: currentOrganization!.id,
          vendor_id: input.vendor_id,
          bill_id: input.bill_id,
          credit_number: creditNumber,
          credit_date: input.credit_date,
          reason: input.reason,
          notes: input.notes,
          subtotal,
          tax_amount: taxAmount,
          total,
          balance_remaining: total,
        })
        .select()
        .single();

      if (vcError) throw vcError;

      // Insert vendor credit lines
      const lines = input.lines.map((line, index) => ({
        vendor_credit_id: vendorCredit.id,
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
        .from('vendor_credit_lines')
        .insert(lines);

      if (linesError) throw linesError;

      return vendorCredit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor_credits'] });
      toast.success('Vendor credit created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create vendor credit: ${error.message}`);
    },
  });

  const issueVendorCredit = useMutation({
    mutationFn: async (creditId: string) => {
      const { error } = await supabase
        .from('vendor_credits')
        .update({
          status: 'issued',
          issued_at: new Date().toISOString(),
        })
        .eq('id', creditId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor_credits'] });
      toast.success('Vendor credit issued');
    },
    onError: (error) => {
      toast.error(`Failed to issue vendor credit: ${error.message}`);
    },
  });

  const applyVendorCredit = useMutation({
    mutationFn: async ({ creditId, billId, amount }: { creditId: string; billId: string; amount: number }) => {
      // Update vendor credit
      const { data: vc, error: vcError } = await supabase
        .from('vendor_credits')
        .select('amount_applied, balance_remaining')
        .eq('id', creditId)
        .single();

      if (vcError) throw vcError;

      const newApplied = Number(vc.amount_applied) + amount;
      const newBalance = Number(vc.balance_remaining) - amount;

      await supabase
        .from('vendor_credits')
        .update({
          amount_applied: newApplied,
          balance_remaining: newBalance,
          status: newBalance <= 0 ? 'applied' : 'issued',
        })
        .eq('id', creditId);

      // Update bill balance
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .select('balance_due, amount_paid')
        .eq('id', billId)
        .single();

      if (billError) throw billError;

      const newBalanceDue = Number(bill.balance_due) - amount;
      const newAmountPaid = Number(bill.amount_paid) + amount;

      await supabase
        .from('bills')
        .update({
          balance_due: newBalanceDue,
          amount_paid: newAmountPaid,
          status: newBalanceDue <= 0 ? 'paid' : 'partial',
        })
        .eq('id', billId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor_credits'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Vendor credit applied to bill');
    },
    onError: (error) => {
      toast.error(`Failed to apply vendor credit: ${error.message}`);
    },
  });

  // Summary statistics
  const vendorCredits = vendorCreditsQuery.data || [];
  const totalCredits = vendorCredits.length;
  const totalCreditValue = vendorCredits.reduce((sum, vc) => sum + Number(vc.total), 0);
  const pendingCredits = vendorCredits
    .filter(vc => vc.status === 'issued')
    .reduce((sum, vc) => sum + Number(vc.balance_remaining), 0);

  return {
    vendorCredits,
    isLoading: vendorCreditsQuery.isLoading,
    error: vendorCreditsQuery.error,
    createVendorCredit,
    issueVendorCredit,
    applyVendorCredit,
    totalCredits,
    totalCreditValue,
    pendingCredits,
  };
}
