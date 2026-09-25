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
import { useCreateAccount, DbAccount, AccountType, AccountClass, AccountGroup, AccountSubGroup } from '@/hooks/useAccounts';
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
  // Enhanced classification
  account_class: z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']).optional(),
  account_group: z.string().optional(),
  account_sub_group: z.string().optional().nullable(),
  is_current: z.boolean().default(true),
  posting_allowed: z.boolean().default(true),
  t3010_category: z.string().optional().nullable(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  existingAccounts: DbAccount[];
  defaultParentId?: string;
  defaultAccountType?: AccountType;
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

// Account groups by type
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
    { value: 'Operating Revenue', label: 'Operating Revenue (4xxx)' },
    { value: 'Non-operating Income', label: 'Non-operating Income (7xxx)' },
  ],
  expense: [
    { value: 'Cost of Sales', label: 'Cost of Sales (5xxx)' },
    { value: 'Operating Expense', label: 'Operating Expense (6xxx)' },
    { value: 'Non-operating Expense', label: 'Non-operating Expense (8xxx)' },
    { value: 'Income Tax Expense', label: 'Income Tax Expense (9xxx)' },
  ],
};

// Sub-groups by group
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
  'Non-operating Income': [
    { value: 'Interest Income', label: 'Interest Income' },
    { value: 'Government Grants', label: 'Government Grants' },
    { value: 'Foreign Exchange Gain', label: 'Foreign Exchange Gain' },
    { value: 'Gain on Disposal of Assets', label: 'Gain on Disposal of Assets' },
    { value: 'Investment Income', label: 'Investment Income' },
    { value: 'Insurance Recoveries', label: 'Insurance Recoveries' },
    { value: 'Dividend Income', label: 'Dividend Income' },
    { value: 'Miscellaneous Income', label: 'Miscellaneous Income' },
  ],
  'Cost of Goods Sold': [
    { value: 'Direct Costs', label: 'Direct Costs' },
  ],
  'Cost of Sales': [
    { value: 'Direct Costs', label: 'Direct Costs' },
    { value: 'Purchases', label: 'Purchases' },
    { value: 'Freight & Shipping', label: 'Freight & Shipping' },
    { value: 'Inventory Adjustments', label: 'Inventory Adjustments' },
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
  'Non-operating Expense': [
    { value: 'Interest Expense', label: 'Interest Expense' },
    { value: 'Foreign Exchange Loss', label: 'Foreign Exchange Loss' },
    { value: 'Loss on Disposal of Assets', label: 'Loss on Disposal of Assets' },
    { value: 'Bank Charges', label: 'Bank Charges' },
    { value: 'Miscellaneous Expense', label: 'Miscellaneous Expense' },
  ],
  'Income Tax Expense': [
    { value: 'Current Income Tax', label: 'Current Income Tax' },
    { value: 'Deferred Income Tax', label: 'Deferred Income Tax' },
  ],
};

// ASPE code-prefix convention by account group. Drives the helper hint
// under Account Code and the auto-suggest when a group is selected.
const codePrefixByGroup: Partial<Record<string, { prefix: string; label: string }>> = {
  'Current Asset': { prefix: '1', label: 'Assets start with 1' },
  'Fixed Asset': { prefix: '1', label: 'Assets start with 1' },
  'Other Non-Current Asset': { prefix: '1', label: 'Assets start with 1' },
  'Current Liability': { prefix: '2', label: 'Liabilities start with 2' },
  'Long-Term Liability': { prefix: '2', label: 'Liabilities start with 2' },
  'Shareholders Equity': { prefix: '3', label: 'Equity accounts start with 3' },
  'Retained Earnings': { prefix: '3', label: 'Equity accounts start with 3' },
  'Operating Revenue': { prefix: '4', label: 'Operating Revenue starts with 4' },
  'Other Revenue': { prefix: '7', label: 'Other / Non-operating Revenue starts with 7' },
  'Non-operating Income': { prefix: '7', label: 'Non-operating Income starts with 7 (e.g. 7100 Government Grants)' },
  'Cost of Goods Sold': { prefix: '5', label: 'Cost of Sales starts with 5' },
  'Cost of Sales': { prefix: '5', label: 'Cost of Sales starts with 5' },
  'Operating Expense': { prefix: '6', label: 'Operating Expenses start with 6' },
  'Other Expense': { prefix: '8', label: 'Non-operating Expenses start with 8' },
  'Non-operating Expense': { prefix: '8', label: 'Non-operating Expenses start with 8' },
  'Income Tax Expense': { prefix: '9', label: 'Income Tax Expense starts with 9' },
};

export function AddAccountDialog({
  open,
  onOpenChange,
  organizationId,
  existingAccounts,
  defaultParentId,
  defaultAccountType,
}: AddAccountDialogProps) {
  const createAccount = useCreateAccount();
  const { isNpo } = useNpoTerminology();
  const initialType = defaultAccountType || 'asset';
  
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: '',
      name: '',
      account_type: initialType,
      parent_id: defaultParentId || '',
      description: '',
      is_header: false,
      normal_balance: normalBalanceByType[initialType],
      opening_balance: 0,
      account_class: accountClassByType[initialType],
      account_group: accountGroupsByType[initialType][0]?.value || 'Current Asset',
      account_sub_group: null,
      is_current: accountGroupsByType[initialType][0]?.isCurrent ?? true,
      posting_allowed: true,
      t3010_category: null,
    },
  });

  // Reset form when dialog opens with new defaults
  const resetFormWithDefaults = () => {
    const type = defaultAccountType || 'asset';
    form.reset({
      code: '',
      name: '',
      account_type: type,
      parent_id: defaultParentId || '',
      description: '',
      is_header: false,
      normal_balance: normalBalanceByType[type],
      opening_balance: 0,
      account_class: accountClassByType[type],
      account_group: accountGroupsByType[type][0]?.value || 'Current Asset',
      account_sub_group: null,
      is_current: accountGroupsByType[type][0]?.isCurrent ?? true,
      posting_allowed: true,
      t3010_category: null,
    });
  };

  const selectedType = form.watch('account_type');
  const selectedGroup = form.watch('account_group') as AccountGroup | undefined;
  const isHeader = form.watch('is_header');
  const t3010Options = isNpo ? getT3010CategoriesForAccountType(selectedType) : [];
  // Get available groups for selected type
  const availableGroups = accountGroupsByType[selectedType] || [];
  
  // Get available sub-groups for selected group
  const availableSubGroups = selectedGroup ? subGroupsByGroup[selectedGroup] || [] : [];
  
  // Filter parent accounts by selected type (headers of same type)
  const parentOptions = existingAccounts.filter(
    (acc) => acc.account_type === selectedType && acc.is_header
  );

  // Update fields when type changes
  const handleTypeChange = (value: AccountType) => {
    form.setValue('account_type', value);
    form.setValue('normal_balance', normalBalanceByType[value]);
    form.setValue('account_class', accountClassByType[value]);
    form.setValue('parent_id', '');
    
    // Set default group
    const groups = accountGroupsByType[value];
    if (groups.length > 0) {
      form.setValue('account_group', groups[0].value);
      form.setValue('is_current', groups[0].isCurrent ?? true);
    }
    form.setValue('account_sub_group', null);
    form.setValue('t3010_category', null);
  };

  // Update is_current when group changes and auto-suggest ASPE code prefix
  const handleGroupChange = (value: string) => {
    form.setValue('account_group', value);
    form.setValue('account_sub_group', null);

    const group = availableGroups.find(g => g.value === value);
    if (group && group.isCurrent !== undefined) {
      form.setValue('is_current', group.isCurrent);
    }

    // Auto-prefill code prefix when the code field is empty
    const currentCode = (form.getValues('code') || '').trim();
    const hint = codePrefixByGroup[value];
    if (hint && currentCode === '') {
      form.setValue('code', hint.prefix);
    }
  };

  // Update posting_allowed when is_header changes
  useEffect(() => {
    if (isHeader) {
      form.setValue('posting_allowed', false);
    }
  }, [isHeader, form]);

  const onSubmit = async (values: AccountFormValues) => {
    await createAccount.mutateAsync({
      organizationId,
      account: {
        code: values.code,
        name: values.name,
        account_type: values.account_type,
        parent_id: values.parent_id || null,
        description: values.description,
        is_header: values.is_header,
        normal_balance: values.normal_balance,
        opening_balance: values.opening_balance,
        account_class: values.account_class as AccountClass,
        account_group: values.account_group as AccountGroup,
        account_sub_group: values.account_sub_group as AccountSubGroup,
        is_current: values.is_current,
        posting_allowed: values.posting_allowed,
        t3010_category: values.t3010_category || null,
      },
    });
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
          <DialogDescription>
            Create a new account with enhanced classification for accurate financial reporting.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => {
                  const hint = selectedGroup ? codePrefixByGroup[selectedGroup] : undefined;
                  return (
                    <FormItem>
                      <FormLabel>Account Code</FormLabel>
                      <FormControl>
                        <Input placeholder="1-01-101" {...field} />
                      </FormControl>
                      {hint && (
                        <FormDescription className="text-xs">
                          ASPE: {hint.label}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
            
            {/* Enhanced Classification Section */}
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

            {/* Parent Account */}
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
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_header"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Header Account</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Can have sub-accounts
                      </p>
                    </div>
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

            {/* Posting Control */}
            <FormField
              control={form.control}
              name="posting_allowed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="flex items-center gap-2">
                      Allow Direct Posting
                      {isHeader && (
                        <Badge variant="outline" className="text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Disabled for headers
                        </Badge>
                      )}
                    </FormLabel>
                    <FormDescription className="text-xs">
                      If disabled, transactions must be posted to sub-accounts
                    </FormDescription>
                  </div>
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

            {/* Validation Info */}
            {selectedType === 'asset' && !form.watch('is_current') && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Fixed Asset Reminder</p>
                  <p className="text-muted-foreground text-xs">
                    Fixed assets should be registered in the Asset Register for proper depreciation tracking.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createAccount.isPending}>
                {createAccount.isPending ? 'Creating...' : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}