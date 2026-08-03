import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CheckoutForm, CheckoutFormValues, CheckoutMethod } from '@/components/payments/CheckoutForm';
import { useWisePayouts } from '@/hooks/useWisePayouts';
import { useCurrentOrganization } from '@/hooks/useOrganization';

interface PayBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: {
    id: string;
    bill_number?: string | null;
    vendor_id?: string | null;
    vendor?: { name?: string | null } | null;
    balance_due?: number | null;
    total?: number | null;
    currency?: string | null;
  } | null;
}

const METHODS: CheckoutMethod[] = ['eft', 'etransfer', 'card'];

/** Checkout-style bill payment via Wise (EFT / e-Transfer / card) or Stripe. */
export function PayBillDialog({ open, onOpenChange, bill }: PayBillDialogProps) {
  const { organization } = useCurrentOrganization();
  const { recipients, createTransfer } = useWisePayouts();
  const [recipientId, setRecipientId] = useState<string>('');

  if (!bill) return null;

  const amount = Number(bill.balance_due ?? bill.total ?? 0);
  const currency = bill.currency ?? 'CAD';
  const vendorRecipients = recipients.filter(
    (r) => !r.vendor_id || r.vendor_id === bill.vendor_id,
  );

  const handleSubmit = async (values: CheckoutFormValues) => {
    await createTransfer.mutateAsync({
      source_type: 'bill',
      source_id: bill.id,
      recipient_id: recipientId || null,
      method: values.method,
      amount,
      currency,
      reference: bill.bill_number ? `BILL-${bill.bill_number}` : undefined,
      recipient: recipientId
        ? undefined
        : {
            vendor_id: bill.vendor_id ?? null,
            account_holder_name:
              values.eft.holder_name || bill.vendor?.name || 'Vendor',
            account_number: values.eft.account_number || null,
            routing_number: values.eft.institution
              ? `${values.eft.institution}${values.eft.transit}`
              : null,
            etransfer_email: values.method === 'etransfer' ? values.etransferEmail : null,
            country: values.billing.country,
            currency,
          },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pay bill {bill.bill_number ?? ''}</DialogTitle>
          <DialogDescription>
            Paid out through Wise — EFT, e-Transfer or card.
          </DialogDescription>
        </DialogHeader>

        {vendorRecipients.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Saved Wise recipient</Label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger><SelectValue placeholder="New destination (enter below)" /></SelectTrigger>
              <SelectContent>
                {vendorRecipients.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.account_holder_name} · {r.currency}
                    {r.bank_name ? ` · ${r.bank_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <CheckoutForm
          amount={amount}
          currency={currency}
          reference={bill.bill_number}
          methods={METHODS}
          cardMode="hosted"
          processorLabel="Payout routed through Wise"
          countryCode={organization?.country ?? 'CA'}
          processing={createTransfer.isPending}
          submitLabel={`Pay ${amount.toFixed(2)} ${currency}`}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
