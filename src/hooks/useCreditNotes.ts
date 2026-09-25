import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface CreditNote {
  id: string;
  organization_id: string | null;
  customer_id: string;
  invoice_id: string | null;
  credit_note_number: string;
  credit_note_date: string;
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
  customer?: { name: string };
  invoice?: { invoice_number: string };
}

export interface CreditNoteLine {
  id: string;
  credit_note_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number | null;
  tax_amount: number | null;
  amount: number;
  line_order: number;
}

export interface CreateCreditNoteInput {
  customer_id: string;
  invoice_id?: string;
  credit_note_date: string;
  reason?: string;
  notes?: string;
  lines: Omit<CreditNoteLine, 'id' | 'credit_note_id'>[];
}

export function useCreditNotes() {
  const { organization: currentOrganization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const creditNotesQuery = useQuery({
    queryKey: ['credit_notes', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_notes')
        .select(`
          *,
          customer:customers(name),
          invoice:invoices(invoice_number)
        `)
        .eq('organization_id', currentOrganization!.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CreditNote[];
    },
    enabled: !!currentOrganization?.id,
  });

  const createCreditNote = useMutation({
    mutationFn: async (input: CreateCreditNoteInput) => {
      // Generate credit note number
      const { count } = await supabase
        .from('credit_notes')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', currentOrganization!.id);
      
      const creditNoteNumber = `CN-${String((count || 0) + 1).padStart(5, '0')}`;
      
      // Calculate totals
      const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
      const taxAmount = input.lines.reduce((sum, line) => {
        const lineAmount = line.quantity * line.unit_price;
        return sum + (lineAmount * (line.tax_rate || 0) / 100);
      }, 0);
      const total = subtotal + taxAmount;

      const { data: creditNote, error: cnError } = await supabase
        .from('credit_notes')
        .insert({
          organization_id: currentOrganization!.id,
          customer_id: input.customer_id,
          invoice_id: input.invoice_id,
          credit_note_number: creditNoteNumber,
          credit_note_date: input.credit_note_date,
          reason: input.reason,
          notes: input.notes,
          subtotal,
          tax_amount: taxAmount,
          total,
          balance_remaining: total,
        })
        .select()
        .single();

      if (cnError) throw cnError;

      // Insert credit note lines
      const lines = input.lines.map((line, index) => ({
        credit_note_id: creditNote.id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate || 0,
        tax_amount: (line.quantity * line.unit_price) * (line.tax_rate || 0) / 100,
        amount: line.quantity * line.unit_price,
        line_order: index,
      }));

      const { error: linesError } = await supabase
        .from('credit_note_lines')
        .insert(lines);

      if (linesError) throw linesError;

      return creditNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
      toast.success('Credit note created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create credit note: ${error.message}`);
    },
  });

  const issueCreditNote = useMutation({
    mutationFn: async (creditNoteId: string) => {
      const { error } = await supabase
        .from('credit_notes')
        .update({
          status: 'issued',
          issued_at: new Date().toISOString(),
        })
        .eq('id', creditNoteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
      toast.success('Credit note issued');
    },
    onError: (error) => {
      toast.error(`Failed to issue credit note: ${error.message}`);
    },
  });

  const applyCreditNote = useMutation({
    mutationFn: async ({ creditNoteId, invoiceId, amount }: { creditNoteId: string; invoiceId: string; amount: number }) => {
      // Update credit note
      const { data: cn, error: cnError } = await supabase
        .from('credit_notes')
        .select('amount_applied, balance_remaining')
        .eq('id', creditNoteId)
        .single();

      if (cnError) throw cnError;

      const newApplied = Number(cn.amount_applied) + amount;
      const newBalance = Number(cn.balance_remaining) - amount;

      await supabase
        .from('credit_notes')
        .update({
          amount_applied: newApplied,
          balance_remaining: newBalance,
          status: newBalance <= 0 ? 'applied' : 'issued',
        })
        .eq('id', creditNoteId);

      // Update invoice balance
      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .select('balance_due, amount_paid')
        .eq('id', invoiceId)
        .single();

      if (invError) throw invError;

      const newBalanceDue = Number(invoice.balance_due) - amount;
      const newAmountPaid = Number(invoice.amount_paid) + amount;

      await supabase
        .from('invoices')
        .update({
          balance_due: newBalanceDue,
          amount_paid: newAmountPaid,
          status: newBalanceDue <= 0 ? 'paid' : 'partial',
        })
        .eq('id', invoiceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Credit note applied to invoice');
    },
    onError: (error) => {
      toast.error(`Failed to apply credit note: ${error.message}`);
    },
  });

  // Summary statistics
  const creditNotes = creditNotesQuery.data || [];
  const totalCreditNotes = creditNotes.length;
  const totalCreditValue = creditNotes.reduce((sum, cn) => sum + Number(cn.total), 0);
  const pendingCredits = creditNotes
    .filter(cn => cn.status === 'issued')
    .reduce((sum, cn) => sum + Number(cn.balance_remaining), 0);

  return {
    creditNotes,
    isLoading: creditNotesQuery.isLoading,
    error: creditNotesQuery.error,
    createCreditNote,
    issueCreditNote,
    applyCreditNote,
    totalCreditNotes,
    totalCreditValue,
    pendingCredits,
  };
}
