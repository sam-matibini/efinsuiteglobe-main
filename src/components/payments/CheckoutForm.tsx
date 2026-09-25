import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CreditCard, Landmark, Loader2, Mail, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CheckoutMethod = 'card' | 'eft' | 'etransfer';

export interface CheckoutFormValues {
  method: CheckoutMethod;
  email: string;
  saveInfo: boolean;
  card: {
    number: string;
    expiry: string;
    cvc: string;
    name: string;
  };
  eft: {
    holder_name: string;
    institution: string;
    transit: string;
    account_number: string;
    account_type: 'CHECKING' | 'SAVINGS';
  };
  etransferEmail: string;
  billing: {
    country: string;
    line1: string;
    line2: string;
    city: string;
    region: string;
    postal: string;
  };
}

export interface CheckoutFormProps {
  amount: number;
  currency: string;
  reference?: string | null;
  /** Which rails the payer may choose from. */
  methods?: CheckoutMethod[];
  /** `hosted` = the processor collects the card in its own secure overlay (no PAN in our DOM). */
  cardMode?: 'hosted' | 'fields';
  /** Show the Apple Pay / Link express row. */
  express?: boolean;
  processorLabel?: string;
  defaultEmail?: string;
  countryCode?: string;
  processing?: boolean;
  submitLabel?: string;
  onSubmit: (values: CheckoutFormValues) => void | Promise<void>;
  className?: string;
}

const COUNTRIES = [
  { code: 'CA', name: 'Canada', region: 'Province', postal: 'Postal code' },
  { code: 'US', name: 'United States', region: 'State', postal: 'ZIP code' },
  { code: 'GB', name: 'United Kingdom', region: 'County', postal: 'Postcode' },
  { code: 'NG', name: 'Nigeria', region: 'State', postal: 'Postal code' },
  { code: 'ZM', name: 'Zambia', region: 'Province', postal: 'Postal code' },
  { code: 'KE', name: 'Kenya', region: 'County', postal: 'Postal code' },
];

const METHOD_META: Record<CheckoutMethod, { label: string; icon: typeof CreditCard }> = {
  card: { label: 'Card', icon: CreditCard },
  eft: { label: 'Bank / EFT', icon: Landmark },
  etransfer: { label: 'e-Transfer', icon: Mail },
};

const emptyValues = (email: string, country: string): CheckoutFormValues => ({
  method: 'card',
  email,
  saveInfo: false,
  card: { number: '', expiry: '', cvc: '', name: '' },
  eft: { holder_name: '', institution: '', transit: '', account_number: '', account_type: 'CHECKING' },
  etransferEmail: email,
  billing: { country, line1: '', line2: '', city: '', region: '', postal: '' },
});

/**
 * Stripe-style checkout card, shared by the public payment link page and the
 * in-app bill payment dialog. When `cardMode` is `hosted` (the default) no card
 * number ever touches our DOM — the processor's overlay collects it.
 */
export function CheckoutForm({
  amount,
  currency,
  reference,
  methods = ['card', 'eft', 'etransfer'],
  cardMode = 'hosted',
  express = false,
  processorLabel = 'Secure payment',
  defaultEmail = '',
  countryCode = 'CA',
  processing = false,
  submitLabel,
  onSubmit,
  className,
}: CheckoutFormProps) {
  const [values, setValues] = useState<CheckoutFormValues>(() => ({
    ...emptyValues(defaultEmail, countryCode),
    method: methods[0] ?? 'card',
  }));

  const country = useMemo(
    () => COUNTRIES.find((c) => c.code === values.billing.country) ?? COUNTRIES[0],
    [values.billing.country],
  );

  const set = <K extends keyof CheckoutFormValues>(key: K, value: CheckoutFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const formatted = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'CAD',
  }).format(Number(amount) || 0);

  return (
    <div className={cn('space-y-5', className)}>
      {express && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="secondary" className="h-12 bg-foreground text-background hover:bg-foreground/90" disabled>
               Pay
            </Button>
            <Button type="button" className="h-12 bg-emerald-500 text-white hover:bg-emerald-600" disabled>
              <Zap className="h-4 w-4 mr-1" /> link
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" /> OR <Separator className="flex-1" />
          </div>
        </>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Contact information</h3>
        <div className="rounded-lg border bg-muted/40 p-3">
          <Label htmlFor="checkout-email" className="text-xs text-muted-foreground">Email</Label>
          <Input
            id="checkout-email"
            type="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="you@example.com"
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Payment method</h3>
        <div className="rounded-lg border divide-y">
          {methods.length > 1 && (
            <div className="flex flex-wrap gap-2 p-3">
              {methods.map((m) => {
                const Icon = METHOD_META[m].icon;
                return (
                  <Button
                    key={m}
                    type="button"
                    size="sm"
                    variant={values.method === m ? 'default' : 'outline'}
                    onClick={() => set('method', m)}
                  >
                    <Icon className="h-4 w-4 mr-1.5" />
                    {METHOD_META[m].label}
                  </Button>
                );
              })}
            </div>
          )}

          {values.method === 'card' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4" /> Card
              </div>
              {cardMode === 'fields' ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="cc-number" className="text-xs text-muted-foreground">Card information</Label>
                    <Input
                      id="cc-number"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      value={values.card.number}
                      onChange={(e) => set('card', { ...values.card, number: e.target.value })}
                      placeholder="1234 1234 1234 1234"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        value={values.card.expiry}
                        onChange={(e) => set('card', { ...values.card, expiry: e.target.value })}
                        placeholder="MM / YY"
                      />
                      <Input
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        value={values.card.cvc}
                        onChange={(e) => set('card', { ...values.card, cvc: e.target.value })}
                        placeholder="CVC"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cc-name" className="text-xs text-muted-foreground">Cardholder name</Label>
                    <Input
                      id="cc-name"
                      autoComplete="cc-name"
                      value={values.card.name}
                      onChange={(e) => set('card', { ...values.card, name: e.target.value })}
                      placeholder="Full name on card"
                    />
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Card details are entered in the processor's secure window after you press Pay — we never store your
                  card number.
                </p>
              )}
            </div>
          )}

          {values.method === 'eft' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Landmark className="h-4 w-4" /> Bank account (EFT)
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eft-holder" className="text-xs text-muted-foreground">Account holder name</Label>
                <Input
                  id="eft-holder"
                  value={values.eft.holder_name}
                  onChange={(e) => set('eft', { ...values.eft, holder_name: e.target.value })}
                  placeholder="As shown on the cheque"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="eft-inst" className="text-xs text-muted-foreground">Institution # (3)</Label>
                  <Input
                    id="eft-inst"
                    inputMode="numeric"
                    maxLength={3}
                    value={values.eft.institution}
                    onChange={(e) => set('eft', { ...values.eft, institution: e.target.value.replace(/\D/g, '') })}
                    placeholder="001"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eft-transit" className="text-xs text-muted-foreground">Transit # (5)</Label>
                  <Input
                    id="eft-transit"
                    inputMode="numeric"
                    maxLength={5}
                    value={values.eft.transit}
                    onChange={(e) => set('eft', { ...values.eft, transit: e.target.value.replace(/\D/g, '') })}
                    placeholder="12345"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eft-account" className="text-xs text-muted-foreground">Account number</Label>
                <Input
                  id="eft-account"
                  inputMode="numeric"
                  maxLength={17}
                  value={values.eft.account_number}
                  onChange={(e) => set('eft', { ...values.eft, account_number: e.target.value.replace(/\D/g, '') })}
                  placeholder="1234567"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={values.eft.account_type === 'CHECKING' ? 'default' : 'outline'}
                  onClick={() => set('eft', { ...values.eft, account_type: 'CHECKING' })}
                >
                  Chequing
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={values.eft.account_type === 'SAVINGS' ? 'default' : 'outline'}
                  onClick={() => set('eft', { ...values.eft, account_type: 'SAVINGS' })}
                >
                  Savings
                </Button>
              </div>
            </div>
          )}

          {values.method === 'etransfer' && (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" /> e-Transfer
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="etransfer-email" className="text-xs text-muted-foreground">Recipient email</Label>
                <Input
                  id="etransfer-email"
                  type="email"
                  value={values.etransferEmail}
                  onChange={(e) => set('etransferEmail', e.target.value)}
                  placeholder="recipient@example.com"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A secure transfer request is sent to this address. Funds usually arrive within minutes.
              </p>
            </div>
          )}

          <div className="p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Billing address</Label>
            <Select
              value={values.billing.country}
              onValueChange={(v) => set('billing', { ...values.billing, country: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={values.billing.line1}
              onChange={(e) => set('billing', { ...values.billing, line1: e.target.value })}
              placeholder="Address line 1"
            />
            <Input
              value={values.billing.line2}
              onChange={(e) => set('billing', { ...values.billing, line2: e.target.value })}
              placeholder="Address line 2"
            />
            <Input
              value={values.billing.city}
              onChange={(e) => set('billing', { ...values.billing, city: e.target.value })}
              placeholder="City"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={values.billing.region}
                onChange={(e) => set('billing', { ...values.billing, region: e.target.value })}
                placeholder={country.region}
              />
              <Input
                value={values.billing.postal}
                onChange={(e) => set('billing', { ...values.billing, postal: e.target.value })}
                placeholder={country.postal}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="checkout-save"
                checked={values.saveInfo}
                onCheckedChange={(v) => set('saveInfo', !!v)}
              />
              <label htmlFor="checkout-save" className="text-xs text-muted-foreground">
                Save my payment information for future purchases
              </label>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-2">
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={processing}
          onClick={() => onSubmit(values)}
        >
          {processing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing…</> : (submitLabel ?? `Pay ${formatted}`)}
        </Button>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{processorLabel}{reference ? ` · ${reference}` : ''}</span>
        </div>
      </div>
    </div>
  );
}
