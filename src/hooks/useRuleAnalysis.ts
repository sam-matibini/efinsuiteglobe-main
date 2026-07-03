import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createJournalEntry } from './useJournalEntryCreation';
import { reverseLinkedJournalEntry, recalculateAndInvalidate } from './useGLPropagation';
import { TransactionRule } from './useTransactionRules';
import { BankTransaction } from './useBankTransactions';
import { toast } from 'sonner';
import { 
  matchText, 
  getMatchConfidence, 
  extractVendorName,
  normalizeText 
} from '@/lib/transactionMatcher';

export interface AnalysisResult {
  transaction: BankTransaction;
  matchedRule: TransactionRule | null;
  category: string | null;
  glAccountId: string | null;
  glAccountName: string | null;
  willPostToGL: boolean;
  confidence: 'high' | 'medium' | 'low';
  matchScore?: number;
  // Tax information
  taxCodeId?: string;
  taxCode?: string;
  taxRate?: number;
  // Split GL accounts for correct tax posting based on transaction type
  taxCollectedGlAccountId?: string; // For deposits (sales) - GST/HST Payable
  taxPaidGlAccountId?: string;      // For withdrawals (expenses) - GST/HST ITC
  // Legacy field (deprecated)
  taxGlAccountId?: string;
  taxGlAccountName?: string;
  // Division / Department tagging
  departmentId?: string;
}

export interface ProcessingResult {
  transactionId: string;
  success: boolean;
  journalEntryId?: string;
  category?: string;
  error?: string;
}

/**
 * Match a transaction against a rule using enhanced matching
 */
export function matchesRule(tx: BankTransaction, rule: TransactionRule): boolean {
  const txDirection: 'inflow' | 'outflow' | null =
    tx.transaction_type === 'deposit' ? 'inflow'
    : tx.transaction_type === 'withdrawal' ? 'outflow'
    : null;

  const results = rule.conditions.map(condition => {
    const searchValue = condition.value || '';
    const txAmount = Math.abs(Number(tx.amount));

    // Get field value based on condition field
    let fieldValue = '';
    switch (condition.field) {
      case 'description':
        fieldValue = tx.description || '';
        break;
      case 'payee_payor':
        fieldValue = tx.payee_payor || '';
        break;
      case 'reference':
        fieldValue = tx.reference || '';
        break;
    }

    // Handle amount-specific operators
    if (condition.field === 'amount') {
      switch (condition.operator) {
        case 'equals':
          return Math.abs(txAmount - parseFloat(searchValue)) < 0.01;
        case 'greater_than':
          return txAmount > parseFloat(searchValue);
        case 'less_than':
          return txAmount < parseFloat(searchValue);
        case 'between':
          const min = parseFloat(searchValue);
          const max = parseFloat(condition.value2 || '0');
          return txAmount >= min && txAmount <= max;
        default:
          return false;
      }
    }

    // Handle transaction type operators
    switch (condition.operator) {
      case 'is_deposit':
        return tx.transaction_type === 'deposit';
      case 'is_withdrawal':
        return tx.transaction_type === 'withdrawal';
    }

    const textOperators = [
      'contains', 'not_contains', 'equals', 'not_equals',
      'starts_with', 'ends_with', 'contains_words', 
      'contains_any_word', 'fuzzy_match', 'matches_regex'
    ];

    if (textOperators.includes(condition.operator)) {
      if (matchText(fieldValue, condition.operator, searchValue, { txDirection })) {
        return true;
      }
      
      if (condition.field === 'description') {
        const vendor = extractVendorName(fieldValue);
        if (matchText(vendor, condition.operator, searchValue, { txDirection })) {
          return true;
        }
      }
      
      if (condition.field === 'payee_payor') {
        const normalized = normalizeText(fieldValue);
        if (matchText(normalized, condition.operator, searchValue, { txDirection })) {
          return true;
        }
      }
      
      return false;
    }

    return false;
  });

  const logicOp = (rule.logic_operator || 'and').toLowerCase();
  return logicOp === 'and' 
    ? results.every(Boolean)
    : results.some(Boolean);
}

/**
 * Calculate match confidence score for a transaction-rule pair
 */
export function calculateMatchConfidence(
  tx: BankTransaction, 
  rule: TransactionRule
): { matches: boolean; score: number; confidence: 'high' | 'medium' | 'low' } {
  if (!matchesRule(tx, rule)) {
    return { matches: false, score: 0, confidence: 'low' };
  }
  
  // Calculate confidence based on match quality
  let totalScore = 0;
  let conditionCount = 0;
  
  for (const condition of rule.conditions) {
    let fieldValue = '';
    switch (condition.field) {
      case 'description':
        fieldValue = tx.description || '';
        break;
      case 'payee_payor':
        fieldValue = tx.payee_payor || '';
        break;
      case 'reference':
        fieldValue = tx.reference || '';
        break;
    }
    
    if (condition.field !== 'amount' && condition.field !== 'type') {
      const score = getMatchConfidence(fieldValue, condition.value || '');
      totalScore += score;
      conditionCount++;
    } else {
      // Amount and type matches are high confidence if they match
      totalScore += 1;
      conditionCount++;
    }
  }
  
  const avgScore = conditionCount > 0 ? totalScore / conditionCount : 0;
  const confidence = avgScore >= 0.9 ? 'high' : avgScore >= 0.7 ? 'medium' : 'low';
  
  return { matches: true, score: avgScore, confidence };
}

/**
 * Analyze transactions against rules without applying
 * Includes both 'pending' and 'unmatched' transactions that don't have a category
 */
export function analyzeTransactions(
  transactions: BankTransaction[],
  rules: TransactionRule[]
): AnalysisResult[] {
  // Include pending and unmatched transactions without categories
  const eligibleTxs = transactions.filter(t => 
    (t.status === 'unmatched' || t.status === 'pending') && 
    !t.category
  );
  const activeRules = rules.filter(r => r.is_active).sort((a, b) => b.priority - a.priority);

  return eligibleTxs.map(tx => {
    for (const rule of activeRules) {
      const matchResult = calculateMatchConfidence(tx, rule);
      
      if (matchResult.matches) {
        const categoryAction = rule.actions.find(a => a.type === 'categorize');
        const glAction = rule.actions.find(a => a.type === 'post_to_gl');

        return {
          transaction: tx,
          matchedRule: rule,
          category: categoryAction?.category || null,
          glAccountId: glAction?.glAccountId || null,
          glAccountName: glAction?.glAccountName || null,
          willPostToGL: !!glAction?.glAccountId,
          confidence: matchResult.confidence,
          matchScore: matchResult.score,
          // Include tax info from the rule action
          taxCodeId: glAction?.taxCodeId,
          taxCode: glAction?.taxCode,
          taxRate: glAction?.taxRate,
          // Pass both collected and paid GL accounts for correct routing
          taxCollectedGlAccountId: glAction?.taxCollectedGlAccountId,
          taxPaidGlAccountId: glAction?.taxPaidGlAccountId,
          // Legacy fallback
          taxGlAccountId: glAction?.taxGlAccountId,
          taxGlAccountName: glAction?.taxGlAccountName,
          // Division
          departmentId: glAction?.departmentId || categoryAction?.departmentId,
        };
      }
    }

    return {
      transaction: tx,
      matchedRule: null,
      category: null,
      glAccountId: null,
      glAccountName: null,
      willPostToGL: false,
      confidence: 'low' as const,
      matchScore: 0,
    };
  });
}

/**
 * Hook for processing analyzed transactions (categorize + post to GL)
 */
export function useProcessTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      analysisResults,
      organizationId,
    }: {
      analysisResults: AnalysisResult[];
      organizationId: string;
    }): Promise<ProcessingResult[]> => {
      const results: ProcessingResult[] = [];
      
      // Filter to only matched transactions
      const toProcess = analysisResults.filter(r => r.matchedRule !== null);

      // Process in parallel batches of 5 for speed
      const batchSize = 5;
      for (let i = 0; i < toProcess.length; i += batchSize) {
        const batch = toProcess.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (analysis) => {
          const { 
            transaction, 
            category, 
            glAccountId, 
            willPostToGL, 
            matchedRule,
            taxRate,
            taxCode,
            // Use new split GL accounts
            taxCollectedGlAccountId,
            taxPaidGlAccountId,
            // Legacy fallback
            taxGlAccountId,
            departmentId,
          } = analysis;
          
          try {
            // Reverse any prior journal entry linked to this transaction so we don't double-post
            if (transaction.journal_entry_id) {
              try {
                await reverseLinkedJournalEntry({
                  bankTransactionId: transaction.id,
                  journalEntryId: transaction.journal_entry_id,
                  organizationId,
                });
              } catch (revErr) {
                console.error('Reverse prior JE failed:', revErr);
              }
            }

            // Update transaction with category and GL account
            const updates: Record<string, any> = {
              status: 'matched',
              journal_entry_id: null,
            };
            
            if (category) updates.category = category;
            if (glAccountId) updates.gl_account_id = glAccountId;
            if (departmentId) updates.department_id = departmentId;

            // If posting to GL, create journal entry
            let journalEntryId: string | undefined;
            
            if (willPostToGL && glAccountId) {
              // Get bank account's GL account
              const { data: bankAccount } = await supabase
                .from('bank_accounts')
                .select('gl_account_id')
                .eq('id', transaction.bank_account_id)
                .single();

              if (bankAccount?.gl_account_id) {
                const grossAmount = Math.abs(Number(transaction.amount));
                const isDeposit = transaction.transaction_type === 'deposit';

                // Determine the correct tax GL account based on transaction type
                // - Deposits (sales): Use taxCollectedGlAccountId (GST/HST Payable - liability)
                // - Withdrawals (expenses): Use taxPaidGlAccountId (GST/HST ITC - asset)
                const effectiveTaxGlAccountId = isDeposit 
                  ? (taxCollectedGlAccountId || taxGlAccountId)  // Sales -> Collected (Payable)
                  : (taxPaidGlAccountId || taxGlAccountId);       // Expenses -> Paid (ITC)

                // Calculate tax amounts if tax code is set AND we have a valid GL account
                let subtotal = grossAmount;
                let taxAmount = 0;
                
                if (taxRate && taxRate > 0 && effectiveTaxGlAccountId) {
                  // Tax-inclusive calculation: total includes tax
                  subtotal = grossAmount / (1 + taxRate / 100);
                  taxAmount = grossAmount - subtotal;
                  // Round to 2 decimal places
                  subtotal = Math.round(subtotal * 100) / 100;
                  taxAmount = Math.round(taxAmount * 100) / 100;
                }

                const lines: Array<{ account_id: string; debit: number; credit: number; memo: string }> = [];
                
                if (isDeposit) {
                  // For deposits: Debit bank, Credit revenue (and Credit tax collected if applicable)
                  lines.push({ 
                    account_id: bankAccount.gl_account_id, 
                    debit: grossAmount, 
                    credit: 0, 
                    memo: `Deposit from ${transaction.payee_payor || 'Unknown'}: ${transaction.description}` 
                  });
                  
                  lines.push({ 
                    account_id: glAccountId, 
                    debit: 0, 
                    credit: subtotal, 
                    memo: category || transaction.description 
                  });
                  
                  // Credit tax to GST/HST Payable (liability account)
                  if (taxAmount > 0 && effectiveTaxGlAccountId) {
                    lines.push({ 
                      account_id: effectiveTaxGlAccountId, 
                      debit: 0, 
                      credit: taxAmount, 
                      memo: `${taxCode || 'Tax'} collected` 
                    });
                  }
                } else {
                  // For withdrawals: Debit expense (and Debit tax paid if applicable), Credit bank
                  lines.push({ 
                    account_id: glAccountId, 
                    debit: subtotal, 
                    credit: 0, 
                    memo: category || transaction.description 
                  });
                  
                  // Debit tax to GST/HST ITC (asset account - recoverable)
                  if (taxAmount > 0 && effectiveTaxGlAccountId) {
                    lines.push({ 
                      account_id: effectiveTaxGlAccountId, 
                      debit: taxAmount, 
                      credit: 0, 
                      memo: `${taxCode || 'Tax'} paid (ITC)` 
                    });
                  }
                  
                  lines.push({
                    account_id: bankAccount.gl_account_id, 
                    debit: 0, 
                    credit: grossAmount, 
                    memo: `Payment to ${transaction.payee_payor || 'Unknown'}: ${transaction.description}` 
                  });
                }

                // Generate a unique reference using full transaction ID to avoid collisions
                // The BANK- prefix + full UUID ensures uniqueness even if transactions are re-processed
                const uniqueReference = `BANK-${transaction.id.toUpperCase()}`;

                journalEntryId = await createJournalEntry({
                  organizationId,
                  date: transaction.transaction_date,
                  description: `${isDeposit ? 'Deposit' : 'Payment'}: ${transaction.payee_payor || transaction.description}${taxAmount > 0 ? ` (incl. ${taxCode})` : ''}`,
                  reference: uniqueReference,
                  lines,
                  status: 'posted',
                  departmentId: departmentId ?? transaction.department_id ?? null,
                });

                updates.journal_entry_id = journalEntryId;
              }
            }

            // Update the transaction
            await supabase
              .from('bank_transactions')
              .update(updates)
              .eq('id', transaction.id);

            // Update rule match count
            if (matchedRule) {
              await supabase
                .from('transaction_rules')
                .update({
                  matches_count: matchedRule.matches_count + 1,
                  last_matched_at: new Date().toISOString(),
                })
                .eq('id', matchedRule.id);
            }

            return {
              transactionId: transaction.id,
              success: true,
              journalEntryId,
              category: category || undefined,
            };
          } catch (error) {
            console.error(`Failed to process transaction ${transaction.id}:`, error);
            return {
              transactionId: transaction.id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      return results;
    },
    onSuccess: async (results, variables) => {
      const successCount = results.filter(r => r.success).length;
      const glCount = results.filter(r => r.journalEntryId).length;
      
      // Recalc all account balances + invalidate every report query
      await recalculateAndInvalidate(variables.organizationId, queryClient);

      queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-rules'] });
      
      if (successCount > 0) {
        toast.success(
          `Processed ${successCount} transaction${successCount !== 1 ? 's' : ''}` +
          (glCount > 0 ? ` • ${glCount} posted to GL` : '')
        );
      }
    },
    onError: (error) => {
      toast.error(`Processing failed: ${error.message}`);
    },
  });
}
