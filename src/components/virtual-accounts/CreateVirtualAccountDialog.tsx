import { useState, useEffect } from 'react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVirtualAccounts } from '@/hooks/useVirtualAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { EFINCASH_CURRENCIES } from '@/lib/efincash';
import { getCountryLocalization, resolveCountryCode } from '@/data/countryLocalizations';
import { AllCurrenciesSelect, CountrySelect } from '@/components/banking/CountryCurrencySelects';

function isNigeriaKycRequired(country: string, currency: string) {
  return country === 'NG' || currency === 'NGN';
}

const schema = z.object({
  country: z.string().min(1),
  currency: z.string().min(1),
  email: z.string().email('Invalid email'),
  first_name: z.string().trim().min(1, 'Required').max(100),
  last_name: z.string().trim().min(1, 'Required').max(100),
  bvn_or_nin: z.string().trim().max(50).optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (isNigeriaKycRequired(data.country, data.currency) && !data.bvn_or_nin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['bvn_or_nin'],
      message: 'BVN or NIN is required for NGN accounts',
    });
  }
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CreateVirtualAccountDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const { create } = useVirtualAccounts();

  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const defaultFirst = meta.first_name ?? meta.given_name ?? (meta.full_name?.split(' ')[0] ?? '');
  const defaultLast = meta.last_name ?? meta.family_name ?? (meta.full_name?.split(' ').slice(1).join(' ') ?? '');
  const orgCountry = resolveCountryCode(organization?.country);

  const [country, setCountry] = useState(orgCountry);
  const [currency, setCurrency] = useState(getCountryLocalization(orgCountry).currency);
  const [email, setEmail] = useState(user?.email ?? '');
  const [firstName, setFirstName] = useState(defaultFirst);
  const [lastName, setLastName] = useState(defaultLast);
  const [bvn, setBvn] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const nextCountry = resolveCountryCode(organization?.country);
    setEmail(user?.email ?? '');
    setFirstName(defaultFirst);
    setLastName(defaultLast);
    setBvn('');
    setCountry(nextCountry);
    setCurrency(
      organization?.currency || getCountryLocalization(nextCountry).currency,
    );
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCountryChange = (code: string) => {
    setCountry(code);
    setCurrency(getCountryLocalization(code).currency);
  };

  const handleSubmit = async () => {
    const parsed = schema.safeParse({
      country,
      currency,
      email,
      first_name: firstName,
      last_name: lastName,
      bvn_or_nin: bvn,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
        if (v?.[0]) errs[k] = v[0];
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    try {
      await create.mutateAsync({
        currency: parsed.data.currency,
        email: parsed.data.email,
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        bvn_or_nin: parsed.data.bvn_or_nin || null,
      });
      onOpenChange(false);
    } catch {
      /* toast handled in hook */
    }
  };

  const kycRequired = isNigeriaKycRequired(country, currency);
  const providerSupported = (EFINCASH_CURRENCIES as readonly string[]).includes(currency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Virtual Account</DialogTitle>
          <DialogDescription>
            Generate a virtual bank account your organization can use to receive funds via eFinCash. One account per currency.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Country</Label>
              <CountrySelect value={country} onChange={handleCountryChange} />
              {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <AllCurrenciesSelect
                value={currency}
                onChange={setCurrency}
                primaryCountryCode={country}
              />
              {errors.currency && <p className="text-xs text-destructive">{errors.currency}</p>}
            </div>
          </div>

          {!providerSupported && (
            <p className="text-xs text-muted-foreground">
              eFinCash typically provisions {EFINCASH_CURRENCIES.join(', ')}. Other currencies can still be requested; the provider may return pending or failed if unsupported.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              {errors.first_name && <p className="text-xs text-destructive">{errors.first_name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              {errors.last_name && <p className="text-xs text-destructive">{errors.last_name}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label>
              BVN or NIN {kycRequired
                ? <span className="text-destructive text-xs">(required)</span>
                : <span className="text-muted-foreground text-xs">(optional)</span>}
            </Label>
            <Input value={bvn} onChange={(e) => setBvn(e.target.value)} placeholder="11-digit BVN or NIN" />
            {errors.bvn_or_nin && <p className="text-xs text-destructive">{errors.bvn_or_nin}</p>}
            <p className="text-xs text-muted-foreground">
              Required by NGN providers for KYC. Leave blank for non-NGN currencies if not applicable.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {create.isPending ? 'Creating…' : 'Create Virtual Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
