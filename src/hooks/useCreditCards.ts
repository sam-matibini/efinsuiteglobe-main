import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { createJournalEntry } from './useJournalEntryCreation';
import { reverseLinkedJournalEntry, recalculateAndInvalidate } from './useGLPropagation';
import { parseLocalDate } from '@/lib/utils';

export interface CreditCard {
  id: string;
  organization_id: string;
  name: string;
  issuer: string;
  card_number: string | null;
  credit_limit: number;
  currency: string;
  opening_balance: number;
  current_balance: number;
  statement_closing_day: number;
  payment_due_day: number;
  is_active: boolean;
  last_reconciled_at: string | null;
  last_reconciled_balance: number | null;
  gl_account_id: string | null;
  opening_date: string | null;
  plaid_access_token?: string | null;
  plaid_account_id?: string | null;
  plaid_item_id?: string | null;
  plaid_last_synced_at?: string | null;
  plaid_sync_status?: string | null;
  plaid_sync_error?: string | null;
  routing_number?: string | null;
  ach_verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCreditCardInput {
  name: string;
  issuer: string;
  card_number?: string;
  credit_limit?: number;
  currency: string;
  opening_balance: number;
  opening_date?: string;
  statement_closing_day?: number;
  payment_due_day?: number;
  gl_account_id?: string;
  plaid_access_token?: string | null;
  plaid_account_id?: string | null;
  plaid_item_id?: string | null;
  routing_number?: string | null;
  ach_verified_at?: string | null;
}

export interface CreditCardTransaction {
  id: string;
  credit_card_id: string;
  transaction_date: string;
  posted_date: string | null;
  description: string;
  amount: number;
  transaction_type: string;
  category: string | null;
  merchant_category_code: string | null;
  payee_payor: string | null;
  memo: string | null;
  reference: string | null;
  is_cleared: boolean;
  cleared_at: string | null;
  gl_account_id: string | null;
  journal_entry_id: string | null;
  status: string;
  imported_at: string | null;
  department_id?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Find the offset account for a credit card opening balance.
 *
 * ASPE/GAAP: A credit-card opening balance represents amounts already spent by
 * (or on behalf of) the shareholder/owner via a corporate card. The
 * bookkeeping is:
 *   Dr. Due to Shareholders  (reduce what the company owes the shareholder,
 *                             OR debit Shareholder Loan Receivable)
 *   Cr. Credit Card Liability (establish opening balance)
 *
 * We therefore route the offset to a "Due to Shareholders" / "Shareholder
 * Loan" liability account — NEVER to Retained Earnings, which would distort
 * equity and produce a non-CoA "Other deduction" on the Statement of
 * Retained Earnings.
 */
async function findEquityAdjustmentAccount(organizationId: string): Promise<string | null> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name, account_type')
    .eq('organization_id', organizationId)
    .eq('is_header', false)
    .eq('is_active', true)
    .in('account_type', ['liability', 'equity']);

  if (!accounts || accounts.length === 0) return null;

  const nameMatches = (a: { name: string }, needles: string[]) =>
    needles.some(n => a.name.toLowerCase().includes(n));

  // Priority order — shareholder-related liability first, then owner
  // contribution equity, then a generic opening-balance clearing account.
  const priorities: Array<(a: { name: string; account_type: string }) => boolean> = [
    (a) => a.account_type === 'liability' && nameMatches(a, ['due to shareholder', 'shareholder loan', 'loan from shareholder', 'due to owner']),
    (a) => a.account_type === 'liability' && nameMatches(a, ['shareholder', 'director loan', 'owner']),
    (a) => a.account_type === 'equity' && nameMatches(a, ['owner contribution', "owner's contribution", 'owner capital', "owner's capital", 'proprietor']),
    (a) => a.account_type === 'equity' && nameMatches(a, ['opening balance']),
  ];

  for (const check of priorities) {
    const found = accounts.find(check);
    if (found) return found.id;
  }

  return null;
}


/**
 * Generate next credit card opening balance reference number
 */
async function getNextCCOBReference(organizationId: string): Promise<string> {
  const { data: lastEntry } = await supabase
    .from('journal_entries')
    .select('reference')
    .eq('organization_id', organizationId)
    .ilike('reference', 'CC-OB-%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (lastEntry && lastEntry.length > 0) {
    const match = lastEntry[0].reference.match(/CC-OB-(\d+)/);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `CC-OB-${String(nextNum).padStart(4, '0')}`;
    }
  }
  return 'CC-OB-0001';
}

/**
 * Calculate cumulative balance: Opening Balance + All Transactions
 */
async function calculateCumulativeBalance(creditCardId: string, openingBalance: number): Promise<number> {
  const { data: transactions } = await supabase
    .from('credit_card_transactions')
    .select('amount, transaction_type')
    .eq('credit_card_id', creditCardId);

  if (!transactions || transactions.length === 0) {
    return openingBalance;
  }

  // Sum all transactions: charges add to balance, payments reduce balance
  const transactionTotal = transactions.reduce((sum, t) => {
    const amount = Math.abs(Number(t.amount));
    // charges/fees/interest increase liability, payments decrease it
    if (t.transaction_type === 'payment' || t.transaction_type === 'credit') {
      return sum - amount;
    }
    return sum + amount;
  }, 0);

  return openingBalance + transactionTotal;
}

export function useCreditCards() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: creditCards = [], isLoading, error } = useQuery({
    queryKey: ['credit-cards', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;

      // Calculate cumulative balance for each card
      const cardsWithBalance = await Promise.all(
        (data as CreditCard[]).map(async (card) => {
          const cumulativeBalance = await calculateCumulativeBalance(card.id, card.opening_balance);
          return { ...card, current_balance: cumulativeBalance };
        })
      );

      return cardsWithBalance;
    },
    enabled: !!organization?.id,
  });

  const createCreditCard = useMutation({
    mutationFn: async (input: CreateCreditCardInput) => {
      if (!organization?.id) throw new Error('No organization selected');
      
      const openingDate = input.opening_date || new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('credit_cards')
        .insert({
          organization_id: organization.id,
          name: input.name,
          issuer: input.issuer,
          card_number: input.card_number || null,
          credit_limit: input.credit_limit || 0,
          currency: input.currency,
          opening_balance: input.opening_balance,
          current_balance: input.opening_balance,
          opening_date: openingDate,
          statement_closing_day: input.statement_closing_day || 25,
          payment_due_day: input.payment_due_day || 21,
          gl_account_id: input.gl_account_id || null,
          plaid_access_token: input.plaid_access_token || null,
          plaid_account_id: input.plaid_account_id || null,
          plaid_item_id: input.plaid_item_id || null,
          routing_number: input.routing_number || null,
          ach_verified_at: input.ach_verified_at || null,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Create opening balance journal entry if GL account is linked and opening balance > 0
      // Credit Card opening balance means you OWE money, so:
      // - CREDIT the Credit Card Liability GL account (increases liability)
      // - DEBIT an equity adjustment account (not another liability!)
      if (input.gl_account_id && input.opening_balance > 0) {
        const adjustmentAccountId = await findEquityAdjustmentAccount(organization.id);
        
        if (adjustmentAccountId) {
          const reference = await getNextCCOBReference(organization.id);
          
          await createJournalEntry({
            organizationId: organization.id,
            date: openingDate,
            description: `Opening Balance - ${input.name}`,
            reference,
            lines: [
              // DEBIT equity/adjustment account (decreases equity to balance the new liability)
              { account_id: adjustmentAccountId, debit: input.opening_balance, credit: 0, memo: `CC opening balance adjustment - ${input.name}` },
              // CREDIT the credit card liability (increases what you owe)
              { account_id: input.gl_account_id, debit: 0, credit: input.opening_balance, memo: `Opening balance - ${input.name}` },
            ],
            status: 'posted',
          });
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast.success('Credit card added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add credit card: ' + error.message);
    },
  });

  const updateCreditCard = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CreditCard> & { id: string }) => {
      const { data, error } = await supabase
        .from('credit_cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Credit card updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update credit card: ' + error.message);
    },
  });

  const deleteCreditCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('credit_cards')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      toast.success('Credit card removed');
    },
    onError: (error) => {
      toast.error('Failed to remove credit card: ' + error.message);
    },
  });

  const totalBalance = creditCards
    .filter(c => c.currency === 'CAD')
    .reduce((sum, c) => sum + Number(c.current_balance), 0);

  const totalCreditLimit = creditCards
    .filter(c => c.currency === 'CAD')
    .reduce((sum, c) => sum + Number(c.credit_limit), 0);

  const availableCredit = totalCreditLimit - totalBalance;

  return {
    creditCards,
    isLoading,
    error,
    totalBalance,
    totalCreditLimit,
    availableCredit,
    createCreditCard,
    updateCreditCard,
    deleteCreditCard,
  };
}

export interface ExtendedCreditCardTransaction extends CreditCardTransaction {
  source: 'credit_card_transaction' | 'journal_entry';
  journal_entry_line_id?: string;
}

export function useCreditCardTransactions(creditCardId?: string, glAccountId?: string | null) {
  const queryClient = useQueryClient();
  
  const { data: transactions = [], isLoading, error } = useQuery({
    queryKey: ['credit-card-transactions', creditCardId, glAccountId],
    queryFn: async () => {
      if (!creditCardId) return [];
      
      // Fetch credit card transactions
      const { data: ccTxns, error: ccError } = await supabase
        .from('credit_card_transactions')
        .select('*')
        .eq('credit_card_id', creditCardId)
        .order('transaction_date', { ascending: false });
      
      if (ccError) throw ccError;
      
      const ccTransactions: ExtendedCreditCardTransaction[] = (ccTxns || []).map(t => ({
        ...t,
        source: 'credit_card_transaction' as const,
      }));

      // If GL account is linked, fetch unlinked journal entry lines affecting the GL account
      // These are payments from bank accounts that should appear in the CC transaction list
      if (glAccountId) {
        const { data: journalLines, error: journalError } = await supabase
          .from('journal_entry_lines')
          .select(`
            id,
            journal_entry_id,
            account_id,
            description,
            debit,
            credit,
            journal_entry:journal_entries!inner(
              id,
              reference,
              entry_date,
              description,
              status
            )
          `)
          .eq('account_id', glAccountId);

        if (journalError) throw journalError;

        // Get all CC transactions journal_entry_ids to exclude already-linked entries
        const linkedJournalIds = new Set(
          ccTransactions.filter(t => t.journal_entry_id).map(t => t.journal_entry_id)
        );

        // Convert unlinked journal entries to transaction items
        const journalEntryItems: ExtendedCreditCardTransaction[] = (journalLines || [])
          .filter(line => {
            const je = line.journal_entry as any;
            return je?.status === 'posted' && !linkedJournalIds.has(je.id);
          })
          .map(line => {
            const je = line.journal_entry as any;
            const debit = Number(line.debit) || 0;
            const credit = Number(line.credit) || 0;
            // For liability account: Credit increases (charge), Debit decreases (payment)
            const amount = credit - debit;
            const transactionType = amount >= 0 ? 'charge' : 'payment';
            
            return {
              id: `je-${line.id}`,
              credit_card_id: creditCardId,
              transaction_date: je.entry_date,
              posted_date: je.entry_date,
              description: line.description || je.description || 'Journal Entry',
              amount,
              transaction_type: transactionType,
              category: 'Credit Card Payable',
              merchant_category_code: null,
              payee_payor: line.description || je.description || 'Journal Entry',
              memo: null,
              reference: je.reference,
              is_cleared: false,
              cleared_at: null,
              gl_account_id: glAccountId,
              journal_entry_id: je.id,
              status: 'pending', // Awaiting match with imported credit card statement
              imported_at: null,
              created_at: je.entry_date,
              updated_at: je.entry_date,
              source: 'journal_entry' as const,
              journal_entry_line_id: line.id,
            };
          });

        // Merge and sort all transactions
        const allTransactions = [...ccTransactions, ...journalEntryItems];
        allTransactions.sort((a, b) => parseLocalDate(b.transaction_date).getTime() - parseLocalDate(a.transaction_date).getTime());
        
        return allTransactions;
      }

      return ccTransactions;
    },
    enabled: !!creditCardId,
  });

  // Auto-match logic: find JE-sourced payments that match imported CC payments by amount
  const autoMatchPayments = async (
    importedTransactions: CreditCardTransaction[], 
    existingTransactions: ExtendedCreditCardTransaction[]
  ) => {
    const matchedPairs: { ccTxnId: string; jeTxnId: string; jeLineId: string }[] = [];
    
    // Find JE-sourced pending payments
    const jePendingPayments = existingTransactions.filter(t => 
      t.source === 'journal_entry' && 
      (t.status === 'pending' || !t.status) &&
      t.transaction_type === 'payment'
    );
    
    for (const imported of importedTransactions) {
      if (imported.transaction_type !== 'payment') continue;
      
      const importedAmount = Math.abs(Number(imported.amount));
      
      // Find matching JE payment by amount
      const matchingJE = jePendingPayments.find(je => {
        const jeAmount = Math.abs(Number(je.amount));
        const amountDiff = Math.abs(importedAmount - jeAmount);
        return amountDiff < 0.01; // Exact match within rounding
      });
      
      if (matchingJE && matchingJE.journal_entry_line_id) {
        matchedPairs.push({
          ccTxnId: imported.id,
          jeTxnId: matchingJE.id,
          jeLineId: matchingJE.journal_entry_line_id,
        });
        // Remove from pool to avoid duplicate matches
        const idx = jePendingPayments.indexOf(matchingJE);
        if (idx > -1) jePendingPayments.splice(idx, 1);
      }
    }
    
    // Update matched CC transactions to link to journal entry and set status
    for (const pair of matchedPairs) {
      const jeId = pair.jeTxnId.replace('je-', '');
      await supabase
        .from('credit_card_transactions')
        .update({ 
          journal_entry_id: jeId,
          status: 'matched',
          category: 'Credit Card Payment',
        })
        .eq('id', pair.ccTxnId);
    }
    
    return matchedPairs.length;
  };

  const importTransactions = useMutation({
    mutationFn: async (newTransactions: Omit<CreditCardTransaction, 'id' | 'created_at' | 'updated_at'>[]) => {
      if (!creditCardId || newTransactions.length === 0) {
        return { imported: [], matchCount: 0, duplicates: 0 };
      }
      
      // Fetch existing transactions for duplicate detection
      const { data: existingTxns } = await supabase
        .from('credit_card_transactions')
        .select('transaction_date, description, amount, reference')
        .eq('credit_card_id', creditCardId);
      
      const existingSet = new Set(
        (existingTxns || []).map(t => 
          `${t.transaction_date}|${t.description?.toLowerCase().trim()}|${Math.abs(Number(t.amount)).toFixed(2)}|${t.reference || ''}`
        )
      );
      
      // Filter out duplicates
      const uniqueTransactions = newTransactions.filter(t => {
        const key = `${t.transaction_date}|${t.description?.toLowerCase().trim()}|${Math.abs(Number(t.amount)).toFixed(2)}|${t.reference || ''}`;
        return !existingSet.has(key);
      });
      
      const duplicateCount = newTransactions.length - uniqueTransactions.length;
      
      if (uniqueTransactions.length === 0) {
        return { imported: [], matchCount: 0, duplicates: duplicateCount };
      }
      
      const { data, error } = await supabase
        .from('credit_card_transactions')
        .insert(uniqueTransactions.map(t => ({
          ...t,
          imported_at: new Date().toISOString(),
          status: t.category ? 'matched' : (t.status || 'pending'),
        })))
        .select();
      
      if (error) throw error;
      
      // Auto-match payments with existing JE-sourced transactions
      const cachedTxns = queryClient.getQueryData<ExtendedCreditCardTransaction[]>(
        ['credit-card-transactions', creditCardId]
      ) || [];
      
      const matchCount = await autoMatchPayments(data as CreditCardTransaction[], cachedTxns);
      
      return { imported: data || [], matchCount, duplicates: duplicateCount };
    },
    onSuccess: ({ imported, matchCount, duplicates }) => {
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      
      let message = `Imported ${imported.length} transactions`;
      if (matchCount > 0) message += `, auto-matched ${matchCount} payment(s)`;
      if (duplicates > 0) message += ` (${duplicates} duplicates skipped)`;
      
      if (imported.length === 0 && duplicates > 0) {
        toast.info(`All ${duplicates} transactions already exist`);
      } else {
        toast.success(message);
      }
    },
    onError: (error) => {
      toast.error('Failed to import transactions: ' + error.message);
    },
  });

  const unimportTransactions = useMutation({
    mutationFn: async (transactionIds: string[]) => {
      // Only delete transactions that were imported (have imported_at set) and are not JE-sourced
      const realIds = transactionIds.filter(id => !id.startsWith('je-'));
      if (realIds.length === 0) {
        throw new Error('Cannot unimport journal entry sourced transactions');
      }

      const { data: rows, error: fetchErr } = await supabase
        .from('credit_card_transactions')
        .select('id, journal_entry_id, credit_cards!inner(organization_id)')
        .in('id', realIds)
        .not('imported_at', 'is', null);
      if (fetchErr) throw fetchErr;

      const orgIds = new Set<string>();
      for (const r of rows || []) {
        const orgId = (r.credit_cards as any)?.organization_id;
        if (orgId) orgIds.add(orgId);
        if (r.journal_entry_id && orgId) {
          try {
            await reverseLinkedJournalEntry({
              creditCardTransactionId: r.id,
              journalEntryId: r.journal_entry_id,
              organizationId: orgId,
            });
          } catch (e) {
            console.error('Failed to reverse JE for cc tx', r.id, e);
          }
        }
      }

      const idsToDelete = (rows || []).map(r => r.id);
      if (idsToDelete.length === 0) return 0;

      const { error } = await supabase
        .from('credit_card_transactions')
        .delete()
        .in('id', idsToDelete);
      if (error) throw error;

      for (const orgId of orgIds) {
        try { await recalculateAndInvalidate(orgId, queryClient); } catch (e) { console.error(e); }
      }
      return idsToDelete.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`Removed ${count} imported transaction(s)`);
    },
    onError: (error) => {
      toast.error('Failed to remove transactions: ' + error.message);
    },
  });

  // Manual match: link a CC transaction to a JE-sourced transaction
  const matchPaymentTransactions = useMutation({
    mutationFn: async ({ 
      ccTransactionId, 
      jeTransactionId,
      journalEntryId,
    }: { 
      ccTransactionId: string; 
      jeTransactionId: string;
      journalEntryId: string;
    }) => {
      // Update the CC transaction to link to the journal entry
      const { data, error } = await supabase
        .from('credit_card_transactions')
        .update({ 
          journal_entry_id: journalEntryId,
          status: 'matched',
          category: 'Credit Card Payment',
        })
        .eq('id', ccTransactionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      toast.success('Transactions matched successfully');
    },
    onError: (error) => {
      toast.error('Failed to match transactions: ' + error.message);
    },
  });

  const CC_GL_FIELDS: (keyof CreditCardTransaction)[] = [
    'transaction_date',
    'amount',
    'transaction_type',
    'description',
    'reference',
    'payee_payor',
    'gl_account_id',
    'category',
  ];

  const updateTransaction = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CreditCardTransaction> & { id: string }) => {
      const { data: existing, error: existingErr } = await supabase
        .from('credit_card_transactions')
        .select('*, credit_cards!inner(gl_account_id, name, organization_id)')
        .eq('id', id)
        .single();
      if (existingErr) throw existingErr;

      const orgId = (existing?.credit_cards as any)?.organization_id as string | undefined;
      const ccGLAccountId = (existing?.credit_cards as any)?.gl_account_id as string | undefined;
      const ccName = (existing?.credit_cards as any)?.name as string | undefined;
      const linkedJEId = (existing as any)?.journal_entry_id as string | null;

      const glFieldChanged = CC_GL_FIELDS.some(
        (k) => (updates as any)[k] !== undefined && (updates as any)[k] !== (existing as any)[k]
      );

      if (!linkedJEId || !glFieldChanged) {
        const { data, error } = await supabase
          .from('credit_card_transactions')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }

      // Reverse prior JE
      if (orgId) {
        try {
          await reverseLinkedJournalEntry({
            creditCardTransactionId: id,
            journalEntryId: linkedJEId,
            organizationId: orgId,
          });
        } catch (revErr) {
          console.error('Failed to reverse prior CC journal entry:', revErr);
        }
      }

      const { data: updated, error: updErr } = await supabase
        .from('credit_card_transactions')
        .update({
          ...updates,
          journal_entry_id: null,
          status: 'pending',
        })
        .eq('id', id)
        .select('*')
        .single();
      if (updErr) throw updErr;

      // Re-post minimal 2-line JE (no tax split — user can re-categorize with tax if needed)
      const glAcct = (updated as any).gl_account_id as string | null;
      if (orgId && ccGLAccountId && glAcct) {
        const amount = Math.abs(Number(updated.amount));
        const type = updated.transaction_type as string;
        const payeeInfo = updated.payee_payor ? ` - ${updated.payee_payor}` : '';
        let lines: Array<{ account_id: string; debit: number; credit: number; memo: string }> = [];
        let label = 'Charge';
        if (type === 'payment') {
          label = 'Payment';
          lines = [
            { account_id: ccGLAccountId, debit: amount, credit: 0, memo: `CC Payment${payeeInfo}: ${updated.description}` },
            { account_id: glAcct, debit: 0, credit: amount, memo: `Payment to ${ccName || 'Credit Card'}` },
          ];
        } else if (type === 'credit' || type === 'refund') {
          label = 'Credit';
          lines = [
            { account_id: ccGLAccountId, debit: amount, credit: 0, memo: `CC Credit${payeeInfo}: ${updated.description}` },
            { account_id: glAcct, debit: 0, credit: amount, memo: `Refund - ${updated.description}` },
          ];
        } else {
          // charge / fee / interest (default)
          label = 'Charge';
          lines = [
            { account_id: glAcct, debit: amount, credit: 0, memo: updated.category || updated.description },
            { account_id: ccGLAccountId, debit: 0, credit: amount, memo: `CC Charge${payeeInfo}: ${updated.description}` },
          ];
        }

        try {
          const newJEId = await createJournalEntry({
            organizationId: orgId,
            date: updated.transaction_date,
            description: `CC ${label}${payeeInfo}: ${updated.description}`,
            reference: updated.reference || `CC-${id.slice(0, 8).toUpperCase()}`,
            lines,
            status: 'posted',
          });
          await supabase
            .from('credit_card_transactions')
            .update({ journal_entry_id: newJEId, status: 'matched' })
            .eq('id', id);
        } catch (jeErr) {
          console.error('Failed to re-post CC journal entry after edit:', jeErr);
          toast.error('Transaction updated, but re-posting to GL failed. Please re-post manually.');
        }
      }

      await recalculateAndInvalidate(orgId, queryClient);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Transaction updated');
    },
    onError: (error) => {
      toast.error('Failed to update transaction: ' + error.message);
    },
  });


  const categorizeTransaction = useMutation({
    mutationFn: async ({ 
      id, 
      category, 
      gl_account_id 
    }: { 
      id: string; 
      category?: string; 
      gl_account_id?: string;
    }) => {
      // Look up the existing CC tx so we can reverse any prior JE
      const { data: existing } = await supabase
        .from('credit_card_transactions')
        .select('journal_entry_id, credit_cards!inner(organization_id)')
        .eq('id', id)
        .maybeSingle();

      const orgId = (existing?.credit_cards as any)?.organization_id;

      if (existing?.journal_entry_id && orgId) {
        try {
          await reverseLinkedJournalEntry({
            creditCardTransactionId: id,
            journalEntryId: existing.journal_entry_id,
            organizationId: orgId,
          });
        } catch (revErr) {
          console.error('Failed to reverse prior CC journal entry:', revErr);
        }
      }

      const updates: Partial<CreditCardTransaction> = {};
      if (category !== undefined) updates.category = category;
      if (gl_account_id !== undefined) updates.gl_account_id = gl_account_id;
      if (category) updates.status = 'matched';
      if (existing?.journal_entry_id) (updates as any).journal_entry_id = null;
      
      const { data, error } = await supabase
        .from('credit_card_transactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;

      // Recalc balances + invalidate report queries
      await recalculateAndInvalidate(orgId, queryClient);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
    },
    onError: (error) => {
      toast.error('Failed to categorize transaction: ' + error.message);
    },
  });

  // Status definitions:
  // - pending: newly imported from statement, awaiting categorization OR JE-sourced payment awaiting statement match
  // - unmatched: reviewed but no matching category/GL account found
  // - matched: categorized with GL account assignment
  // - reconciled: cleared during credit card statement reconciliation
  
  // Pending: transactions that are newly imported or JE-sourced awaiting match
  const pendingTransactions = transactions.filter(t => 
    t.status === 'pending' || (!t.status && !t.category && !t.journal_entry_id)
  );
  
  // Unmatched: explicitly marked as unmatched (reviewed but couldn't match)
  const unmatchedTransactions = transactions.filter(t => t.status === 'unmatched');
  
  // Matched: has category assigned (status = matched or has category)
  const matchedTransactions = transactions.filter(t => 
    t.status === 'matched' || (t.category && t.status !== 'reconciled' && t.status !== 'unmatched')
  );
  
  // Posted: transactions linked to journal entries (for GL tracking)
  const postedTransactions = transactions.filter(t => t.journal_entry_id);
  
  // Reconciled: cleared during reconciliation process
  const reconciledTransactions = transactions.filter(t => t.status === 'reconciled');

  const totalCharges = transactions
    .filter(t => t.transaction_type === 'charge' || t.transaction_type === 'fee' || t.transaction_type === 'interest')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  const totalPayments = transactions
    .filter(t => t.transaction_type === 'payment' || t.transaction_type === 'credit')
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  return {
    transactions,
    isLoading,
    error,
    pendingTransactions,
    matchedTransactions,
    postedTransactions,
    unmatchedTransactions,
    reconciledTransactions,
    totalCharges,
    totalPayments,
    importTransactions,
    unimportTransactions,
    updateTransaction,
    categorizeTransaction,
    matchPaymentTransactions,
  };
}
