import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCard } from './useCreditCards';

interface SyncResult {
  cardId: string;
  synced: number;
  skipped: number;
  errors: number;
}

/**
 * Sync transactions for a Plaid-connected credit card. Mirrors usePlaidSync
 * but writes to credit_card_transactions and uses Plaid sign convention:
 * Plaid amount > 0 => purchase (charge); < 0 => refund/payment (credit).
 */
export function useCreditCardPlaidSync() {
  const [syncingCardId, setSyncingCardId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const syncCard = async (card: CreditCard & { plaid_access_token?: string | null }): Promise<SyncResult> => {
    if (!card.plaid_access_token) {
      throw new Error(`Card "${card.name}" has no Plaid connection.`);
    }

    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    const response = await supabase.functions.invoke('ai-bank-connect', {
      body: {
        action: 'sync_account',
        accessToken: card.plaid_access_token,
        startDate,
        endDate,
      },
    });

    if (response.error) throw new Error(response.error.message || 'Sync failed');
    const syncData = response.data;
    if (syncData?.requires_reauth) {
      throw new Error(`Credit card "${card.name}" needs to be re-authenticated with Plaid. Reconnect the card to resume syncing.`);
    }
    if (!syncData?.transactions) throw new Error(syncData?.error || 'No transactions returned');


    const plaidTransactions: any[] = syncData.transactions;

    const { data: existingTxns } = await supabase
      .from('credit_card_transactions')
      .select('reference')
      .eq('credit_card_id', card.id)
      .gte('transaction_date', startDate);

    const existingRefs = new Set((existingTxns || []).map((t: any) => t.reference));
    const newTransactions = plaidTransactions.filter((txn) => !existingRefs.has(`PLAID-${txn.id}`));

    if (newTransactions.length === 0) {
      return { cardId: card.id, synced: 0, skipped: plaidTransactions.length, errors: 0 };
    }

    // ai-bank-connect already inverts Plaid sign:
    // - Plaid raw positive (purchase) becomes amount < 0 here -> 'withdrawal'
    // - Plaid raw negative (refund) becomes amount > 0 here -> 'deposit'
    // For credit cards: withdrawal = charge, deposit = payment/credit
    const rows = newTransactions.map((txn) => ({
      credit_card_id: card.id,
      transaction_date: txn.date,
      description: txn.description || txn.merchantName || 'Unnamed transaction',
      amount: Math.abs(txn.amount),
      transaction_type: txn.amount < 0 ? 'charge' : 'payment',
      status: txn.pending ? 'pending' : 'pending',
      reference: `PLAID-${txn.id}`,
      category: txn.category || null,
      payee_payor: txn.merchantName || null,
      is_cleared: !txn.pending,
      imported_at: new Date().toISOString(),
    }));

    let errors = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase.from('credit_card_transactions').insert(batch);
      if (error) {
        console.error('CC batch insert error:', error);
        toast.warning(`Some transactions failed to import: ${error.message}`);
        errors += batch.length;
      }
    }

    const synced = rows.length - errors;

    await supabase
      .from('credit_cards')
      .update({
        plaid_last_synced_at: new Date().toISOString(),
        plaid_sync_status: errors > 0 ? 'partial' : 'ok',
        plaid_sync_error: errors > 0 ? `${errors} row(s) failed to insert` : null,
      })
      .eq('id', card.id);

    return { cardId: card.id, synced, skipped: plaidTransactions.length - newTransactions.length, errors };
  };

  const syncOne = async (card: CreditCard & { plaid_access_token?: string | null }) => {
    if (!card.plaid_access_token) {
      toast.error(`No Plaid connection for "${card.name}". Connect via Plaid first.`);
      return;
    }
    setSyncingCardId(card.id);
    try {
      const result = await syncCard(card);
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} new transaction${result.synced !== 1 ? 's' : ''} for "${card.name}"`);
      } else {
        toast.info(`"${card.name}" is up to date.`);
      }
    } catch (err: any) {
      toast.error(`Sync failed for "${card.name}": ${err.message}`);
    } finally {
      setSyncingCardId(null);
    }
  };

  return { syncOne, syncingCardId };
}
