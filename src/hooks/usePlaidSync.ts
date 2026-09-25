import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { BankAccount } from './useBankAccounts';

interface SyncResult {
  accountId: string;
  synced: number;
  skipped: number;
  errors: number;
}

export function usePlaidSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  /**
   * Sync transactions for a single Plaid-connected bank account.
   * Reads the stored plaid_access_token from the bank account record and
   * pulls the last 30 days of transactions into bank_transactions.
   */
  const syncAccount = async (account: BankAccount): Promise<SyncResult> => {
    if (!account.plaid_access_token) {
      throw new Error(`Account "${account.name}" has no Plaid connection. Connect via Plaid first.`);
    }

    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    // Call the edge function to fetch transactions from Plaid
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) throw new Error('Not authenticated');

    const response = await supabase.functions.invoke('ai-bank-connect', {
      body: {
        action: 'sync_account',
        accessToken: account.plaid_access_token,
        startDate,
        endDate,
      },
    });

    if (response.error) throw new Error(response.error.message || 'Sync failed');

    const syncData = response.data;
    if (syncData?.requires_reauth) {
      throw new Error(`Bank connection for "${account.name}" needs to be re-authenticated. Open Plaid and reconnect this account to resume syncing.`);
    }
    if (!syncData?.transactions) throw new Error(syncData?.error || 'No transactions returned');


    const plaidTransactions: Array<{
      id: string;
      date: string;
      description: string;
      amount: number;
      type: string;
      category: string;
      merchantName?: string;
      pending?: boolean;
    }> = syncData.transactions;

    // Fetch existing transaction IDs to avoid duplicates
    const { data: existingTxns } = await supabase
      .from('bank_transactions')
      .select('reference')
      .eq('bank_account_id', account.id)
      .gte('transaction_date', startDate);

    const existingRefs = new Set((existingTxns || []).map((t) => t.reference));

    // Filter to only new transactions
    const newTransactions = plaidTransactions.filter(
      (txn) => !existingRefs.has(`PLAID-${txn.id}`)
    );

    if (newTransactions.length === 0) {
      return { accountId: account.id, synced: 0, skipped: plaidTransactions.length, errors: 0 };
    }

    // Map Plaid transactions to bank_transactions schema
    // Note: organization_id is NOT a column in bank_transactions — omit it
    const rows = newTransactions.map((txn) => ({
      bank_account_id: account.id,
      transaction_date: txn.date,
      description: txn.description || txn.merchantName || 'Unnamed transaction',
      amount: Math.abs(txn.amount),
      transaction_type: txn.amount < 0 ? 'deposit' : 'withdrawal', // Plaid: negative = money in
      status: txn.pending ? 'pending' : 'unmatched',
      reference: `PLAID-${txn.id}`,
      category: txn.category || null,
      memo: txn.merchantName || null,
      is_cleared: !txn.pending,
    }));

    let errors = 0;
    // Insert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from('bank_transactions').insert(batch);
      if (error) {
        console.error('Batch insert error:', error);
        toast.warning(`Some transactions failed to import: ${error.message}`);
        errors += batch.length;
      }
    }

    const synced = rows.length - errors;

    // Update sync tracking columns on the bank account
    await supabase
      .from('bank_accounts')
      .update({
        plaid_last_synced_at: new Date().toISOString(),
        plaid_sync_status: errors > 0 ? 'partial' : 'ok',
        plaid_sync_error: errors > 0 ? `${errors} row(s) failed to insert` : null,
      })
      .eq('id', account.id);

    return {
      accountId: account.id,
      synced,
      skipped: plaidTransactions.length - newTransactions.length,
      errors,
    };
  };

  /**
   * Sync a single account by ID — used for the per-account "Sync Transactions" button.
   */
  const syncOne = async (account: BankAccount) => {
    if (!account.plaid_access_token) {
      toast.error(`No Plaid connection for "${account.name}". Connect via Plaid first.`);
      return;
    }

    setSyncingAccountId(account.id);
    try {
      const result = await syncAccount(account);
      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });

      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} new transaction${result.synced !== 1 ? 's' : ''} for "${account.name}"`);
      } else {
        toast.info(`"${account.name}" is up to date — no new transactions in the last 30 days.`);
      }
    } catch (err: any) {
      toast.error(`Sync failed for "${account.name}": ${err.message}`);
    } finally {
      setSyncingAccountId(null);
    }
  };

  /**
   * Sync all Plaid-connected accounts in the list.
   */
  const syncAll = async (accounts: BankAccount[]) => {
    const connected = accounts.filter((a) => !!a.plaid_access_token);

    if (connected.length === 0) {
      toast.info('No Plaid-connected accounts found. Connect a bank via Plaid first.');
      return;
    }

    setIsSyncing(true);
    const toastId = toast.loading(`Syncing ${connected.length} account${connected.length !== 1 ? 's' : ''}…`);

    let totalSynced = 0;
    let totalErrors = 0;

    for (const account of connected) {
      try {
        const result = await syncAccount(account);
        totalSynced += result.synced;
        totalErrors += result.errors;
      } catch (err: any) {
        console.error(`Sync error for ${account.name}:`, err);
        totalErrors++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });

    toast.dismiss(toastId);

    if (totalErrors > 0) {
      toast.warning(`Sync complete — ${totalSynced} new transactions imported, ${totalErrors} error(s).`);
    } else if (totalSynced > 0) {
      toast.success(`Sync complete — ${totalSynced} new transaction${totalSynced !== 1 ? 's' : ''} imported across ${connected.length} account${connected.length !== 1 ? 's' : ''}.`);
    } else {
      toast.info('All accounts are up to date — no new transactions found.');
    }

    setIsSyncing(false);
  };

  return { syncOne, syncAll, isSyncing, syncingAccountId };
}
