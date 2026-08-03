import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
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
import { format, addDays } from 'date-fns';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { recordBillTaxes } from '@/lib/ngTax/integration';
import { postBillToGL } from '@/lib/postBillToGL';


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

interface CreateBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBillDialog({ open, onOpenChange }: CreateBillDialogProps) {
  const { vendors, isLoading: vendorsLoading } = useVendors();
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(organization?.id);

  // Postable expense / COGS / asset accounts from the Chart of Accounts.
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
      keywords: `${a.code} ${a.name}`,
    }));

  const form = useForm<BillFormData>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      vendor_id: '',
      bill_number: '',
      bill_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      notes: '',
      terms: 'Net 30',
      lines: [{ description: '', expense_account_id: '', quantity: 1, unit_price: 0, tax_rate: 13 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines',
  });


  const watchedLines = form.watch('lines');
  
  const subtotal = watchedLines.reduce((sum, line) => {
    return sum + (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
  }, 0);

  const taxTotal = watchedLines.reduce((sum, line) => {
    const amount = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
    return sum + amount * ((Number(line.tax_rate) || 0) / 100);
  }, 0);

  const total = subtotal + taxTotal;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  const onSubmit = async (data: BillFormData) => {
    if (!organization?.id) return;
    setIsSubmitting(true);
    
    try {
      // Create bill
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .insert({
          organization_id: organization.id,
          vendor_id: data.vendor_id,
          bill_number: data.bill_number,
          bill_date: data.bill_date,
          due_date: data.due_date,
          subtotal,
          tax_amount: taxTotal,
          total,
          balance_due: total,
          notes: data.notes || null,
          terms: data.terms || null,
        })
        .select()
        .single();

      if (billError) throw billError;

      // Create bill lines
      const { data: insertedBillLines, error: linesError } = await supabase
        .from('bill_lines')
        .insert(
          data.lines.map((line, idx) => ({
            bill_id: bill.id,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            amount: line.quantity * line.unit_price,
            tax_rate: line.tax_rate || 0,
            tax_amount: (line.quantity * line.unit_price) * ((line.tax_rate || 0) / 100),
            line_order: idx,
          }))
        )
        .select('id, amount, tax_amount');

      if (linesError) throw linesError;

      // NG Tax Engine — record WHT + input VAT (no-op for non-NG orgs)
      try {
        await recordBillTaxes({
          organization_id: organization.id,
          bill_id: bill.id,
          bill_date: data.bill_date,
          journal_entry_id: null,
          lines: (insertedBillLines ?? []).map((l: any) => ({
            id: l.id,
            taxable_amount: Number(l.amount) || 0,
            vat_input_amount: Number(l.tax_amount) || 0,
          })),
        });
      } catch (ngErr) {
        console.warn('NG tax ledger write skipped:', ngErr);
      }


      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast.success('Bill created successfully');
      form.reset();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to create bill: ' + message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Bill</DialogTitle>
          <DialogDescription>
            Record a new bill from a vendor.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
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
                          <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                        ) : vendors.length === 0 ? (
                          <SelectItem value="__empty__" disabled>No vendors found</SelectItem>
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
                      <Input type="date" {...field} />
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
                    <FormControl>
                      <Input {...field} placeholder="Net 30" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Line Items</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ description: '', quantity: 1, unit_price: 0, tax_rate: 13 })}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Line
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3">Description</th>
                      <th className="text-left p-3 w-56">Account</th>
                      <th className="text-right p-3 w-20">Qty</th>
                      <th className="text-right p-3 w-28">Price</th>
                      <th className="text-right p-3 w-20">Tax %</th>
                      <th className="text-right p-3 w-28">Amount</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const qty = Number(watchedLines[index]?.quantity) || 0;
                      const price = Number(watchedLines[index]?.unit_price) || 0;
                      const amount = qty * price;

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
                                    className="h-9"
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
                              className="border-0 bg-transparent text-right"
                            />
                          </td>

                          <td className="p-2 text-right font-mono">
                            {formatCurrency(amount)}
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
                    })}
                  </tbody>
                </table>
              </div>
              {form.formState.errors.lines && (
                <p className="text-sm text-destructive">{form.formState.errors.lines.message}</p>
              )}
            </div>

            {/* Totals */}
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Bill'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
