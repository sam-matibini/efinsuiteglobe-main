import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { canApprove, requestApproval } from '@/lib/approvals';
import { postExpenseClaimDocument } from '@/lib/approvals/posting';

export interface ExpenseClaim {
  id: string;
  organization_id: string | null;
  employee_id: string;
  claim_number: string;
  claim_date: string;
  status: string;
  total_amount: number;
  currency: string;
  description: string | null;
  notes: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  journal_entry_id: string | null;
  created_at: string;
  updated_at: string;
  employee?: { first_name: string; last_name: string };
}

export interface ExpenseClaimLine {
  id: string;
  expense_claim_id: string;
  expense_account_id: string | null;
  expense_date: string;
  description: string;
  category: string | null;
  amount: number;
  tax_amount: number | null;
  receipt_url: string | null;
  receipt_urls: string[] | null;
  is_billable: boolean;
  customer_id: string | null;
  line_order: number;
}

export interface CreateExpenseClaimInput {
  employee_id: string;
  claim_date: string;
  description?: string;
  notes?: string;
  lines: Omit<ExpenseClaimLine, 'id' | 'expense_claim_id'>[];
}

export function useExpenseClaims() {
  const { organization: currentOrganization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const expenseClaimsQuery = useQuery({
    queryKey: ['expense_claims', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_claims')
        .select(`
          *,
          employee:employees(first_name, last_name)
        `)
        .eq('organization_id', currentOrganization!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ExpenseClaim[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createExpenseClaim = useMutation({
    mutationFn: async (input: CreateExpenseClaimInput) => {
      // Generate claim number
      const { count } = await supabase
        .from('expense_claims')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization!.id);
      
      const claimNumber = `EXP-${String((count || 0) + 1).padStart(5, '0')}`;
      
      // Calculate total
      const totalAmount = input.lines.reduce((sum, line) => sum + line.amount + (line.tax_amount || 0), 0);

      const { data: claim, error: claimError } = await supabase
        .from('expense_claims')
        .insert({
          organization_id: currentOrganization!.id,
          employee_id: input.employee_id,
          claim_number: claimNumber,
          claim_date: input.claim_date,
          description: input.description,
          notes: input.notes,
          total_amount: totalAmount,
          prepared_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        })
        .select()
        .single();

      if (claimError) throw claimError;

      // Insert expense claim lines
      const lines = input.lines.map((line, index) => ({
        expense_claim_id: claim.id,
        expense_account_id: line.expense_account_id,
        expense_date: line.expense_date,
        description: line.description,
        category: line.category,
        amount: line.amount,
        tax_amount: line.tax_amount || 0,
        receipt_url: line.receipt_url || (line.receipt_urls?.[0] ?? null),
        receipt_urls: line.receipt_urls && line.receipt_urls.length > 0
          ? line.receipt_urls
          : line.receipt_url
            ? [line.receipt_url]
            : [],
        is_billable: line.is_billable || false,
        customer_id: line.customer_id,
        line_order: index,
      }));

      const { error: linesError } = await supabase
        .from('expense_claim_lines')
        .insert(lines);

      if (linesError) throw linesError;

      return claim;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_claims'] });
      toast.success('Expense claim created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create expense claim: ${error.message}`);
    },
  });

  const submitExpenseClaim = useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await supabase
        .from('expense_claims')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (error) throw error;

      const { data: claim } = await supabase
        .from('expense_claims')
        .select('total_amount, prepared_by')
        .eq('id', claimId)
        .single();
      const { data: authData } = await supabase.auth.getUser();

      await requestApproval({
        organizationId: currentOrganization!.id,
        documentType: 'expense_claim',
        documentId: claimId,
        requestedBy: (claim as any)?.prepared_by || authData.user?.id || '',
        amount: Number((claim as any)?.total_amount) || 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_claims'] });
      toast.success('Expense claim submitted for approval');
    },
    onError: (error) => {
      toast.error(`Failed to submit expense claim: ${error.message}`);
    },
  });

  const approveExpenseClaim = useMutation({
    mutationFn: async ({ claimId, approverId }: { claimId: string; approverId: string }) => {
      const orgId = currentOrganization!.id;

      const { data: claim } = await supabase
        .from('expense_claims')
        .select('prepared_by, total_amount')
        .eq('id', claimId)
        .single();

      // Segregation of duties + approver eligibility.
      const eligibility = await canApprove({
        organizationId: orgId,
        userId: approverId,
        documentType: 'expense_claim',
        preparedBy: (claim as any)?.prepared_by ?? null,
      });
      if (!eligibility.allowed) throw new Error(eligibility.reason || 'Not authorised to approve');

      const { error } = await supabase
        .from('expense_claims')
        .update({
          status: 'approved',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (error) throw error;

      // Approved claims post to the General Ledger.
      await postExpenseClaimDocument(orgId, claimId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_claims'] });
      queryClient.invalidateQueries({ queryKey: ['journal_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Expense claim approved and posted to the General Ledger');
    },
    onError: (error) => {
      toast.error(`Failed to approve expense claim: ${error.message}`);
    },
  });

  const rejectExpenseClaim = useMutation({
    mutationFn: async ({ claimId, reviewerId, notes }: { claimId: string; reviewerId: string; notes?: string }) => {
      const { error } = await supabase
        .from('expense_claims')
        .update({
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          notes,
        })
        .eq('id', claimId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_claims'] });
      toast.success('Expense claim rejected');
    },
    onError: (error) => {
      toast.error(`Failed to reject expense claim: ${error.message}`);
    },
  });

  const payExpenseClaim = useMutation({
    mutationFn: async ({ claimId, paymentMethod, paymentReference }: { claimId: string; paymentMethod: string; paymentReference?: string }) => {
      const { error } = await supabase
        .from('expense_claims')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: paymentMethod,
          payment_reference: paymentReference,
        })
        .eq('id', claimId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_claims'] });
      toast.success('Expense claim marked as paid');
    },
    onError: (error) => {
      toast.error(`Failed to mark expense claim as paid: ${error.message}`);
    },
  });

  // Summary statistics
  const expenseClaims = expenseClaimsQuery.data || [];
  const totalClaims = expenseClaims.length;
  const pendingApproval = expenseClaims.filter(c => c.status === 'submitted').length;
  const pendingPayment = expenseClaims
    .filter(c => c.status === 'approved')
    .reduce((sum, c) => sum + Number(c.total_amount), 0);
  const totalPaid = expenseClaims
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + Number(c.total_amount), 0);

  return {
    expenseClaims,
    isLoading: expenseClaimsQuery.isLoading,
    error: expenseClaimsQuery.error,
    createExpenseClaim,
    submitExpenseClaim,
    approveExpenseClaim,
    rejectExpenseClaim,
    payExpenseClaim,
    totalClaims,
    pendingApproval,
    pendingPayment,
    totalPaid,
  };
}
