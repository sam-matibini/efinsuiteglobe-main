import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Info } from 'lucide-react';
import { useUpdateAccount, DbAccount, AccountType, AccountClass, AccountGroup, AccountSubGroup } from '@/hooks/useAccounts';
import { useNpoTerminology } from '@/hooks/useNpoTerminology';
import { getT3010CategoriesForAccountType } from '@/data/t3010Categories';

const accountSchema = z.object({
  code: z.string().min(1, 'Account code is required').max(20),
  name: z.string().min(1, 'Account name is required').max(255),
  account_type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  parent_id: z.string().optional(),
  description: z.string().optional(),
  is_header: z.boolean().default(false),
  normal_balance: z.enum(['debit', 'credit']).default('debit'),
  opening_balance: z.number().default(0),
  account_class: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']).optional(),
  account_group: z.string().optional(),
  account_sub_group: z.string().optional().nullable(),
  is_current: z.boolean().default(true),
  posting_allowed: z.boolean().default(true),
  is_active: z.boolean().default(true),
  t3010_category: z.string().optional().nullable(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

interface EditAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  account: DbAccount;
  existingAccounts: DbAccount[];
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
  liability: 'credit',
  equity: 'credit',
  income: 'credit',
  expense: 'debit',
};

const accountClassByType: Record<AccountType, AccountClass> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  income: 'Revenue',
  expense: 'Expense',
};

const accountGroupsByType: Record<AccountType, { value: AccountGroup; label: string; isCurrent?: boolean }[]> = {
  asset: [
    { value: 'Current Asset', label: 'Current Asset', isCurrent: true },
    { value: 'Fixed Asset', label: 'Fixed Asset (Non-Current)', isCurrent: false },
    { value: 'Other Non-Current Asset', label: 'Other Non-Current Asset', isCurrent: false },
  ],
  liability: [
    { value: 'Current Liability', label: 'Current Liability', isCurrent: true },
    { value: 'Long-Term Liability', label: 'Long-Term Liability', isCurrent: false },
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

const subGroupsByGroup: Record<string, { value: AccountSubGroup; label: string }[]> = {
  'Current Asset': [
    { value: 'Cash', label: 'Cash & Cash Equivalents' },
    { value: 'Accounts Receivable', label: 'Accounts Receivable' },
    { value: 'Inventory', label: 'Inventory' },
    { value: 'Prepaid Expenses', label: 'Prepaid Expenses' },
    { value: 'Other Current Assets', label: 'Other Current Assets' },
  ],
  'Fixed Asset': [
    { value: 'Property Plant Equipment', label: 'Property, Plant & Equipment' },
    { value: 'Intangible Assets', label: 'Intangible Assets' },
  ],
  'Other Non-Current Asset': [
    { value: 'Long-Term Investments', label: 'Long-Term Investments' },
  ],
  'Current Liability': [
    { value: 'Accounts Payable', label: 'Accounts Payable' },
    { value: 'Accrued Liabilities', label: 'Accrued Liabilities' },
    { value: 'Taxes Payable', label: 'Taxes Payable' },
    { value: 'Deferred Revenue', label: 'Deferred Revenue (Current)' },
    { value: 'Short-Term Loans', label: 'Short-Term Loans' },
  ],
  'Long-Term Liability': [
    { value: 'Long-Term Loans', label: 'Long-Term Loans' },
    { value: 'Lease Liabilities', label: 'Lease Liabilities' },
    { value: 'Deferred Tax Liabilities', label: 'Deferred Tax Liabilities' },
  ],
  'Shareholders Equity': [
    { value: 'Capital Stock', label: 'Capital Stock' },
    { value: 'Additional Paid-In Capital', label: 'Additional Paid-In Capital' },
  ],
  'Retained Earnings': [
    { value: 'Retained Earnings', label: 'Retained Earnings' },
    { value: 'Dividends', label: 'Dividends' },
  ],
  'Operating Revenue': [
    { value: 'Sales', label: 'Sales' },
    { value: 'Service Revenue', label: 'Service Revenue' },
  ],
  'Other Revenue': [
    { value: 'Interest Income', label: 'Interest Income' },
    { value: 'Other Income', label: 'Other Income' },
  ],
  'Cost of Goods Sold': [
    { value: 'Direct Costs', label: 'Direct Costs' },
  ],
  'Operating Expense': [
    { value: 'Payroll', label: 'Payroll & Benefits' },
    { value: 'Rent', label: 'Rent & Occupancy' },
    { value: 'Utilities', label: 'Utilities' },
    { value: 'Professional Fees', label: 'Professional Fees' },
    { value: 'Depreciation', label: 'Depreciation & Amortization' },
  ],
  'Other Expense': [
    { value: 'Other Expenses', label: 'Other Expenses' },
  ],
};

export function EditAccountDialog({
  open,
  onOpenChange,
  organizationId,
  account,
  existingAccounts,
}: EditAccountDialogProps) {
  const updateAccount = useUpdateAccount();
  const { isNpo } = useNpoTerminology();
  
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      parent_id: account.parent_id || '',
      description: account.description || '',
      is_header: account.is_header,
      normal_balance: account.normal_balance as 'debit' | 'credit',
      opening_balance: account.opening_balance,
      account_class: account.account_class as AccountClass | undefined,
      account_group: account.account_group || '',
      account_sub_group: account.account_sub_group,
      is_current: account.is_current,
      posting_allowed: account.posting_allowed,
      is_active: account.is_active,
      t3010_category: (account as any).t3010_category || null,
    },
  });

  // Reset form when account changes
  useEffect(() => {
    form.reset({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      parent_id: account.parent_id || '',
      description: account.description || '',
      is_header: account.is_header,
      normal_balance: account.normal_balance as 'debit' | 'credit',
      opening_balance: account.opening_balance,
      account_class: account.account_class as AccountClass | undefined,
      account_group: account.account_group || '',
      account_sub_group: account.account_sub_group,
      is_current: account.is_current,
      posting_allowed: account.posting_allowed,
      is_active: account.is_active,
      t3010_category: (account as any).t3010_category || null,
    });
  }, [account, form]);

  const selectedType = form.watch('account_type');
  const selectedGroup = form.watch('account_group') as AccountGroup | undefined;
  const isHeader = form.watch('is_header');
  const t3010Options = isNpo ? getT3010CategoriesForAccountType(selectedType) : [];
  const availableGroups = accountGroupsByType[selectedType] || [];
  const availableSubGroups = selectedGroup ? subGroupsByGroup[selectedGroup] || [] : [];
  
  // Filter parent accounts - can't be self or own children
  const parentOptions = existingAccounts.filter(
    (acc) => acc.account_type === selectedType && acc.is_header && acc.id !== account.id
  );

  const handleTypeChange = (value: AccountType) => {
    form.setValue('account_type', value);
    form.setValue('normal_balance', normalBalanceByType[value]);
    form.setValue('account_class', accountClassByType[value]);
    form.setValue('parent_id', '');
    
    const groups = accountGroupsByType[value];
    if (groups.length > 0) {
      form.setValue('account_group', groups[0].value);
      form.setValue('is_current', groups[0].isCurrent ?? true);
    }
    form.setValue('account_sub_group', null);
  };

  const handleGroupChange = (value: string) => {
    form.setValue('account_group', value);
    form.setValue('account_sub_group', null);
    
    const group = availableGroups.find(g => g.value === value);
    if (group && group.isCurrent !== undefined) {
      form.setValue('is_current', group.isCurrent);
    }
  };

  useEffect(() => {
    if (isHeader) {
      form.setValue('posting_allowed', false);
    }
  }, [isHeader, form]);

  const onSubmit = async (values: AccountFormValues) => {
    // Always-safe fields (name & description editable even with posted transactions)
    const updates: Partial<import('@/hooks/useAccounts').AccountInput> = {
      name: values.name,
      description: values.description,
      parent_id: values.parent_id || null,
      posting_allowed: values.posting_allowed,
      is_active: values.is_active,
      t3010_category: values.t3010_category || null,
    };

    // Risky fields — only send when account has no posted transactions
    if (!hasTransactions) {
      updates.code = values.code;
      updates.account_type = values.account_type;
      updates.account_class = values.account_class as AccountClass;
      updates.account_group = values.account_group as AccountGroup;
      updates.account_sub_group = values.account_sub_group as AccountSubGroup;
      updates.is_current = values.is_current;
      updates.is_header = values.is_header;
      updates.normal_balance = values.normal_balance;
      updates.opening_balance = values.opening_balance;
    }

    await updateAccount.mutateAsync({
      id: account.id,
      organizationId,
      updates,
    });
    onOpenChange(false);
  };

  const hasTransactions = account.current_balance !== account.opening_balance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>
            Update account details and classification.
          </DialogDescription>
        </DialogHeader>

        {hasTransactions && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-700">Account has posted transactions</p>
              <p className="text-amber-600">Name and description can be edited freely. Code, type, and classification are locked to protect historical data.</p>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Code</FormLabel>
                    <FormControl>
                      <Input placeholder="1-01-101" disabled={hasTransactions} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="account_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => handleTypeChange(v as AccountType)}
                      disabled={hasTransactions}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accountTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Cash on Hand" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-4" />
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Classification</h4>
                <Badge variant="secondary" className="text-xs">
                  {form.watch('account_class')}
                </Badge>
                {form.watch('is_current') !== undefined && (selectedType === 'asset' || selectedType === 'liability') && (
                  <Badge variant={form.watch('is_current') ? 'default' : 'outline'} className="text-xs">
                    {form.watch('is_current') ? 'Current' : 'Non-Current'}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="account_group"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Group</FormLabel>
                      <Select
                        value={field.value || "__none__"}
                        onValueChange={(v) => handleGroupChange(v === "__none__" ? "" : v)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">No group</SelectItem>
                          {availableGroups.map((group) => (
                            <SelectItem key={group.value} value={group.value}>
                              {group.label}
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
                  name="account_sub_group"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub-Group (Optional)</FormLabel>
                      <Select
                        value={field.value || "__none__"}
                        onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                        disabled={availableSubGroups.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sub-group" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">No sub-group</SelectItem>
                          {availableSubGroups.map((subGroup) => (
                            <SelectItem key={subGroup.value} value={subGroup.value}>
                              {subGroup.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator className="my-4" />

            <FormField
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Account (Optional)</FormLabel>
                  <Select
                    value={field.value || "__none__"}
                    onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No parent (top-level)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">No parent (top-level)</SelectItem>
                      {parentOptions.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.code} - {acc.name}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of this account..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="opening_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Balance</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        disabled={hasTransactions}
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    {hasTransactions && (
                      <FormDescription className="text-xs">
                        Cannot change after transactions posted
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="normal_balance"
                render={({ field }) => {
                  const isContraIncome = selectedType === 'income' && field.value === 'debit';
                  const isContraExpense = selectedType === 'expense' && field.value === 'credit';
                  const isContra = isContraIncome || isContraExpense;
                  return (
                    <FormItem>
                      <FormLabel>Normal Balance</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={hasTransactions}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="debit">Debit</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                        </SelectContent>
                      </Select>
                      {isContra && (
                        <FormDescription className="flex items-start gap-1.5 text-amber-600 dark:text-amber-500">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>
                            {isContraIncome
                              ? 'Income accounts are normally credit-balance. Only choose Debit for contra-revenue accounts (Sales Returns, Discounts, Allowances). Otherwise the Profit & Loss total will be wrong.'
                              : 'Expense accounts are normally debit-balance. Only choose Credit for contra-expense accounts (Purchase Discounts, Rebates Received).'}
                          </span>
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

             <Separator className="my-4" />

            {/* T3010 Schedule 6 Mapping (NPO only) */}
            {isNpo && t3010Options.length > 0 && (
              <FormField
                control={form.control}
                name="t3010_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>T3010 Schedule 6 Mapping</FormLabel>
                    <Select
                      value={field.value || "__none__"}
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select T3010 line item" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">No mapping</SelectItem>
                        {t3010Options.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            Line {cat.line} — {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">
                      Maps this account to a CRA T3010 Schedule 6 line item for charity reporting.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator className="my-4" />

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Account Settings</h4>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Header Account</FormLabel>
                  <FormDescription>
                    Header accounts organize sub-accounts and cannot be posted to directly.
                  </FormDescription>
                </div>
                <FormField
                  control={form.control}
                  name="is_header"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={hasTransactions}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Allow Posting</FormLabel>
                  <FormDescription>
                    Disable to prevent journal entries from being posted to this account.
                  </FormDescription>
                </div>
                <FormField
                  control={form.control}
                  name="posting_allowed"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isHeader}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Active Account</FormLabel>
                  <FormDescription>
                    Inactive accounts are hidden from selection lists.
                  </FormDescription>
                </div>
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateAccount.isPending}>
                {updateAccount.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
