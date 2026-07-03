import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { createJournalEntry } from './useJournalEntryCreation';

export interface BankAccount {
  id: string;
  organization_id: string;
  name: string;
  institution: string;
  institution_type: 'bank' | 'mobile_money' | 'ewallet' | 'microfinance' | 'other';
  institution_code: string | null;
  account_number: string | null;
  currency: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  last_reconciled_at: string | null;
  last_reconciled_balance: number | null;
  gl_account_id: string | null;
  opening_date: string | null;
  plaid_access_token?: string | null;
  plaid_item_id?: string | null;
  plaid_account_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBankAccountInput {
  name: string;
  institution: string;
  institution_type?: 'bank' | 'mobile_money' | 'ewallet' | 'microfinance' | 'other';
  institution_code?: string;
  account_number?: string;
  currency: string;
  opening_balance: number;
  opening_date?: string;
  gl_account_id?: string;
  plaid_access_token?: string;
  plaid_item_id?: string;
  plaid_account_id?: string;
}

/**
 * Find the Owner's Capital or Opening Balance Equity account for opening balance entries
 */
async function findEquityAccount(organizationId: string): Promise<string | null> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('organization_id', organizationId)
    .eq('account_type', 'equity')
    .eq('is_header', false)
    .eq('is_active', true);

  if (!accounts || accounts.length === 0) return null;

  // Priority: Opening Balance Equity > Owner's Capital > Retained Earnings > any equity
  const priorities = [
    (a: { name: string }) => a.name.toLowerCase().includes('opening balance'),
    (a: { name: string }) => a.name.toLowerCase().includes('capital'),
    (a: { name: string }) => a.name.toLowerCase().includes('retained'),
  ];

  for (const check of priorities) {
    const found = accounts.find(check);
    if (found) return found.id;
  }

  return accounts[0]?.id || null;
}

/**
 * Generate next opening balance reference number
 */
async function getNextOBReference(organizationId: string): Promise<string> {
  const { data: lastEntry } = await supabase
    .from('journal_entries')
    .select('reference')
    .eq('organization_id', organizationId)
    .ilike('reference', 'OB-%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (lastEntry && lastEntry.length > 0) {
    const match = lastEntry[0].reference.match(/OB-(\d+)/);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `OB-${String(nextNum).padStart(4, '0')}`;
    }
  }
  return 'OB-0001';
}

/**
 * Calculate cumulative balance per GAAP from GL journal entries
 * This is the source of truth for bank account balance when a GL account is linked
 * 
 * IMPORTANT: The GL account balance already includes the opening balance that was
 * posted via journal entry when the bank account was created. We should NOT add
 * the opening balance again - just return the GL balance directly.
 */
async function calculateBalanceFromGL(glAccountId: string): Promise<number> {
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('current_balance')
    .eq('id', glAccountId)
    .single();

  if (accountError || !account) {
    console.warn('Could not fetch GL account balance:', accountError?.message);
    return 0;
  }

  // Return the GL balance directly - it already includes opening balance from journal entry
  return Number(account.current_balance) || 0;
}

/**
 * Calculate cumulative balance per GAAP: Opening Balance + All Transactions
 * Falls back to transaction-based calculation when no GL account is linked
 */
async function calculateCumulativeBalance(
  bankAccountId: string,
  openingBalance: number,
  glAccountId: string | null
): Promise<number> {
  // If a GL account is linked, use its balance as the source of truth
  // The GL balance already includes the opening balance (posted via journal entry)
  if (glAccountId) {
    return calculateBalanceFromGL(glAccountId);
  }

  // Fallback: calculate from bank_transactions if no GL account linked
  const { data: transactions } = await supabase
    .from('bank_transactions')
    .select('amount, transaction_type')
    .eq('bank_account_id', bankAccountId);

  if (!transactions || transactions.length === 0) {
    return openingBalance;
  }

  // Sum all transactions: deposits add, withdrawals subtract
  const transactionTotal = transactions.reduce((sum, t) => {
    const amount = Math.abs(Number(t.amount));
    return t.transaction_type === 'deposit' ? sum + amount : sum - amount;
  }, 0);

  return openingBalance + transactionTotal;
}

export function useBankAccounts() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading, error } = useQuery({
    queryKey: ['bank-accounts', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;

      // Calculate cumulative balance for each account per GAAP
      const accountsWithCumulativeBalance = await Promise.all(
        (data as BankAccount[]).map(async (account) => {
          const cumulativeBalance = await calculateCumulativeBalance(
            account.id,
            account.opening_balance,
            account.gl_account_id
          );
          return { ...account, current_balance: cumulativeBalance };
        })
      );

      return accountsWithCumulativeBalance;
    },
    enabled: !!organization?.id,
  });

  const createAccount = useMutation({
    mutationFn: async (input: CreateBankAccountInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const openingDate = input.opening_date || new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert({
          organization_id: organization.id,
          name: input.name,
          institution: input.institution,
          institution_type: input.institution_type || 'bank',
          institution_code: input.institution_code || null,
          account_number: input.account_number || null,
          currency: input.currency,
          opening_balance: input.opening_balance,
          current_balance: input.opening_balance,
          opening_date: openingDate,
          gl_account_id: input.gl_account_id || null,
          plaid_access_token: input.plaid_access_token || null,
          plaid_item_id: input.plaid_item_id || null,
          plaid_account_id: input.plaid_account_id || null,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Create opening balance journal entry if GL account is linked and opening balance > 0
      if (input.gl_account_id && input.opening_balance > 0) {
        const equityAccountId = await findEquityAccount(organization.id);
        
        if (equityAccountId) {
          const reference = await getNextOBReference(organization.id);
          
          await createJournalEntry({
            organizationId: organization.id,
            date: openingDate,
            description: `Opening Balance - ${input.name}`,
            reference,
            lines: [
              { account_id: input.gl_account_id, debit: input.opening_balance, credit: 0, memo: `Opening balance - ${input.name}` },
              { account_id: equityAccountId, debit: 0, credit: input.opening_balance, memo: 'Opening balance equity' },
            ],
            status: 'posted',
          });
        } else {
          console.warn('No equity account found for opening balance entry');
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast.success('Bank account created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create bank account: ' + error.message);
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BankAccount> & { id: string }) => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Bank account updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update bank account: ' + error.message);
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Bank account removed');
    },
    onError: (error) => {
      toast.error('Failed to remove bank account: ' + error.message);
    },
  });

  const totalBalance = accounts
    .filter(a => a.currency === 'CAD')
    .reduce((sum, a) => sum + Number(a.current_balance), 0);

  return {
    accounts,
    isLoading,
    error,
    totalBalance,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}
