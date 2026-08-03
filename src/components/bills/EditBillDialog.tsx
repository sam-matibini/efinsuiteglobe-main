import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVendors } from '@/hooks/useVendors';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useAccounts } from '@/hooks/useAccounts';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { postBillToGL } from '@/lib/postBillToGL';
import { reverseLinkedJournalEntry, recalculateAndInvalidate } from '@/hooks/useGLPropagation';
import {
  BILL_PAYMENT_TERMS,
  CUSTOM_TERM_VALUE,
  computeDueDate,
  findPaymentTerm,
  getTermDays,
} from '@/lib/billPaymentTerms';

const lineSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  expense_account_id: z.string().min(1, 'Account is required'),
  quantity: z.coerce.number().min(0.01, 'Quantity must be positive'),
  unit_price: z.coerce.number().min(0, 'Price must be 0 or more'),
  tax_rate: z.coerce.number().min(0).max(100).optional(),
});

const billSchema = z.object({
  vendor_id: z.string().min(1, 'Vendor is required'),
  bill_number: z.string().min(1, 'Bill number is required'),
  bill_date: z.string().min(1, 'Bill date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  notes: z.string().optional(),
  terms: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'At least one line item is required'),
});

type BillFormData = z.infer<typeof billSchema>;

interface EditBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: any | null;
}

export function EditBillDialog({ open, onOpenChange, bill }: EditBillDialogProps) {
  const { vendors, isLoading: vendorsLoading } = useVendors();
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLines, setIsLoadingLines] = useState(false);
  const [isCustomTerm, setIsCustomTerm] = useState(false);

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(organization?.id);

  const accountOptions = accounts
    .filter(
      (a) =>
        a.is_active !== false &&
        !a.is_header &&
        a.posting_allowed !== false &&
        ['expense', 'cogs', 'other_expense', 'asset'].includes(a.account_type as string),
    )
    .map((a) => ({
      value: a.id,
      label: `${a.code} — ${a.name}`,
      triggerLabel: a.code,
      keywords: `${a.code} ${a.name}`,
    }));

  const form = useForm<BillFormData>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      vendor_id: '',
      bill_number: '',
      bill_date: '',
      due_date: '',
      notes: '',
      terms: '',
      lines: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  const amountPaid = Number(bill?.amount_paid || 0);

  // Load the bill header + lines whenever the dialog opens for a bill.
  useEffect(() => {
    if (!open || !bill?.id) return;
    let cancelled = false;
    setIsLoadingLines(true);

    (async () => {
      const { data, error } = await supabase
        .from('bill_lines')
        .select('*')
        .eq('bill_id', bill.id)
        .order('line_order', { ascending: true });

      if (cancelled) return;
      if (error) {
        toast.error('Failed to load bill lines: ' + error.message);
        setIsLoadingLines(false);
        return;
      }

      form.reset({
        vendor_id: bill.vendor_id ?? '',
        bill_number: bill.bill_number ?? '',
        bill_date: bill.bill_date ?? '',
        due_date: bill.due_date ?? '',
        notes: bill.notes ?? '',
        terms: bill.terms ?? '',
        lines:
          (data ?? []).length > 0
            ? (data ?? []).map((l: any) => ({
                description: l.description ?? '',
                expense_account_id: l.expense_account_id ?? '',
                quantity: Number(l.quantity) || 1,
                unit_price: Number(l.unit_price) || 0,
                tax_rate: Number(l.tax_rate) || 0,
              }))
            : [
                {
                  description: bill.bill_number ? `Bill ${bill.bill_number}` : '',
                  expense_account_id: '',
                  quantity: 1,
                  unit_price: Number(bill.subtotal) || 0,
                  tax_rate: 0,
                },
              ],
      });
      setIsLoadingLines(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bill?.id]);

  const watchedLines = form.watch('lines') || [];

  const subtotal = watchedLines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0),
    0,
  );
  const taxTotal = watchedLines.reduce((sum, line) => {
    const amount = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
    return sum + amount * ((Number(line.tax_rate) || 0) / 100);
  }, 0);
  const total = subtotal + taxTotal;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: bill?.currency || localization.currency,
    }).format(value);

  const onSubmit = async (data: BillFormData) => {
    if (!organization?.id || !bill?.id) return;

    if (total + 0.005 < amountPaid) {
      toast.error(
        `The new total (${formatCurrency(total)}) is less than the amount already paid (${formatCurrency(
          amountPaid,
        )}). Reverse the payment first.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update the bill header.
      const balanceDue = Math.max(0, total - amountPaid);
      const { error: headerErr } = await supabase
        .from('bills')
        .update({
          vendor_id: data.vendor_id,
          bill_number: data.bill_number,
          bill_date: data.bill_date,
          due_date: data.due_date,
          subtotal,
          tax_amount: taxTotal,
          total,
          balance_due: balanceDue,
          notes: data.notes || null,
          terms: data.terms || null,
        })
        .eq('id', bill.id);
      if (headerErr) throw headerErr;

      // 2. Replace the bill lines.
      const { error: delErr } = await supabase.from('bill_lines').delete().eq('bill_id', bill.id);
      if (delErr) throw delErr;

      const { error: insErr } = await supabase.from('bill_lines').insert(
        data.lines.map((line, idx) => ({
          bill_id: bill.id,
          description: line.description,
          expense_account_id: line.expense_account_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
          amount: line.quantity * line.unit_price,
          tax_rate: line.tax_rate || 0,
          tax_amount: line.quantity * line.unit_price * ((line.tax_rate || 0) / 100),
          line_order: idx,
        })),
      );
      if (insErr) throw insErr;

      // 3. Reverse the previously posted journal entry (audit-safe) and re-post.
      if (bill.journal_entry_id) {
        await reverseLinkedJournalEntry({
          journalEntryId: bill.journal_entry_id,
          organizationId: organization.id,
        });
        await supabase.from('bills').update({ journal_entry_id: null }).eq('id', bill.id);
      }

      await postBillToGL({
        organizationId: organization.id,
        billId: bill.id,
        billNumber: data.bill_number,
        billDate: data.bill_date,
        vendorId: data.vendor_id,
        taxAmount: taxTotal,
        total,
        departmentId: bill.department_id ?? null,
        lines: data.lines.map((line) => ({
          account_id: line.expense_account_id,
          amount: line.quantity * line.unit_price,
          description: line.description,
        })),
      });

      await recalculateAndInvalidate(organization.id, queryClient);
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['bill-lines', bill.id] });
      toast.success('Bill updated and re-posted to the General Ledger');
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to update bill: ' + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!bill) return null;

  const locked = bill.status === 'paid' || bill.status === 'void';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Bill {bill.bill_number}</DialogTitle>
          <DialogDescription>
            Saving reverses the original journal entry and re-posts a corrected one, so the GL,
            Trial Balance and financial statements stay accurate.
          </DialogDescription>
        </DialogHeader>

        {locked ? (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
            <p>
              This bill is <span className="font-medium capitalize">{bill.status}</span> and can no
              longer be edited. Reverse the payment or create a new bill instead.
            </p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {amountPaid > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <p>
                    {formatCurrency(amountPaid)} has already been paid on this bill. The new total
                    must be at least that amount.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="vendor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vendorsLoading ? (
                            <SelectItem value="__loading__" disabled>
                              Loading...
                            </SelectItem>
                          ) : (
                            vendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bill_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Vendor's invoice number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bill_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            const days = getTermDays(form.getValues('terms'));
                            if (days !== null && e.target.value) {
                              form.setValue('due_date', computeDueDate(e.target.value, days));
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terms</FormLabel>
                      <Select
                        value={isCustomTerm ? CUSTOM_TERM_VALUE : field.value || ''}
                        onValueChange={(value) => {
                          if (value === CUSTOM_TERM_VALUE) {
                            setIsCustomTerm(true);
                            field.onChange('');
                            return;
                          }
                          setIsCustomTerm(false);
                          field.onChange(value);
                          const days = getTermDays(value);
                          if (days !== null) {
                            form.setValue(
                              'due_date',
                              computeDueDate(form.getValues('bill_date'), days),
                            );
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select terms" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BILL_PAYMENT_TERMS.map((term) => (
                            <SelectItem key={term.label} value={term.label}>
                              {term.label}
                            </SelectItem>
                          ))}
                          <SelectItem value={CUSTOM_TERM_VALUE}>Custom…</SelectItem>
                        </SelectContent>
                      </Select>
                      {isCustomTerm && (
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            className="mt-2"
                            placeholder="e.g. 2/10 Net 30"
                          />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel>Line Items</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({
                        description: '',
                        expense_account_id:
                          form.getValues('lines')?.[fields.length - 1]?.expense_account_id || '',
                        quantity: 1,
                        unit_price: 0,
                        tax_rate: 0,
                      })
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Line
                  </Button>
                </div>

                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-muted/50">
                      <tr className="whitespace-nowrap">
                        <th className="text-left p-3 min-w-[220px]">Description</th>
                        <th className="text-left p-3 w-40">Account</th>
                        <th className="text-right p-3 w-20">Qty</th>
                        <th className="text-right p-3 w-24">Price</th>
                        <th className="text-right p-3 w-20">Tax %</th>
                        <th className="text-right p-3 w-28">Amount</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingLines ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-muted-foreground">
                            Loading line items...
                          </td>
                        </tr>
                      ) : (
                        fields.map((field, index) => {
                          const qty = Number(watchedLines[index]?.quantity) || 0;
                          const price = Number(watchedLines[index]?.unit_price) || 0;
                          return (
                            <tr key={field.id} className="border-t">
                              <td className="p-2">
                                <Input
                                  {...form.register(`lines.${index}.description`)}
                                  placeholder="Description"
                                  className="border-0 bg-transparent"
                                />
                              </td>
                              <td className="p-2">
                                <FormField
                                  control={form.control}
                                  name={`lines.${index}.expense_account_id`}
                                  render={({ field: accField }) => (
                                    <FormItem className="space-y-0">
                                      <SearchableSelect
                                        value={accField.value}
                                        onValueChange={accField.onChange}
                                        options={accountOptions}
                                        placeholder={accountsLoading ? 'Loading...' : 'Select account'}
                                        searchPlaceholder="Search chart of accounts..."
                                        emptyText="No postable accounts found."
                                        className="h-9 font-mono text-xs"
                                      />
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  {...form.register(`lines.${index}.quantity`)}
                                  className="border-0 bg-transparent text-right"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  {...form.register(`lines.${index}.unit_price`)}
                                  className="border-0 bg-transparent text-right"
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  {...form.register(`lines.${index}.tax_rate`)}
                                  className="border-0 bg-transparent text-right w-full px-1"
                                />
                              </td>
                              <td className="p-2 text-right font-mono">
                                {formatCurrency(qty * price)}
                              </td>
                              <td className="p-2">
                                {fields.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => remove(index)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {form.formState.errors.lines && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.lines.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-mono">{formatCurrency(taxTotal)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total</span>
                    <span className="font-mono">{formatCurrency(total)}</span>
                  </div>
                  {amountPaid > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Balance Due</span>
                      <span className="font-mono">
                        {formatCurrency(Math.max(0, total - amountPaid))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional notes..." rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || isLoadingLines}>
                  {isSubmitting ? 'Saving...' : 'Save & Re-post'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
