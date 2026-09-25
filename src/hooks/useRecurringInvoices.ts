import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { parseLocalDate } from '@/lib/utils';

export interface RecurringInvoice {
  id: string;
  organization_id: string | null;
  customer_id: string;
  template_name: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  next_invoice_date: string;
  days_until_due: number;
  status: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  terms: string | null;
  notes: string | null;
  auto_send: boolean;
  invoices_generated: number;
  last_generated_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: { name: string };
}

export interface RecurringInvoiceLine {
  id: string;
  recurring_invoice_id: string;
  product_service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number | null;
  tax_amount: number | null;
  amount: number;
  line_order: number;
}

export interface CreateRecurringInvoiceInput {
  customer_id: string;
  template_name: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  days_until_due?: number;
  auto_send?: boolean;
  terms?: string;
  notes?: string;
  lines: Omit<RecurringInvoiceLine, 'id' | 'recurring_invoice_id'>[];
}

export function useRecurringInvoices() {
  const { organization: currentOrganization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const recurringInvoicesQuery = useQuery({
    queryKey: ['recurring_invoices', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_invoices')
        .select(`
          *,
          customer:customers(name)
        `)
        .eq('organization_id', currentOrganization!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as RecurringInvoice[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createRecurringInvoice = useMutation({
    mutationFn: async (input: CreateRecurringInvoiceInput) => {
      // Calculate totals
      const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
      const taxAmount = input.lines.reduce((sum, line) => {
        const lineAmount = line.quantity * line.unit_price;
        return sum + (lineAmount * (line.tax_rate || 0) / 100);
      }, 0);

      const { data: recurringInvoice, error: riError } = await supabase
        .from('recurring_invoices')
        .insert({
          organization_id: currentOrganization!.id,
          customer_id: input.customer_id,
          template_name: input.template_name,
          frequency: input.frequency,
          start_date: input.start_date,
          end_date: input.end_date,
          next_invoice_date: input.start_date,
          days_until_due: input.days_until_due || 30,
          auto_send: input.auto_send || false,
          terms: input.terms,
          notes: input.notes,
          subtotal,
          tax_amount: taxAmount,
          total: subtotal + taxAmount,
        })
        .select()
        .single();

      if (riError) throw riError;

      // Insert recurring invoice lines
      const lines = input.lines.map((line, index) => ({
        recurring_invoice_id: recurringInvoice.id,
        product_service_id: line.product_service_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate || 0,
        tax_amount: (line.quantity * line.unit_price) * (line.tax_rate || 0) / 100,
        amount: line.quantity * line.unit_price,
        line_order: index,
      }));

      const { error: linesError } = await supabase
        .from('recurring_invoice_lines')
        .insert(lines);

      if (linesError) throw linesError;

      return recurringInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_invoices'] });
      toast.success('Recurring invoice created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create recurring invoice: ${error.message}`);
    },
  });

  const updateRecurringInvoiceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('recurring_invoices')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_invoices'] });
      toast.success('Recurring invoice status updated');
    },
    onError: (error) => {
      toast.error(`Failed to update recurring invoice: ${error.message}`);
    },
  });

  const generateInvoice = useMutation({
    mutationFn: async (recurringInvoiceId: string) => {
      // Get the recurring invoice and its lines
      const { data: ri, error: riError } = await supabase
        .from('recurring_invoices')
        .select('*, recurring_invoice_lines(*)')
        .eq('id', recurringInvoiceId)
        .single();

      if (riError) throw riError;

      // Generate invoice number
      const { count } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization!.id);
      
      const invoiceNumber = `INV-${String((count || 0) + 1).padStart(5, '0')}`;

      // Calculate due date
      const invoiceDate = new Date();
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + ri.days_until_due);

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          organization_id: currentOrganization!.id,
          customer_id: ri.customer_id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
          subtotal: ri.subtotal,
          tax_amount: ri.tax_amount,
          total: ri.total,
          balance_due: ri.total,
          terms: ri.terms,
          notes: ri.notes,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice lines
      const invoiceLines = ri.recurring_invoice_lines.map((line: RecurringInvoiceLine, index: number) => ({
        invoice_id: invoice.id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate || 0,
        tax_amount: line.tax_amount || 0,
        amount: line.amount,
        line_order: index,
      }));

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(invoiceLines);

      if (linesError) throw linesError;

      // Calculate next invoice date based on frequency
      const nextDate = parseLocalDate(ri.next_invoice_date);
      switch (ri.frequency) {
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'biweekly':
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'annually':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }

      // Check if we've reached the end date
      const shouldComplete = ri.end_date && nextDate > parseLocalDate(ri.end_date);

      // Update recurring invoice
      await supabase
        .from('recurring_invoices')
        .update({
          next_invoice_date: nextDate.toISOString().split('T')[0],
          invoices_generated: ri.invoices_generated + 1,
          last_generated_at: new Date().toISOString(),
          status: shouldComplete ? 'completed' : ri.status,
        })
        .eq('id', recurringInvoiceId);

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice generated from template');
    },
    onError: (error) => {
      toast.error(`Failed to generate invoice: ${error.message}`);
    },
  });

  // Summary statistics
  const recurringInvoices = recurringInvoicesQuery.data || [];
  const activeTemplates = recurringInvoices.filter(ri => ri.status === 'active').length;
  const monthlyRevenue = recurringInvoices
    .filter(ri => ri.status === 'active')
    .reduce((sum, ri) => {
      let multiplier = 1;
      switch (ri.frequency) {
        case 'weekly': multiplier = 4.33; break;
        case 'biweekly': multiplier = 2.17; break;
        case 'monthly': multiplier = 1; break;
        case 'quarterly': multiplier = 0.33; break;
        case 'annually': multiplier = 0.083; break;
      }
      return sum + Number(ri.total) * multiplier;
    }, 0);

  return {
    recurringInvoices,
    isLoading: recurringInvoicesQuery.isLoading,
    error: recurringInvoicesQuery.error,
    createRecurringInvoice,
    updateRecurringInvoiceStatus,
    generateInvoice,
    activeTemplates,
    monthlyRevenue,
  };
}
