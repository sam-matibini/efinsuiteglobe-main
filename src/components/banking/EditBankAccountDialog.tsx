import { useState, useEffect, useMemo } from 'react';
import { Building2, BookOpen, DollarSign, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BankAccount } from '@/hooks/useBankAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import {
  getInstitutionsForCountry,
  getBankInstitutionsOnly,
  getMobileWalletInstitutions,
  mapInstitutionType,
  type BankingInstitution,
} from '@/data/localizedBankingInstitutions';
import { getAllLocalizedCurrencies } from '@/hooks/useLocalizedCurrency';

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  is_header: boolean;
  is_active: boolean;
}

interface EditBankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccount | null;
  glAccounts: Account[];
  onSave: (id: string, updates: Partial<BankAccount>) => Promise<void>;
  isPending?: boolean;
}

// Fallback institutions
const DEFAULT_INSTITUTIONS: BankingInstitution[] = [
  { code: 'OTHER', name: 'Other Bank', type: 'commercial' },
];

export function EditBankAccountDialog({
  open,
  onOpenChange,
  account,
  glAccounts,
  onSave,
  isPending,
}: EditBankAccountDialogProps) {
  const { organization } = useCurrentOrganization();
  const countryCode = organization?.country || 'CA';
  
  // Get localized banking institutions based on organization country
  const bankingInstitutions = useMemo(() => {
    const institutions = getInstitutionsForCountry(countryCode);
    return institutions.length > 0 ? institutions : DEFAULT_INSTITUTIONS;
  }, [countryCode]);

  const bankList = useMemo(() => getBankInstitutionsOnly(countryCode), [countryCode]);
  const mobileMoneyList = useMemo(
    () => getMobileWalletInstitutions(countryCode).filter(i => i.type === 'mobile_money'),
    [countryCode]
  );
  const eWalletList = useMemo(
    () => getMobileWalletInstitutions(countryCode).filter(i => i.type === 'ewallet'),
    [countryCode]
  );
  
  const [formData, setFormData] = useState({
    name: '',
    institution: '',
    institutionType: 'bank' as 'bank' | 'mobile_money' | 'ewallet' | 'microfinance' | 'other',
    institutionCode: '' as string,
    accountNumber: '',
    currency: organization?.currency || 'CAD',
    glAccountId: '',
    openingBalance: 0,
    openingDate: '',
  });

  const handleInstitutionChange = (val: string) => {
    const found = bankingInstitutions.find(i => i.name === val);
    setFormData(prev => ({
      ...prev,
      institution: val,
      institutionType: found ? mapInstitutionType(found.type) : 'other',
      institutionCode: found?.code || '',
    }));
  };

  // Filter to show only asset-type accounts for bank linking
  // Supports legacy codes (100, 101, 102) and new hierarchical codes (1-01-101/102/103)
  const bankGLAccounts = glAccounts.filter(a => {
    if (a.account_type !== 'asset' || a.is_header || !a.is_active) return false;
    
    const code = a.code;
    const nameLower = a.name.toLowerCase();
    
    const legacyMatch = code.startsWith('100') || code.startsWith('101') || code.startsWith('102');
    const hierarchicalMatch = code.startsWith('1-01-101') || code.startsWith('1-01-102') || 
                              code.startsWith('1-01-100') || code.startsWith('1-01-103');
    const nameMatch = nameLower.includes('cash') || 
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

  // Sync form data when account changes
  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        institution: account.institution || '',
        institutionType: (account.institution_type as 'bank') || 'bank',
        institutionCode: account.institution_code || '',
        accountNumber: account.account_number || '',
        currency: account.currency || 'CAD',
        glAccountId: account.gl_account_id || '',
        openingBalance: account.opening_balance || 0,
        openingDate: account.opening_date || '',
      });
    }
  }, [account]);

  const handleSubmit = async () => {
    if (!account || !formData.name || !formData.institution) return;

    await onSave(account.id, {
      name: formData.name,
      institution: formData.institution,
      institution_type: formData.institutionType,
      institution_code: formData.institutionCode || null,
      account_number: formData.accountNumber || null,
      currency: formData.currency,
      gl_account_id: formData.glAccountId || null,
      opening_balance: formData.openingBalance,
      opening_date: formData.openingDate || null,
    });
    onOpenChange(false);
  };

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Edit Bank Account
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Account Name</Label>
              <Input 
                id="editName" 
                placeholder="e.g., Operating Account"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editInstitution">Financial Institution</Label>
                <Select
                  value={formData.institution}
                  onValueChange={handleInstitutionChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank, mobile money, or wallet" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {bankList.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Banks</div>
                        {bankList.map(inst => (
                          <SelectItem key={`b-${inst.code}`} value={inst.name}>{inst.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {mobileMoneyList.length > 0 && (
                      <>
                        <div className="px-2 py-1 mt-1 text-xs font-semibold text-muted-foreground">Mobile Money</div>
                        {mobileMoneyList.map(inst => (
                          <SelectItem key={`m-${inst.code}`} value={inst.name}>{inst.name}</SelectItem>
                        ))}
                      </>
                    )}
                    {eWalletList.length > 0 && (
                      <>
                        <div className="px-2 py-1 mt-1 text-xs font-semibold text-muted-foreground">Digital Wallets</div>
                        {eWalletList.map(inst => (
                          <SelectItem key={`w-${inst.code}`} value={inst.name}>{inst.name}</SelectItem>
                        ))}
                      </>
                    )}
                    <div className="px-2 py-1 mt-1 text-xs font-semibold text-muted-foreground">Other</div>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCurrency">Currency</Label>
                <Select 
                  value={formData.currency}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {getAllLocalizedCurrencies(countryCode).map((curr) => (
                      <SelectItem key={curr.code} value={curr.code}>
                        {curr.code} - {curr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editAccountNumber">Account Number (Last 4)</Label>
              <Input 
                id="editAccountNumber" 
                placeholder="1234" 
                maxLength={4}
                value={formData.accountNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
              />
            </div>
            
            {/* Opening Balance Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editOpeningBalance" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Opening Balance
                </Label>
                <FormattedNumberInput
                  value={formData.openingBalance}
                  onChange={(val) => setFormData(prev => ({ ...prev, openingBalance: val }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editOpeningDate" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Opening Date
                </Label>
                <Input
                  id="editOpeningDate"
                  type="date"
                  value={formData.openingDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, openingDate: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="editGlAccount" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Link to GL Account
              </Label>
              <Select
                value={formData.glAccountId}
                onValueChange={(val) => setFormData(prev => ({ ...prev, glAccountId: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select GL account" />
                </SelectTrigger>
                <SelectContent>
                  {bankGLAccounts.length > 0 ? (
                    bankGLAccounts.map(acc => (
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
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                className="bg-accent hover:bg-accent/90" 
                onClick={handleSubmit}
                disabled={isPending || !formData.name || !formData.institution}
              >
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
