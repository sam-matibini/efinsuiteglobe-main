import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { addDays, format } from 'date-fns';
import { createJournalEntry, getDefaultAccounts, getTaxGlAccounts } from './useJournalEntryCreation';
import { recordInvoiceTaxes } from '@/lib/ngTax/integration';
import { computeDocumentTaxes, persistInvoiceTaxes } from '@/lib/documentTaxEngine';
import type { SalesTaxSettings } from './useSalesTax';

export interface Invoice {
  id: string;
  organization_id: string;
  customer_id: string;
  invoice_number: string;
  status: 'draft' | 'issued' | 'final' | 'sent' | 'paid' | 'overdue' | 'void' | 'partial';
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  gst_hst_amount: number | null;
  pst_amount: number | null;
  total: number;
  amount_paid: number;
  balance_due: number;
  currency: string;
  notes: string | null;
  terms: string | null;
  ar_account_id: string | null;
  journal_entry_id: string | null;
  sent_at: string | null;
  paid_at: string | null;
  issued_at: string | null;
  document_title: string | null;
  // Seller contact (from organization)
  seller_email: string | null;
  seller_phone: string | null;
  // Tax registration numbers
  dealer_permit_number: string | null;
  gst_hst_number: string | null;
  pst_number: string | null;
  // Tax exemptions
  is_gst_hst_exempt: boolean;
  is_pst_exempt: boolean;
  tax_exemption_certificate: string | null;
  exemption_reason: string | null;
  // Buyer details
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_address_line1: string | null;
  buyer_address_line2: string | null;
  buyer_city: string | null;
  buyer_province: string | null;
  buyer_postal_code: string | null;
  buyer_country: string | null;
  attention_of: string | null;
  // Custom fields for Bill of Sale (stored as JSON in DB)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  custom_fields: any;
  // Signatures
  seller_signature_id: string | null;
  buyer_signature_data: string | null;
  buyer_signature_date: string | null;
  // Soft delete
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    name: string;
    email: string | null;
  };
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_rate: number | null;
  tax_amount: number | null;
  income_account_id: string | null;
  line_order: number;
  notes: string | null;
}

export interface CreateInvoiceInput {
  customer_id: string;
  invoice_date?: string;
  due_date?: string;
  notes?: string;
  terms?: string;
  document_title?: string;
  // Buyer info (for Bill of Sale)
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_address_line1?: string;
  buyer_address_line2?: string;
  buyer_city?: string;
  buyer_province?: string;
  buyer_postal_code?: string;
  buyer_country?: string;
  // Tax registration (from org or override)
  dealer_permit_number?: string;
  gst_hst_number?: string;
  pst_number?: string;
  // Tax exemptions
  is_gst_hst_exempt?: boolean;
  is_pst_exempt?: boolean;
  exemption_reason?: string;
  // Attention of / contact person
  attention_of?: string;
  // Custom fields (for vehicle details etc.)
  custom_fields?: { id: string; label: string; value: string; type: 'text' | 'number' | 'date' }[];
  // Seller info
  seller_email?: string;
  seller_phone?: string;
  // New Zoho-style fields
  order_number?: string;
  subject?: string;
  discount_type?: string;
  discount_value?: number;
  shipping_charges?: number;
  adjustment?: number;
  adjustment_label?: string;
  department_id?: string | null;
  lines: {
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate?: number;
    income_account_id?: string;
    notes?: string;
  }[];
}

/**
 * Build a short, unique reference customers quote on Wise transfers.
 * Format: <invoice number, alphanumeric>-<4 random chars>
 */
function buildWisePaymentReference(invoiceNumber: string): string {
  const base = (invoiceNumber || 'INV').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-12);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

export function useInvoices() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ['invoices', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, name, email)
        `)
        .eq('organization_id', organization.id)
        .is('deleted_at', null)
        .order('invoice_date', { ascending: false });
      
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!organization?.id,
  });

  const generateInvoiceNumber = async (): Promise<string> => {
    if (!organization?.id) return 'INV-0001';
    
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!data || data.length === 0) return 'INV-0001';
    
    const lastNumber = data[0].invoice_number;
    const match = lastNumber.match(/(\d+)$/);
    if (!match) return 'INV-0001';
    
    const nextNum = parseInt(match[1], 10) + 1;
    return `INV-${String(nextNum).padStart(4, '0')}`;
  };

  const createInvoice = useMutation({
    mutationFn: async (input: CreateInvoiceInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const invoiceNumber = await generateInvoiceNumber();
      const invoiceDate = input.invoice_date || format(new Date(), 'yyyy-MM-dd');
      const dueDate = input.due_date || format(addDays(new Date(), 30), 'yyyy-MM-dd');
      
      // Calculate totals with split tax tracking
      let subtotal = 0;
      let gstHstAmount = 0;
      let pstAmount = 0;
      
      const lines = input.lines.map((line, idx) => {
        const amount = line.quantity * line.unit_price;
        const taxRate = line.tax_rate || 0;
        const lineTax = amount * (taxRate / 100);
        subtotal += amount;
        // Track all per-line tax as GST/HST (since per-line rates represent the applicable tax)
        gstHstAmount += lineTax;
        
        return {
          ...line,
          amount,
          tax_amount: lineTax,
          line_order: idx,
          notes: line.notes || null,
        };
      });
      
      const taxAmount = gstHstAmount + pstAmount;
      const total = subtotal + taxAmount;
      
      // Create invoice with all Bill of Sale fields
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          organization_id: organization.id,
          customer_id: input.customer_id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          subtotal,
          tax_amount: taxAmount,
          gst_hst_amount: gstHstAmount,
          pst_amount: pstAmount,
          total,
          balance_due: total,
          notes: input.notes || null,
          terms: input.terms || null,
          document_title: input.document_title || 'Invoice',
          // Buyer info
          buyer_name: input.buyer_name || null,
          buyer_email: input.buyer_email || null,
          buyer_phone: input.buyer_phone || null,
          buyer_address_line1: input.buyer_address_line1 || null,
          buyer_address_line2: input.buyer_address_line2 || null,
          buyer_city: input.buyer_city || null,
          buyer_province: input.buyer_province || null,
          buyer_postal_code: input.buyer_postal_code || null,
          buyer_country: input.buyer_country || null,
          // Tax registration
          dealer_permit_number: input.dealer_permit_number || null,
          gst_hst_number: input.gst_hst_number || null,
          pst_number: input.pst_number || null,
          // Tax exemptions
          is_gst_hst_exempt: input.is_gst_hst_exempt || false,
          is_pst_exempt: input.is_pst_exempt || false,
          exemption_reason: input.exemption_reason || null,
          // Custom fields (stored as JSONB)
          custom_fields: input.custom_fields || [],
          // Attention of
          attention_of: input.attention_of || null,
          // Seller info
          seller_email: input.seller_email || null,
          seller_phone: input.seller_phone || null,
          // New Zoho-style fields
          order_number: input.order_number || null,
          subject: input.subject || null,
          discount_type: input.discount_type || 'percentage',
          discount_value: input.discount_value || 0,
          shipping_charges: input.shipping_charges || 0,
          adjustment: input.adjustment || 0,
          adjustment_label: input.adjustment_label || 'Adjustment',
          // Default to issued status
          status: 'issued',
          issued_at: new Date().toISOString(),
          department_id: input.department_id || null,
          // Unique reference used to auto-match incoming Wise bank transfers
          wise_payment_reference: buildWisePaymentReference(invoiceNumber),
        }])
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;
      
      // Create invoice lines
      const { data: insertedLines, error: linesError } = await supabase
        .from('invoice_lines')
        .insert(
          lines.map(line => ({
            invoice_id: invoice.id,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            amount: line.amount,
            tax_rate: line.tax_rate || 0,
            tax_amount: line.tax_amount || 0,
            income_account_id: line.income_account_id || null,
            line_order: line.line_order,
            notes: (line as any).notes || null,
          }))
        )
        .select('id, amount, tax_rate');
      
      if (linesError) throw linesError;

      try {
        const { data: taxSettings } = await supabase
          .from('sales_tax_settings')
          .select('*')
          .eq('organization_id', organization.id)
          .maybeSingle();
        const jurisdiction = input.buyer_province || organization.province || taxSettings?.province || null;
        const split = computeDocumentTaxes({
          countryCode: organization.country,
          jurisdictionCode: jurisdiction,
          amount: subtotal,
          direction: 'collected',
          settings: taxSettings as SalesTaxSettings | null,
        });
        const blended = computeDocumentTaxes({
          countryCode: organization.country,
          jurisdictionCode: jurisdiction,
          amount: subtotal,
          direction: 'collected',
          settings: taxSettings as SalesTaxSettings | null,
          taxRateOverride: subtotal > 0 ? (taxAmount / subtotal) * 100 : 0,
        });
        const taxes =
          Math.abs(split.totalTax - taxAmount) <= 0.05 ? split.taxes : blended.taxes;
        await persistInvoiceTaxes(invoice.id, taxes);
      } catch (taxErr) {
        console.warn('Could not persist invoice_taxes:', taxErr);
      }

      // Create journal entry for the invoice with source document tracking
      // Debit: Accounts Receivable
      // Credit: Sales Revenue + Sales Tax Payable
      let journalEntryId: string | null = null;
      try {
        const [defaultAccounts, taxGl] = await Promise.all([
          getDefaultAccounts(organization.id),
          getTaxGlAccounts(organization.id),
        ]);

        if (defaultAccounts.ar && defaultAccounts.salesRevenue) {
          const baseDimensions = {
            customer_id: input.customer_id,
            source_document_type: 'invoice',
            source_document_id: invoice.id,
          };

          const journalLines = [
            { 
              account_id: defaultAccounts.ar.id, 
              debit: total, 
              credit: 0, 
              memo: `Invoice ${invoiceNumber}`,
              ...baseDimensions,
            },
            { 
              account_id: defaultAccounts.salesRevenue.id, 
              debit: 0, 
              credit: subtotal, 
              memo: `Sales - Invoice ${invoiceNumber}`,
              ...baseDimensions,
            },
          ];

          // Add tax liability line if there's tax.
          // Prefer the explicit GST/HST Collected GL configured in sales_tax_settings;
          // only fall back to keyword-guessed defaultAccounts.salesTax if no mapping exists.
          const salesTaxAccountId =
            taxGl.gstCollectedAccountId ?? defaultAccounts.salesTax?.id ?? null;
          if (taxAmount > 0 && salesTaxAccountId) {
            journalLines.push({
              account_id: salesTaxAccountId,
              debit: 0,
              credit: taxAmount,
              memo: `Tax - Invoice ${invoiceNumber}`,
              ...baseDimensions,
            });
          } else if (taxAmount > 0) {
            console.warn(
              `Invoice ${invoiceNumber}: tax of ${taxAmount} not posted — no GST/HST Collected GL configured in Sales Tax Settings.`,
            );
          }
          
          journalEntryId = await createJournalEntry({
            organizationId: organization.id,
            date: invoiceDate,
            description: `Invoice ${invoiceNumber} created`,
            reference: `INV-${invoiceNumber}`,
            journalType: 'sales',
            departmentId: input.department_id || null,
            lines: journalLines,
          });

          // Update invoice with journal entry ID
          await supabase
            .from('invoices')
            .update({ journal_entry_id: journalEntryId })
            .eq('id', invoice.id);
        }
      } catch (jeError) {
        console.warn('Could not create journal entry for invoice:', jeError);
      }

      // NG Tax Engine — record VAT/output taxes into the ledger (no-op for non-NG orgs)
      try {
        await recordInvoiceTaxes({
          organization_id: organization.id,
          invoice_id: invoice.id,
          invoice_date: invoiceDate,
          journal_entry_id: journalEntryId,
          lines: (insertedLines ?? []).map((l: any) => ({
            id: l.id,
            taxable_amount: Number(l.amount) || 0,
            vat_exempt: (Number(l.tax_rate) || 0) === 0,
          })),
        });
      } catch (ngErr) {
        console.warn('NG tax ledger write skipped:', ngErr);
      }
      
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['ar_aging'] });
      queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
      toast.success('Invoice created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create invoice: ' + error.message);
    },
  });

  const updateInvoiceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Invoice['status'] }) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      // Fetch the current invoice to check if it needs a journal entry
      const { data: currentInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*, invoice_lines(*)')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      const updates: Partial<Invoice> = { status };
      
      // Ensure a Wise transfer reference exists before the invoice reaches a customer
      if (!currentInvoice.wise_payment_reference) {
        (updates as Record<string, unknown>).wise_payment_reference = buildWisePaymentReference(
          currentInvoice.invoice_number,
        );
      }

      if (status === 'sent') {
        updates.sent_at = new Date().toISOString();
      } else if (status === 'paid') {
        updates.paid_at = new Date().toISOString();
      }
      
      // When transitioning to 'issued' or 'final', set issued_at and ensure journal entry exists
      if ((status === 'issued' || status === 'final') && !currentInvoice.issued_at) {
        updates.issued_at = new Date().toISOString();
      }
      
      // Create journal entry if transitioning to a posting status and no JE exists
      if (['issued', 'final', 'sent'].includes(status) && !currentInvoice.journal_entry_id) {
        try {
          const [defaultAccounts, taxGl] = await Promise.all([
            getDefaultAccounts(organization.id),
            getTaxGlAccounts(organization.id),
          ]);

          if (defaultAccounts.ar && defaultAccounts.salesRevenue) {
            const baseDimensions = {
              customer_id: currentInvoice.customer_id,
              source_document_type: 'invoice',
              source_document_id: currentInvoice.id,
            };

            const journalLines = [
              { 
                account_id: defaultAccounts.ar.id, 
                debit: Number(currentInvoice.total), 
                credit: 0, 
                memo: `Invoice ${currentInvoice.invoice_number}`,
                ...baseDimensions,
              },
              { 
                account_id: defaultAccounts.salesRevenue.id, 
                debit: 0, 
                credit: Number(currentInvoice.subtotal), 
                memo: `Sales - Invoice ${currentInvoice.invoice_number}`,
                ...baseDimensions,
              },
            ];

            // Add tax liability line if there's tax — explicit GL mapping first.
            const taxAmount = Number(currentInvoice.tax_amount) || 0;
            const salesTaxAccountId =
              taxGl.gstCollectedAccountId ?? defaultAccounts.salesTax?.id ?? null;
            if (taxAmount > 0 && salesTaxAccountId) {
              journalLines.push({
                account_id: salesTaxAccountId,
                debit: 0,
                credit: taxAmount,
                memo: `Tax - Invoice ${currentInvoice.invoice_number}`,
                ...baseDimensions,
              });
            } else if (taxAmount > 0) {
              console.warn(
                `Invoice ${currentInvoice.invoice_number}: tax of ${taxAmount} not posted — no GST/HST Collected GL configured in Sales Tax Settings.`,
              );
            }
            
            const journalEntryId = await createJournalEntry({
              organizationId: organization.id,
              date: currentInvoice.invoice_date,
              description: `Invoice ${currentInvoice.invoice_number} posted`,
              reference: `INV-${currentInvoice.invoice_number}`,
              journalType: 'sales',
              departmentId: (currentInvoice as any).department_id || null,
              lines: journalLines,
            });

            updates.journal_entry_id = journalEntryId;
          } else {
            console.warn('Could not create journal entry: Missing AR or Sales Revenue account');
          }
        } catch (jeError) {
          console.error('Could not create journal entry for invoice:', jeError);
          // Don't block status update, but log the error
        }
      }
      
      const { data, error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['ar_aging'] });
      queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
      toast.success('Invoice status updated');
    },
    onError: (error) => {
      toast.error('Failed to update invoice: ' + error.message);
    },
  });

  const voidInvoice = useMutation({
    mutationFn: async (id: string) => {
      // Fetch the invoice to get journal_entry_id for reversal
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*, journal_entry_lines:journal_entries!journal_entry_id(id, reference, entry_date, description, lines:journal_entry_lines(account_id, description, debit, credit))')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;

      // Reverse the journal entry if one exists — fail visibly if reversal can't be created
      if (invoice.journal_entry_id) {
        const jeData = invoice.journal_entry_lines;
        let lines = jeData?.lines;

        // Fallback: if join didn't return lines, fetch them directly
        if (!lines || lines.length === 0) {
          const { data: directLines, error: directErr } = await supabase
            .from('journal_entry_lines')
            .select('account_id, description, debit, credit')
            .eq('journal_entry_id', invoice.journal_entry_id);
          if (directErr) throw new Error(`Failed to fetch JE lines for reversal: ${directErr.message}`);
          lines = directLines;
        }

        if (!lines || lines.length === 0) {
          throw new Error('Cannot void invoice: journal entry has no lines to reverse');
        }

        const userId = (await supabase.auth.getUser()).data.user?.id || '';
        const reversalRef = `REV-${jeData?.reference || invoice.journal_entry_id}`;

        const { data: reversalEntry, error: revError } = await supabase
          .from('journal_entries')
          .insert({
            organization_id: organization!.id,
            reference: reversalRef,
            entry_date: jeData.entry_date,
            description: `Reversal of ${jeData?.reference || 'JE'}: Invoice voided`,
            notes: `Auto-reversal: Invoice ${id} voided`,
            created_by: userId,
            status: 'posted',
            posted_by: userId,
            posted_at: new Date().toISOString(),
            reversal_of: invoice.journal_entry_id,
          })
          .select()
          .single();

        if (revError) throw new Error(`Failed to create reversal entry: ${revError.message}`);

        const reversedLines = lines.map((line: any, index: number) => ({
          journal_entry_id: reversalEntry.id,
          account_id: line.account_id,
          description: line.description || null,
          debit: Number(line.credit) || 0,
          credit: Number(line.debit) || 0,
          line_order: index,
        }));

        const { error: linesError } = await supabase.from('journal_entry_lines').insert(reversedLines);
        if (linesError) throw new Error(`Failed to insert reversal lines: ${linesError.message}`);

        // Mark original as reversed
        const { error: updateErr } = await supabase
          .from('journal_entries')
          .update({ status: 'reversed', reversed_by: userId, reversed_at: new Date().toISOString() })
          .eq('id', invoice.journal_entry_id);
        if (updateErr) throw new Error(`Failed to mark original JE as reversed: ${updateErr.message}`);
      }

      const { data, error } = await supabase
        .from('invoices')
        .update({ status: 'void' })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['ar_aging'] });
      queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
      toast.success('Invoice voided');
    },
    onError: (error) => {
      toast.error('Failed to void invoice: ' + error.message);
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      // Get the invoice with journal entry info
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('status, journal_entry_id')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Only allow deletion of void or issued invoices
      if (!['void', 'issued'].includes(invoice.status)) {
        throw new Error('Only voided or issued invoices can be deleted');
      }

      // Reverse journal entry if exists and not already reversed (for 'issued' invoices)
      if (invoice.journal_entry_id && invoice.status === 'issued') {
        try {
          const { data: je } = await supabase
            .from('journal_entries')
            .select('id, reference, entry_date, description, status, lines:journal_entry_lines(account_id, description, debit, credit)')
            .eq('id', invoice.journal_entry_id)
            .single();

          if (je && je.status === 'posted' && je.lines && je.lines.length > 0) {
            const userId = (await supabase.auth.getUser()).data.user?.id || '';
            const reversalRef = `REV-${je.reference}`;

            const { data: reversalEntry, error: revError } = await supabase
              .from('journal_entries')
              .insert({
                organization_id: organization!.id,
                reference: reversalRef,
                entry_date: je.entry_date,
                description: `Reversal of ${je.reference}: Invoice deleted`,
                notes: `Auto-reversal: Invoice ${id} deleted`,
                created_by: userId,
                status: 'posted',
                posted_by: userId,
                posted_at: new Date().toISOString(),
                reversal_of: invoice.journal_entry_id,
              })
              .select()
              .single();

            if (!revError && reversalEntry) {
              const reversedLines = je.lines.map((line: any, index: number) => ({
                journal_entry_id: reversalEntry.id,
                account_id: line.account_id,
                description: line.description || null,
                debit: Number(line.credit) || 0,
                credit: Number(line.debit) || 0,
                line_order: index,
              }));

              await supabase.from('journal_entry_lines').insert(reversedLines);

              await supabase
                .from('journal_entries')
                .update({ status: 'reversed', reversed_by: userId, reversed_at: new Date().toISOString() })
                .eq('id', invoice.journal_entry_id);
            }
          }
        } catch (revErr) {
          console.error('Failed to reverse journal entry on delete:', revErr);
        }
      }

      // Soft delete
      const { data, error } = await supabase
        .from('invoices')
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: (await supabase.auth.getUser()).data.user?.id 
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['ar_aging'] });
      queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
      toast.success('Invoice deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete invoice: ' + error.message);
    },
  });

  // Calculate summary stats
  const totalOutstanding = invoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'void')
    .reduce((sum, inv) => sum + Number(inv.balance_due), 0);

  const overdueAmount = invoices
    .filter(inv => inv.status === 'overdue')
    .reduce((sum, inv) => sum + Number(inv.balance_due), 0);

  const paidThisMonth = invoices
    .filter(inv => {
      if (inv.status !== 'paid' || !inv.paid_at) return false;
      const paidDate = new Date(inv.paid_at);
      const now = new Date();
      return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, inv) => sum + Number(inv.total), 0);

  return {
    invoices,
    isLoading,
    error,
    totalOutstanding,
    overdueAmount,
    paidThisMonth,
    createInvoice,
    updateInvoiceStatus,
    voidInvoice,
    deleteInvoice,
  };
}

export function useInvoiceLines(invoiceId?: string) {
  const { data: lines = [], isLoading, error } = useQuery({
    queryKey: ['invoice-lines', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return [];
      
      const { data, error } = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('line_order');
      
      if (error) throw error;
      return data as InvoiceLine[];
    },
    enabled: !!invoiceId,
  });

  return { lines, isLoading, error };
}
