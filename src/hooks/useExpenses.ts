import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { createJournalEntry, getDefaultAccounts } from './useJournalEntryCreation';

export interface Expense {
  id: string;
  organization_id: string | null;
  expense_date: string;
  expense_account_id: string | null;
  amount: number;
  currency: string;
  tax_treatment: 'inclusive' | 'exclusive';
  paid_through_account_id: string | null;
  tax_code_id: string | null;
  tax_amount: number;
  vendor_id: string | null;
  customer_id: string | null;
  reference: string | null;
  notes: string | null;
  receipt_url: string | null;
  receipt_urls: string[] | null;
  is_billable: boolean;
  expense_type: 'expense' | 'mileage';
  distance: number | null;
  distance_unit: string | null;
  rate_per_unit: number | null;
  vehicle_description: string | null;
  from_location: string | null;
  to_location: string | null;
  journal_entry_id: string | null;
  is_posted: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { name: string };
  customer?: { name: string };
  expense_account?: { code: string; name: string };
  paid_through_account?: { code: string; name: string };
}

export interface ExpenseItem {
  id: string;
  expense_id: string;
  expense_account_id: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_code_id: string | null;
  tax_amount: number;
  line_order: number;
  created_at: string;
}

export interface CreateExpenseInput {
  expense_date: string;
  expense_account_id?: string;
  amount: number;
  currency?: string;
  tax_treatment?: 'inclusive' | 'exclusive';
  paid_through_account_id?: string;
  tax_code_id?: string;
  tax_amount?: number;
  vendor_id?: string;
  customer_id?: string;
  reference?: string;
  notes?: string;
  receipt_url?: string;
  receipt_urls?: string[];
  is_billable?: boolean;
  expense_type?: 'expense' | 'mileage';
  distance?: number;
  distance_unit?: string;
  rate_per_unit?: number;
  vehicle_description?: string;
  from_location?: string;
  to_location?: string;
  department_id?: string | null;
  items?: Omit<ExpenseItem, 'id' | 'expense_id' | 'created_at'>[];
}

export interface CreateMileageInput {
  expense_date: string;
  from_location: string;
  to_location: string;
  distance: number;
  distance_unit?: string;
  rate_per_unit: number;
  vehicle_description?: string;
  expense_account_id?: string;
  paid_through_account_id?: string;
  vendor_id?: string;
  customer_id?: string;
  reference?: string;
  notes?: string;
  is_billable?: boolean;
}

export interface BulkExpenseInput {
  expense_date: string;
  expense_account_id?: string;
  description: string;
  amount: number;
  vendor_id?: string;
  reference?: string;
}

export function useExpenses() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const expensesQuery = useQuery({
    queryKey: ['expenses', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];

      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          vendor:vendors(name),
          customer:customers(name),
          expense_account:accounts!expenses_expense_account_id_fkey(code, name),
          paid_through_account:accounts!expenses_paid_through_account_id_fkey(code, name)
        `)
        .eq('organization_id', organization.id)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!organization?.id,
  });

  const createExpense = useMutation({
    mutationFn: async (input: CreateExpenseInput) => {
      if (!organization?.id) throw new Error('No organization selected');

      // Validate tax_code_id exists in database (derived codes don't exist there)
      let validatedTaxCodeId: string | null = null;
      if (input.tax_code_id) {
        const { data: taxCodeExists } = await supabase
          .from('tax_codes')
          .select('id')
          .eq('id', input.tax_code_id)
          .maybeSingle();
        
        // Only use tax_code_id if it exists in the database
        validatedTaxCodeId = taxCodeExists?.id || null;
      }

      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          organization_id: organization.id,
          expense_date: input.expense_date,
          expense_account_id: input.expense_account_id || null,
          amount: input.amount,
          currency: input.currency || organization.currency || 'CAD',
          tax_treatment: input.tax_treatment || 'exclusive',
          paid_through_account_id: input.paid_through_account_id || null,
          tax_code_id: validatedTaxCodeId,
          tax_amount: input.tax_amount || 0,
          vendor_id: input.vendor_id || null,
          customer_id: input.customer_id || null,
          reference: input.reference || null,
          notes: input.notes || null,
          receipt_url: input.receipt_url || (input.receipt_urls?.[0] ?? null),
          receipt_urls: input.receipt_urls && input.receipt_urls.length > 0
            ? input.receipt_urls
            : input.receipt_url
              ? [input.receipt_url]
              : [],
          is_billable: input.is_billable || false,
          expense_type: input.expense_type || 'expense',
          distance: input.distance || null,
          distance_unit: input.distance_unit || 'km',
          rate_per_unit: input.rate_per_unit || null,
          vehicle_description: input.vehicle_description || null,
          from_location: input.from_location || null,
          to_location: input.to_location || null,
          department_id: input.department_id || null,
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // Insert line items if provided
      if (input.items && input.items.length > 0) {
        // Validate all tax_code_ids in items
        const itemTaxCodeIds = input.items
          .map(item => item.tax_code_id)
          .filter((id): id is string => !!id);
        
        let validTaxCodeIds: Set<string> = new Set();
        if (itemTaxCodeIds.length > 0) {
          const { data: existingCodes } = await supabase
            .from('tax_codes')
            .select('id')
            .in('id', itemTaxCodeIds);
          validTaxCodeIds = new Set(existingCodes?.map(c => c.id) || []);
        }

        const items = input.items.map((item, index) => ({
          expense_id: expense.id,
          expense_account_id: item.expense_account_id || null,
          description: item.description || null,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          amount: item.amount,
          tax_code_id: item.tax_code_id && validTaxCodeIds.has(item.tax_code_id) ? item.tax_code_id : null,
          tax_amount: item.tax_amount || 0,
          line_order: index,
        }));

        const { error: itemsError } = await supabase
          .from('expense_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      // Create journal entry for proper GL integration
      if (input.expense_account_id && input.paid_through_account_id) {
        try {
          const totalAmount = input.amount + (input.tax_amount || 0);
          
          const journalLines = [
            // Debit expense account
            { account_id: input.expense_account_id, debit: input.amount, credit: 0, memo: input.notes || 'Expense' },
          ];

          // Add tax line if applicable
          if (input.tax_amount && input.tax_amount > 0) {
            const defaults = await getDefaultAccounts(organization.id);
            if (defaults.salesTax) {
              journalLines.push({ 
                account_id: defaults.salesTax.id, 
                debit: input.tax_amount, 
                credit: 0, 
                memo: 'Input Tax' 
              });
            }
          }

          // Credit the paid-through account (cash/bank)
          journalLines.push({ 
            account_id: input.paid_through_account_id, 
            debit: 0, 
            credit: totalAmount, 
            memo: input.notes || 'Expense payment' 
          });

          const journalId = await createJournalEntry({
            organizationId: organization.id,
            date: input.expense_date,
            description: input.notes || 'Direct Expense',
            reference: input.reference,
            journalType: 'purchase',
            departmentId: input.department_id || null,
            lines: journalLines,
            status: 'posted',
          });

          // Update expense with journal entry ID
          await supabase
            .from('expenses')
            .update({ journal_entry_id: journalId, is_posted: true })
            .eq('id', expense.id);
        } catch (jeError) {
          console.warn('Journal entry creation failed:', jeError);
          // Continue - expense is saved, just not posted to GL
        }
      }

      return expense;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['journal_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Expense recorded successfully');
    },
    onError: (error) => {
      toast.error(`Failed to record expense: ${error.message}`);
    },
  });

  const createMileage = useMutation({
    mutationFn: async (input: CreateMileageInput) => {
      if (!organization?.id) throw new Error('No organization selected');

      const amount = input.distance * input.rate_per_unit;

      const { data, error } = await supabase
        .from('expenses')
        .insert({
          organization_id: organization.id,
          expense_date: input.expense_date,
          expense_account_id: input.expense_account_id || null,
          amount,
          currency: organization.currency || 'CAD',
          tax_treatment: 'exclusive',
          paid_through_account_id: input.paid_through_account_id || null,
          vendor_id: input.vendor_id || null,
          customer_id: input.customer_id || null,
          reference: input.reference || null,
          notes: input.notes || null,
          is_billable: input.is_billable || false,
          expense_type: 'mileage',
          distance: input.distance,
          distance_unit: input.distance_unit || 'km',
          rate_per_unit: input.rate_per_unit,
          vehicle_description: input.vehicle_description || null,
          from_location: input.from_location,
          to_location: input.to_location,
        })
        .select()
        .single();

      if (error) throw error;

      // Create journal entry for mileage expense
      if (input.expense_account_id && input.paid_through_account_id) {
        try {
          const journalId = await createJournalEntry({
            organizationId: organization.id,
            date: input.expense_date,
            description: `Mileage: ${input.from_location} → ${input.to_location} (${input.distance} ${input.distance_unit || 'km'})`,
            reference: input.reference,
            journalType: 'purchase',
            lines: [
              { account_id: input.expense_account_id, debit: amount, credit: 0, memo: 'Mileage expense' },
              { account_id: input.paid_through_account_id, debit: 0, credit: amount, memo: 'Mileage reimbursement' },
            ],
            status: 'posted',
          });

          await supabase
            .from('expenses')
            .update({ journal_entry_id: journalId, is_posted: true })
            .eq('id', data.id);
        } catch (jeError) {
          console.warn('Journal entry creation failed:', jeError);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['journal_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Mileage recorded successfully');
    },
    onError: (error) => {
      toast.error(`Failed to record mileage: ${error.message}`);
    },
  });

  const createBulkExpenses = useMutation({
    mutationFn: async (inputs: BulkExpenseInput[]) => {
      if (!organization?.id) throw new Error('No organization selected');

      const expenses = inputs.map(input => ({
        organization_id: organization.id,
        expense_date: input.expense_date,
        expense_account_id: input.expense_account_id || null,
        amount: input.amount,
        currency: organization.currency || 'CAD',
        tax_treatment: 'exclusive' as const,
        vendor_id: input.vendor_id || null,
        reference: input.reference || null,
        notes: input.description,
        expense_type: 'expense' as const,
      }));

      const { data, error } = await supabase
        .from('expenses')
        .insert(expenses)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success(`${data.length} expenses recorded successfully`);
    },
    onError: (error) => {
      toast.error(`Failed to record expenses: ${error.message}`);
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateExpenseInput> }) => {
      const payload: Record<string, any> = { ...updates };
      ['expense_account_id', 'paid_through_account_id', 'vendor_id', 'customer_id', 'tax_code_id', 'department_id'].forEach((k) => {
        if (payload[k] === '') payload[k] = null;
      });
      const { data, error } = await supabase
        .from('expenses')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense updated');
    },
    onError: (error) => {
      toast.error(`Failed to update expense: ${error.message}`);
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete expense: ${error.message}`);
    },
  });

  // Summary statistics
  const expenses = expensesQuery.data || [];
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalMileage = expenses
    .filter(e => e.expense_type === 'mileage')
    .reduce((sum, e) => sum + Number(e.distance || 0), 0);
  const expenseCount = expenses.length;
  const mileageCount = expenses.filter(e => e.expense_type === 'mileage').length;

  return {
    expenses,
    isLoading: expensesQuery.isLoading,
    error: expensesQuery.error,
    createExpense,
    createMileage,
    createBulkExpenses,
    updateExpense,
    deleteExpense,
    totalExpenses,
    totalMileage,
    expenseCount,
    mileageCount,
  };
}
