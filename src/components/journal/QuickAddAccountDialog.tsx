import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useCreateAccount, AccountType, AccountClass, AccountGroup } from '@/hooks/useAccounts';
import { useNpoTerminology } from '@/hooks/useNpoTerminology';
import { getT3010CategoriesForAccountType } from '@/data/t3010Categories';

interface QuickAddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onAccountCreated: (accountId: string, accountName: string) => void;
}

const accountTypeOptions: { value: AccountType; label: string }[] = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
];

const normalBalanceByType: Record<AccountType, 'debit' | 'credit'> = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  equity: 'credit',
  income: 'credit',
};

const classForType: Record<AccountType, AccountClass> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  income: 'Revenue',
  expense: 'Expense',
};

const groupOptions: Record<AccountType, { value: AccountGroup; label: string }[]> = {
  asset: [
    { value: 'Current Asset', label: 'Current Asset' },
    { value: 'Fixed Asset', label: 'Fixed Asset' },
    { value: 'Other Non-Current Asset', label: 'Other Non-Current Asset' },
  ],
  liability: [
    { value: 'Current Liability', label: 'Current Liability' },
    { value: 'Long-Term Liability', label: 'Long-Term Liability' },
  ],
  equity: [
    { value: 'Shareholders Equity', label: 'Shareholders Equity' },
    { value: 'Retained Earnings', label: 'Retained Earnings' },
  ],
  income: [
    { value: 'Operating Revenue', label: 'Operating Revenue' },
    { value: 'Other Revenue', label: 'Other Revenue' },
  ],
  expense: [
    { value: 'Cost of Goods Sold', label: 'Cost of Goods Sold' },
    { value: 'Operating Expense', label: 'Operating Expense' },
    { value: 'Other Expense', label: 'Other Expense' },
  ],
};

export function QuickAddAccountDialog({
  open,
  onOpenChange,
  organizationId,
  onAccountCreated,
}: QuickAddAccountDialogProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('expense');
  const [accountGroup, setAccountGroup] = useState<AccountGroup | ''>('');
  const [description, setDescription] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [t3010Category, setT3010Category] = useState('');

  const { isNpo } = useNpoTerminology();
  const createAccount = useCreateAccount();

  const handleSubmit = async () => {
    if (!code.trim() || !name.trim()) return;

    try {
      const result = await createAccount.mutateAsync({
        organizationId,
        account: {
          code: code.trim(),
          name: name.trim(),
          account_type: accountType,
          description: description.trim() || undefined,
          is_header: false,
          normal_balance: normalBalanceByType[accountType],
          opening_balance: parseFloat(openingBalance) || 0,
          account_class: classForType[accountType],
          account_group: accountGroup || undefined,
          t3010_category: t3010Category || undefined,
          is_current: accountGroup?.includes('Current') ?? true,
          posting_allowed: true,
        },
      });

      if (result) {
        onAccountCreated(result.id, `${result.code} - ${result.name}`);
        handleClose();
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    setCode('');
    setName('');
    setAccountType('expense');
    setAccountGroup('');
    setDescription('');
    setT3010Category('');
    setOpeningBalance('0');
    onOpenChange(false);
  };

  const handleTypeChange = (type: AccountType) => {
    setAccountType(type);
    setAccountGroup('');
    setT3010Category('');
  };

  const availableGroups = groupOptions[accountType] || [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Quick Add GL Account</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account-code">Account Code *</Label>
                <Input
                  id="account-code"
                  placeholder="e.g., 6-01-101"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={20}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-type">Account Type *</Label>
                <Select value={accountType} onValueChange={(v) => handleTypeChange(v as AccountType)}>
                  <SelectTrigger id="account-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-name">Account Name *</Label>
              <Input
                id="account-name"
                placeholder="Enter account name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account-group">Account Group</Label>
                <Select value={accountGroup} onValueChange={(v) => setAccountGroup(v as AccountGroup)}>
                  <SelectTrigger id="account-group">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGroups.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opening-balance">Opening Balance</Label>
                <Input
                  id="opening-balance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                />
              </div>
            </div>

            {/* T3010 Category (NPO only, income/expense) */}
            {isNpo && (accountType === 'income' || accountType === 'expense') && (
              <div className="space-y-2">
                <Label htmlFor="t3010-category">T3010 Schedule 6 Category</Label>
                <Select value={t3010Category} onValueChange={setT3010Category}>
                  <SelectTrigger id="t3010-category">
                    <SelectValue placeholder="No mapping" />
                  </SelectTrigger>
                  <SelectContent>
                    {getT3010CategoriesForAccountType(accountType).map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.line} - {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="account-description">Description</Label>
              <Textarea
                id="account-description"
                placeholder="Optional description for this account"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!code.trim() || !name.trim() || createAccount.isPending}
          >
            {createAccount.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
