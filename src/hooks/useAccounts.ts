import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

// Enhanced classification types
export type AccountClass = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export type AccountGroup = 
  | 'Current Asset' | 'Fixed Asset' | 'Other Non-Current Asset'
  | 'Current Liability' | 'Long-Term Liability'
  | 'Shareholders Equity' | 'Retained Earnings'
  | 'Operating Revenue' | 'Other Revenue' | 'Non-operating Income'
  | 'Cost of Goods Sold' | 'Cost of Sales'
  | 'Operating Expense' | 'Other Expense'
  | 'Non-operating Expense' | 'Income Tax Expense';
export type AccountSubGroup = 
  | 'Cash' | 'Accounts Receivable' | 'Inventory' | 'Prepaid Expenses' | 'Other Current Assets'
  | 'Property Plant Equipment' | 'Intangible Assets' | 'Long-Term Investments'
  | 'Accounts Payable' | 'Accrued Liabilities' | 'Taxes Payable' | 'Deferred Revenue' | 'Short-Term Loans'
  | 'Long-Term Loans' | 'Lease Liabilities' | 'Deferred Tax Liabilities'
  | 'Capital Stock' | 'Additional Paid-In Capital' | 'Retained Earnings' | 'Dividends'
  | 'Sales' | 'Service Revenue' | 'Interest Income' | 'Other Income'
  | 'Government Grants' | 'Foreign Exchange Gain' | 'Gain on Disposal of Assets'
  | 'Investment Income' | 'Insurance Recoveries' | 'Dividend Income' | 'Miscellaneous Income'
  | 'Direct Costs' | 'Purchases' | 'Freight & Shipping' | 'Inventory Adjustments'
  | 'Payroll' | 'Rent' | 'Utilities' | 'Professional Fees' | 'Depreciation' | 'Other Expenses'
  | 'Interest Expense' | 'Foreign Exchange Loss' | 'Loss on Disposal of Assets'
  | 'Bank Charges' | 'Miscellaneous Expense'
  | 'Current Income Tax' | 'Deferred Income Tax'
  | null;

export interface DbAccount {
  id: string;
  organization_id: string | null;
  code: string;
  name: string;
  account_type: AccountType;
  parent_id: string | null;
  description: string | null;
  is_header: boolean;
  is_active: boolean;
  normal_balance: string;
  opening_balance: number;
  current_balance: number;
  created_at: string;
  updated_at: string;
  // Enhanced classification fields
  account_class: AccountClass | null;
  account_group: AccountGroup | null;
  account_sub_group: AccountSubGroup | null;
  is_current: boolean;
  posting_allowed: boolean;
  t3010_category: string | null;
}

export interface AccountInput {
  code: string;
  name: string;
  account_type: AccountType;
  parent_id?: string | null;
  description?: string;
  is_header?: boolean;
  normal_balance?: 'debit' | 'credit';
  opening_balance?: number;
  // Enhanced classification fields
  account_class?: AccountClass;
  account_group?: AccountGroup;
  account_sub_group?: AccountSubGroup | null;
  is_current?: boolean;
  posting_allowed?: boolean;
  t3010_category?: string | null;
  is_active?: boolean;
}

export function useAccounts(organizationId?: string) {
  return useQuery({
    queryKey: ['accounts', organizationId],
    queryFn: async () => {
      let query = supabase
        .from('accounts')
        .select('*')
        .order('code', { ascending: true });
      
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as DbAccount[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ organizationId, account }: { organizationId: string; account: AccountInput }) => {
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          organization_id: organizationId,
          code: account.code,
          name: account.name,
          account_type: account.account_type,
          parent_id: account.parent_id || null,
          description: account.description || null,
          is_header: account.is_header || false,
          normal_balance: account.normal_balance || 'debit',
          opening_balance: account.opening_balance || 0,
          current_balance: account.opening_balance || 0,
          // Enhanced classification fields
          account_class: account.account_class || null,
          account_group: account.account_group || null,
          account_sub_group: account.account_sub_group || null,
          is_current: account.is_current ?? true,
          posting_allowed: account.posting_allowed ?? !account.is_header,
          t3010_category: account.t3010_category || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['accounts', organizationId] });
      toast.success('Account created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create account: ${error.message}`);
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates, organizationId }: { id: string; updates: Partial<AccountInput>; organizationId: string }) => {
      const { data, error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['accounts', organizationId] });
      toast.success('Account updated successfully');
    },
    onError: (error: Error) => {
      console.error('[useUpdateAccount] failed:', error);
      toast.error(`Failed to update account: ${error.message}`);
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, organizationId }: { id: string; organizationId: string }) => {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['accounts', organizationId] });
      toast.success('Account deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete account: ${error.message}`);
    },
  });
}

// Helper to build hierarchical structure from flat data
export function buildAccountTree(accounts: DbAccount[]): DbAccount[] {
  const accountMap = new Map<string, DbAccount & { children?: DbAccount[] }>();
  const roots: (DbAccount & { children?: DbAccount[] })[] = [];
  
  // First pass: create a map of all accounts
  accounts.forEach(account => {
    accountMap.set(account.id, { ...account, children: [] });
  });
  
  // Second pass: build the tree
  accounts.forEach(account => {
    const node = accountMap.get(account.id)!;
    if (account.parent_id && accountMap.has(account.parent_id)) {
      accountMap.get(account.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  
  return roots;
}
