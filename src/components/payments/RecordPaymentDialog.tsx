import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useCustomers } from '@/hooks/useCustomers';
import { useInvoices } from '@/hooks/useInvoices';
import { useCustomerPayments } from '@/hooks/useCustomerPayments';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { DivisionSelect } from '@/components/dimensions/DivisionSelect';
import { format } from 'date-fns';

const paymentSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  invoice_id: z.string().optional(),
  payment_date: z.string().min(1, 'Payment date is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  payment_method: z.string().min(1, 'Payment method is required'),
  bank_account_id: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  department_id: z.string().nullable().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedInvoiceId?: string;
  preselectedCustomerId?: string;
}

export function RecordPaymentDialog({ 
  open, 
  onOpenChange,
  preselectedInvoiceId,
  preselectedCustomerId,
}: RecordPaymentDialogProps) {
  const { customers, isLoading: customersLoading } = useCustomers();
  const { invoices } = useInvoices();
  const { createPayment } = useCustomerPayments();
  const { accounts: bankAccounts } = useBankAccounts();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      customer_id: preselectedCustomerId || '',
      invoice_id: preselectedInvoiceId || '',
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      payment_method: 'bank_transfer',
      bank_account_id: '',
      reference: '',
      notes: '',
    },
  });

  const selectedCustomerId = form.watch('customer_id');
  const selectedInvoiceId = form.watch('invoice_id');

  // Filter invoices by selected customer
  const customerInvoices = invoices.filter(
    inv => inv.customer_id === selectedCustomerId && 
    inv.status !== 'paid' && 
    inv.status !== 'void'
  );

  // Auto-fill amount when invoice is selected
  useEffect(() => {
    if (selectedInvoiceId) {
      const invoice = invoices.find(inv => inv.id === selectedInvoiceId);
      if (invoice) {
        form.setValue('amount', Number(invoice.balance_due));
      }
    }
  }, [selectedInvoiceId, invoices, form]);

  // Reset invoice when customer changes
  useEffect(() => {
    if (!preselectedInvoiceId) {
      form.setValue('invoice_id', '');
    }
  }, [selectedCustomerId, form, preselectedInvoiceId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(value);
  };

  const onSubmit = async (data: PaymentFormData) => {
    setIsSubmitting(true);
    try {
      await createPayment.mutateAsync({
        customer_id: data.customer_id,
        invoice_id: data.invoice_id || undefined,
        payment_date: data.payment_date,
        amount: data.amount,
        payment_method: data.payment_method,
        bank_account_id: data.bank_account_id || undefined,
        reference: data.reference,
        notes: data.notes,
        department_id: data.department_id || null,
      });
      form.reset();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const paymentMethods = [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'e_transfer', label: 'E-Transfer' },
    { value: 'interac_etransfer', label: 'Interac e-Transfer' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'cash', label: 'Cash' },
    { value: 'wire', label: 'Wire Transfer' },
    { value: 'eft', label: 'EFT (Electronic Funds Transfer)' },
    { value: 'ach', label: 'ACH (Direct Debit)' },
  ];

  // Helper to convert sentinel value to empty string
  const handleOptionalSelectChange = (value: string, onChange: (val: string) => void) => {
    onChange(value === 'none' ? '' : value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment received from a customer.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customersLoading ? (
                        <SelectItem value="__loading__" disabled>Loading...</SelectItem>
                      ) : (
                        customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
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
              name="invoice_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apply to Invoice (Optional)</FormLabel>
                  <Select 
                    onValueChange={(val) => handleOptionalSelectChange(val, field.onChange)} 
                    value={field.value || 'none'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select invoice" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No specific invoice</SelectItem>
                      {customerInvoices.map((invoice) => (
                        <SelectItem key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number} - {formatCurrency(Number(invoice.balance_due))} due
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.value} value={method.value}>
                            {method.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bank_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deposit To (Optional)</FormLabel>
                    <Select 
                      onValueChange={(val) => handleOptionalSelectChange(val, field.onChange)} 
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        {bankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference Number (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Cheque #, transaction ID, etc." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Division (Optional)</FormLabel>
                  <FormControl>
                    <DivisionSelect value={field.value ?? null} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes..." rows={2} />
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
                {isSubmitting ? 'Recording...' : 'Record Payment'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
