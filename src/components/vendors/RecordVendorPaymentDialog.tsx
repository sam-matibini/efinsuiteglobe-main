import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useVendors } from '@/hooks/useVendors';
import { useBills } from '@/hooks/useBills';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useVendorPayments } from '@/hooks/useVendorPayments';
import { DivisionSelect } from '@/components/dimensions/DivisionSelect';

const paymentSchema = z.object({
  vendor_id: z.string().min(1, 'Vendor is required'),
  bill_id: z.string().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  payment_date: z.date(),
  payment_method: z.string().optional(),
  bank_account_id: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  department_id: z.string().nullable().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface RecordVendorPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedVendorId?: string;
  preselectedBillId?: string;
}

export function RecordVendorPaymentDialog({
  open,
  onOpenChange,
  preselectedVendorId,
  preselectedBillId,
}: RecordVendorPaymentDialogProps) {
  const { vendors } = useVendors();
  const { bills } = useBills();
  const { accounts: bankAccounts } = useBankAccounts();
  const { createPayment } = useVendorPayments();
  
  const [selectedVendorId, setSelectedVendorId] = useState<string>(preselectedVendorId || '');

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      vendor_id: preselectedVendorId || '',
      bill_id: preselectedBillId || '',
      amount: 0,
      payment_date: new Date(),
      payment_method: '',
      bank_account_id: '',
      reference: '',
      notes: '',
    },
  });

  // Filter bills by selected vendor
  const vendorBills = bills.filter(
    bill => bill.vendor_id === selectedVendorId && 
    bill.status !== 'paid' && 
    bill.status !== 'void'
  );

  // Reset form when dialog opens with preselected values
  useEffect(() => {
    if (open) {
      const preselectedBill = bills.find(b => b.id === preselectedBillId);
      form.reset({
        vendor_id: preselectedVendorId || '',
        bill_id: preselectedBillId || '',
        amount: preselectedBill ? Number(preselectedBill.balance_due) : 0,
        payment_date: new Date(),
        payment_method: '',
        bank_account_id: '',
        reference: '',
        notes: '',
      });
      setSelectedVendorId(preselectedVendorId || '');
    }
  }, [open, preselectedVendorId, preselectedBillId, bills, form]);

  // Update amount when bill is selected
  const handleBillChange = (billId: string) => {
    const bill = bills.find(b => b.id === billId);
    if (bill) {
      form.setValue('amount', Number(bill.balance_due));
    }
  };

  const onSubmit = async (data: PaymentFormData) => {
    await createPayment.mutateAsync({
      vendor_id: data.vendor_id,
      bill_id: data.bill_id || undefined,
      amount: data.amount,
      payment_date: format(data.payment_date, 'yyyy-MM-dd'),
      payment_method: data.payment_method || undefined,
      bank_account_id: data.bank_account_id || undefined,
      reference: data.reference || undefined,
      notes: data.notes || undefined,
      department_id: data.department_id || null,
    });
    onOpenChange(false);
    form.reset();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Vendor Payment</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Vendor Selection */}
            <FormField
              control={form.control}
              name="vendor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedVendorId(value);
                      form.setValue('bill_id', '');
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bill Selection */}
            <FormField
              control={form.control}
              name="bill_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apply to Bill (Optional)</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      const actualValue = value === 'none' ? '' : value;
                      field.onChange(actualValue);
                      handleBillChange(actualValue);
                    }} 
                    value={field.value || 'none'}
                    disabled={!selectedVendorId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bill" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No specific bill</SelectItem>
                      {vendorBills.map((bill) => (
                        <SelectItem key={bill.id} value={bill.id}>
                          {bill.bill_number} - {formatCurrency(Number(bill.balance_due))} due
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Date and Amount */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Payment Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? format(field.value, "MMM d, yyyy") : "Pick date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
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
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Payment Method and Bank Account */}
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
                        <SelectItem value="eft">EFT / Direct Deposit</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="wire">Wire Transfer</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
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
                    <FormLabel>From Bank Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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

            {/* Reference */}
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference / Cheque Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., CHQ-1234" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Division */}
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

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Add any notes about this payment..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createPayment.isPending}
                className="bg-accent hover:bg-accent/90"
              >
                {createPayment.isPending ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
