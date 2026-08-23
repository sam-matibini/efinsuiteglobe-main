import { useEffect, useMemo, useState } from 'react';
import { Building2, BookOpen, DollarSign, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreateBankAccountInput } from '@/hooks/useBankAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import {
  getInstitutionsForCountry,
  getBankInstitutionsOnly,
  getMobileWalletInstitutions,
  mapInstitutionType,
} from '@/data/localizedBankingInstitutions';
import { getCountryLocalization, resolveCountryCode } from '@/data/countryLocalizations';
import { AllCurrenciesSelect, CountrySelect } from '@/components/banking/CountryCurrencySelects';

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  is_header: boolean;
  is_active: boolean;
}

interface AddBankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  glAccounts: Account[];
  onSubmit: (input: CreateBankAccountInput) => Promise<void>;
  isPending?: boolean;
}

export function AddBankAccountDialog({
  open,
  onOpenChange,
  glAccounts,
  onSubmit,
  isPending,
}: AddBankAccountDialogProps) {
  const { organization } = useCurrentOrganization();
  const orgCountry = resolveCountryCode(organization?.country);
  const orgCurrency = organization?.currency || getCountryLocalization(orgCountry).currency;

  const [country, setCountry] = useState(orgCountry);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [customInstitution, setCustomInstitution] = useState('');
  const [institutionType, setInstitutionType] = useState<CreateBankAccountInput['institution_type']>('bank');
  const [institutionCode, setInstitutionCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency] = useState(orgCurrency);
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split('T')[0]);
  const [glAccountId, setGlAccountId] = useState('');
  const [error, setError] = useState('');

  const bankingInstitutions = useMemo(() => getInstitutionsForCountry(country), [country]);
  const bankList = useMemo(() => getBankInstitutionsOnly(country), [country]);
  const mobileMoneyList = useMemo(
    () => getMobileWalletInstitutions(country).filter((i) => i.type === 'mobile_money'),
    [country],
  );
  const eWalletList = useMemo(
    () => getMobileWalletInstitutions(country).filter((i) => i.type === 'ewallet'),
    [country],
  );

  const bankGLAccounts = glAccounts.filter((a) => {
    if (a.account_type !== 'asset' || a.is_header || !a.is_active) return false;
    const code = a.code;
    const nameLower = a.name.toLowerCase();
    const legacyMatch = code.startsWith('100') || code.startsWith('101') || code.startsWith('102');
    const hierarchicalMatch =
      code.startsWith('1-01-101') ||
      code.startsWith('1-01-102') ||
      code.startsWith('1-01-100') ||
      code.startsWith('1-01-103');
    const nameMatch =
      nameLower.includes('cash') ||
      nameLower.includes('bank') ||
      nameLower.includes('chequing') ||
      nameLower.includes('checking') ||
      nameLower.includes('savings') ||
      nameLower.includes('operating') ||
      nameLower.includes('payroll') ||
      nameLower.includes('petty') ||
      nameLower.includes('money market') ||
      nameLower.includes('foreign currency') ||
      nameLower.includes('wallet') ||
      nameLower.includes('mobile money') ||
      nameLower.includes('momo') ||
      nameLower.includes('pesa') ||
      nameLower.includes('paypal') ||
      nameLower.includes('wise') ||
      nameLower.includes('stripe balance');
    return legacyMatch || hierarchicalMatch || nameMatch;
  });

  useEffect(() => {
    if (!open) return;
    const nextCountry = resolveCountryCode(organization?.country);
    setCountry(nextCountry);
    setCurrency(organization?.currency || getCountryLocalization(nextCountry).currency);
    setName('');
    setInstitution('');
    setCustomInstitution('');
    setInstitutionType('bank');
    setInstitutionCode('');
    setAccountNumber('');
    setOpeningBalance('');
    setOpeningDate(new Date().toISOString().split('T')[0]);
    setGlAccountId('');
    setError('');
  }, [open, organization?.country, organization?.currency]);

  const handleCountryChange = (code: string) => {
    setCountry(code);
    setCurrency(getCountryLocalization(code).currency);
    setInstitution('');
    setCustomInstitution('');
    setInstitutionType('bank');
    setInstitutionCode('');
  };

  const handleInstitutionChange = (val: string) => {
    const found = bankingInstitutions.find((i) => i.name === val);
    setInstitution(val);
    setInstitutionType(found ? mapInstitutionType(found.type) : 'other');
    setInstitutionCode(found?.code || '');
    if (val !== 'Other') setCustomInstitution('');
  };

  const handleSubmit = async () => {
    const resolvedInstitution = institution === 'Other' ? customInstitution.trim() : institution;
    if (!name.trim() || !resolvedInstitution) {
      setError('Account name and financial institution are required.');
      return;
    }
    if (!glAccountId) {
      setError('Please select a GL account to link this bank account.');
      return;
    }
    setError('');
    await onSubmit({
      name: name.trim(),
      institution: resolvedInstitution,
      institution_type: institutionType,
      institution_code: institutionCode || undefined,
      account_number: accountNumber.trim() || undefined,
      currency,
      opening_balance: parseFloat(openingBalance) || 0,
      opening_date: openingDate || undefined,
      gl_account_id: glAccountId,
    });
    onOpenChange(false);
  };

  const countryLabel = getCountryLocalization(country).name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Add Bank Account
          </DialogTitle>
          <DialogDescription>
            Add a bank, mobile-money, or wallet account for any supported country and currency.
            One GL-linked account per institution you want to reconcile.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="add-bank-country">Country</Label>
                <CountrySelect id="add-bank-country" value={country} onChange={handleCountryChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-bank-currency">Currency</Label>
                <AllCurrenciesSelect
                  id="add-bank-currency"
                  value={currency}
                  onChange={setCurrency}
                  primaryCountryCode={country}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-bank-name">Account Name</Label>
              <Input
                id="add-bank-name"
                placeholder={`e.g., ${countryLabel} Operating Account`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-bank-institution">Financial Institution</Label>
              <Select value={institution} onValueChange={handleInstitutionChange}>
                <SelectTrigger id="add-bank-institution">
                  <SelectValue placeholder="Select bank, mobile money, or wallet" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {bankList.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Banks</div>
                      {bankList.map((inst) => (
                        <SelectItem key={`b-${inst.code}`} value={inst.name}>
                          {inst.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {mobileMoneyList.length > 0 && (
                    <>
                      <div className="px-2 py-1 mt-1 text-xs font-semibold text-muted-foreground">
                        Mobile Money
                      </div>
                      {mobileMoneyList.map((inst) => (
                        <SelectItem key={`m-${inst.code}`} value={inst.name}>
                          {inst.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {eWalletList.length > 0 && (
                    <>
                      <div className="px-2 py-1 mt-1 text-xs font-semibold text-muted-foreground">
                        Digital Wallets
                      </div>
                      {eWalletList.map((inst) => (
                        <SelectItem key={`w-${inst.code}`} value={inst.name}>
                          {inst.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  <div className="px-2 py-1 mt-1 text-xs font-semibold text-muted-foreground">Other</div>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {bankingInstitutions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No preset institutions for {countryLabel}. Choose Other and enter the bank name.
                </p>
              )}
            </div>

            {institution === 'Other' && (
              <div className="space-y-2">
                <Label htmlFor="add-bank-custom-institution">Institution Name</Label>
                <Input
                  id="add-bank-custom-institution"
                  placeholder="Enter bank or wallet name"
                  value={customInstitution}
                  onChange={(e) => setCustomInstitution(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="add-bank-number">Account Number (Last 4)</Label>
              <Input
                id="add-bank-number"
                placeholder="1234"
                maxLength={4}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="add-bank-opening" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Opening Balance
                </Label>
                <Input
                  id="add-bank-opening"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-bank-date" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Opening Date
                </Label>
                <Input
                  id="add-bank-date"
                  type="date"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-bank-gl" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Link to GL Account
              </Label>
              <Select value={glAccountId} onValueChange={setGlAccountId}>
                <SelectTrigger id="add-bank-gl">
                  <SelectValue placeholder="Select GL account" />
                </SelectTrigger>
                <SelectContent>
                  {bankGLAccounts.length > 0 ? (
                    bankGLAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.code} - {acc.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground">
                      No bank/cash accounts found. Create one in Chart of Accounts.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim() || !institution}>
            {isPending ? 'Creating…' : 'Add Bank Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
