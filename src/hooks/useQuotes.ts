import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface Quote {
  id: string;
  organization_id: string | null;
  customer_id: string;
  quote_number: string;
  quote_date: string;
  expiry_date: string;
  status: string;
  subtotal: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_amount: number | null;
  tax_amount: number;
  total: number;
  currency: string;
  terms: string | null;
  notes: string | null;
  internal_notes: string | null;
  converted_invoice_id: string | null;
  converted_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: { name: string };
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  product_service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  amount: number;
  line_order: number;
}

export interface CreateQuoteInput {
  customer_id: string;
  quote_date: string;
  expiry_date: string;
  terms?: string;
  notes?: string;
  lines: Omit<QuoteLine, 'id' | 'quote_id'>[];
}

export function useQuotes() {
  const { organization: currentOrganization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const quotesQuery = useQuery({
    queryKey: ['quotes', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(name)
        `)
        .eq('organization_id', currentOrganization!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createQuote = useMutation({
    mutationFn: async (input: CreateQuoteInput) => {
      // Generate quote number
      const { count } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization!.id);
      
      const quoteNumber = `QT-${String((count || 0) + 1).padStart(5, '0')}`;
      
      // Calculate totals
      const subtotal = input.lines.reduce((sum, line) => {
        const lineAmount = line.quantity * line.unit_price * (1 - (line.discount_percent || 0) / 100);
        return sum + lineAmount;
      }, 0);
      
      const taxAmount = input.lines.reduce((sum, line) => {
        const lineAmount = line.quantity * line.unit_price * (1 - (line.discount_percent || 0) / 100);
        return sum + (lineAmount * (line.tax_rate || 0) / 100);
      }, 0);

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          organization_id: currentOrganization!.id,
          customer_id: input.customer_id,
          quote_number: quoteNumber,
          quote_date: input.quote_date,
          expiry_date: input.expiry_date,
          terms: input.terms,
          notes: input.notes,
          subtotal,
          tax_amount: taxAmount,
          total: subtotal + taxAmount,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Insert quote lines
      const lines = input.lines.map((line, index) => ({
        quote_id: quote.id,
        product_service_id: line.product_service_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_percent: line.discount_percent || 0,
        tax_rate: line.tax_rate || 0,
        tax_amount: (line.quantity * line.unit_price * (1 - (line.discount_percent || 0) / 100)) * (line.tax_rate || 0) / 100,
        amount: line.quantity * line.unit_price * (1 - (line.discount_percent || 0) / 100),
        line_order: index,
      }));

      const { error: linesError } = await supabase
        .from('quote_lines')
        .insert(lines);

      if (linesError) throw linesError;

      return quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create quote: ${error.message}`);
    },
  });

  const updateQuoteStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      
      if (status === 'sent') {
        updates.sent_at = new Date().toISOString();
      } else if (status === 'accepted') {
        updates.accepted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote status updated');
    },
    onError: (error) => {
      toast.error(`Failed to update quote: ${error.message}`);
    },
  });

  const convertToInvoice = useMutation({
    mutationFn: async (quoteId: string) => {
      // Get the quote and its lines
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*, quote_lines(*)')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;

      // Generate invoice number
      const { count } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization!.id);
      
      const invoiceNumber = `INV-${String((count || 0) + 1).padStart(5, '0')}`;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          organization_id: currentOrganization!.id,
          customer_id: quote.customer_id,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          subtotal: quote.subtotal,
          tax_amount: quote.tax_amount,
          total: quote.total,
          balance_due: quote.total,
          terms: quote.terms,
          notes: quote.notes,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice lines
      const invoiceLines = quote.quote_lines.map((line: QuoteLine, index: number) => ({
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

      // Update quote status
      await supabase
        .from('quotes')
        .update({
          status: 'converted',
          converted_invoice_id: invoice.id,
          converted_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Quote converted to invoice successfully');
    },
    onError: (error) => {
      toast.error(`Failed to convert quote: ${error.message}`);
    },
  });

  // Summary statistics
  const quotes = quotesQuery.data || [];
  const totalQuotes = quotes.length;
  const draftQuotes = quotes.filter(q => q.status === 'draft').length;
  const pendingValue = quotes
    .filter(q => ['draft', 'sent'].includes(q.status))
    .reduce((sum, q) => sum + Number(q.total), 0);
  const acceptedValue = quotes
    .filter(q => q.status === 'accepted')
    .reduce((sum, q) => sum + Number(q.total), 0);

  return {
    quotes,
    isLoading: quotesQuery.isLoading,
    error: quotesQuery.error,
    createQuote,
    updateQuoteStatus,
    convertToInvoice,
    totalQuotes,
    draftQuotes,
    pendingValue,
    acceptedValue,
  };
}
