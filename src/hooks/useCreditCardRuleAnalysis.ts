import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createJournalEntry } from './useJournalEntryCreation';
import { TransactionRule } from './useTransactionRules';
import { CreditCardTransaction } from './useCreditCards';
import { toast } from 'sonner';
import { 
  matchText, 
  getMatchConfidence, 
  extractVendorName,
  normalizeText 
} from '@/lib/transactionMatcher';

export interface CCAnalysisResult {
  transaction: CreditCardTransaction;
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
  taxCollectedGlAccountId?: string; // For payments/credits (refunds) - GST/HST Payable
  taxPaidGlAccountId?: string;      // For charges (expenses) - GST/HST ITC
  // Legacy field (deprecated)
  taxGlAccountId?: string;
  taxGlAccountName?: string;
  // Division / Department tagging
  departmentId?: string;
}

export interface CCProcessingResult {
  transactionId: string;
  success: boolean;
  journalEntryId?: string;
  category?: string;
  error?: string;
}

/**
 * Match a credit card transaction against a rule using enhanced matching
 */
export function matchesCCRule(tx: CreditCardTransaction, rule: TransactionRule): boolean {
  const txDirection: 'inflow' | 'outflow' | null =
    tx.transaction_type === 'payment' || tx.transaction_type === 'credit' ? 'inflow'
    : tx.transaction_type === 'charge' || tx.transaction_type === 'fee' || tx.transaction_type === 'interest' ? 'outflow'
    : null;

  const results = rule.conditions.map(condition => {
    const searchValue = condition.value || '';
    const txAmount = Math.abs(Number(tx.amount));

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

    switch (condition.operator) {
      case 'is_deposit':
        return tx.transaction_type === 'payment' || tx.transaction_type === 'credit';
      case 'is_withdrawal':
        return tx.transaction_type === 'charge' || tx.transaction_type === 'fee' || tx.transaction_type === 'interest';
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
 * Calculate match confidence score for a CC transaction-rule pair
 */
export function calculateCCMatchConfidence(
  tx: CreditCardTransaction, 
  rule: TransactionRule
): { matches: boolean; score: number; confidence: 'high' | 'medium' | 'low' } {
  if (!matchesCCRule(tx, rule)) {
    return { matches: false, score: 0, confidence: 'low' };
  }
  
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
      totalScore += 1;
      conditionCount++;
    }
  }
  
  const avgScore = conditionCount > 0 ? totalScore / conditionCount : 0;
  const confidence = avgScore >= 0.9 ? 'high' : avgScore >= 0.7 ? 'medium' : 'low';
  
  return { matches: true, score: avgScore, confidence };
}

/**
 * Analyze credit card transactions against rules without applying
 * Includes pending and uncategorized transactions
 */
export function analyzeCCTransactions(
  transactions: CreditCardTransaction[],
  rules: TransactionRule[]
): CCAnalysisResult[] {
  // Include pending and uncategorized transactions (not reconciled)
  const eligibleTxs = transactions.filter(t => 
    !t.category && 
    (t.status === 'pending' || t.status === 'unmatched' || !t.status) &&
    t.status !== 'reconciled'
  );
  const activeRules = rules.filter(r => r.is_active).sort((a, b) => b.priority - a.priority);

  return eligibleTxs.map(tx => {
    for (const rule of activeRules) {
      const matchResult = calculateCCMatchConfidence(tx, rule);
      
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
 * Hook for processing analyzed credit card transactions (categorize + post to GL)
 */
export function useProcessCCTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      analysisResults,
      organizationId,
      creditCardId,
    }: {
      analysisResults: CCAnalysisResult[];
      organizationId: string;
      creditCardId: string;
    }): Promise<CCProcessingResult[]> => {
      const results: CCProcessingResult[] = [];
      
      // Filter to only matched transactions
      const toProcess = analysisResults.filter(r => r.matchedRule !== null);

      // Get credit card's GL account
      const { data: creditCard } = await supabase
        .from('credit_cards')
        .select('gl_account_id, name')
        .eq('id', creditCardId)
        .single();

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
            // Update transaction with category and GL account
            const updates: Record<string, any> = {
              status: 'matched',
            };
            
            if (category) updates.category = category;
            if (glAccountId) updates.gl_account_id = glAccountId;
            if (departmentId) updates.department_id = departmentId;

            // If posting to GL, create journal entry
            let journalEntryId: string | undefined;
            
            if (willPostToGL && glAccountId && creditCard?.gl_account_id) {
              const grossAmount = Math.abs(Number(transaction.amount));
              const isPayment = transaction.transaction_type === 'payment' || transaction.transaction_type === 'credit';

              // Determine the correct tax GL account based on transaction type
              // - Charges (expenses): Use taxPaidGlAccountId (GST/HST ITC - asset)
              // - Payments/Credits: Use taxCollectedGlAccountId (GST/HST Payable - liability) - rare case
              const effectiveTaxGlAccountId = isPayment 
                ? (taxCollectedGlAccountId || taxGlAccountId)  // Refunds -> Collected (Payable)
                : (taxPaidGlAccountId || taxGlAccountId);       // Charges -> Paid (ITC)

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

              if (isPayment) {
                // Payment reduces liability
                lines.push({ 
                  account_id: creditCard.gl_account_id, 
                  debit: grossAmount, 
                  credit: 0, 
                  memo: `CC Payment: ${transaction.description}` 
                });
                lines.push({ 
                  account_id: glAccountId, 
                  debit: 0, 
                  credit: grossAmount, 
                  memo: category || transaction.description 
                });
              } else {
                // Charge increases expense and liability
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
                  account_id: creditCard.gl_account_id, 
                  debit: 0, 
                  credit: grossAmount, 
                  memo: `${transaction.payee_payor || 'CC Charge'}: ${transaction.description}` 
                });
              }

              // Generate a unique reference using full transaction ID to avoid collisions
              const uniqueReference = `CC-${transaction.id.toUpperCase()}`;

              journalEntryId = await createJournalEntry({
                organizationId,
                date: transaction.transaction_date,
                description: `${isPayment ? 'CC Payment' : 'CC Charge'}: ${transaction.payee_payor || transaction.description}${taxAmount > 0 ? ` (incl. ${taxCode})` : ''}`,
                reference: uniqueReference,
                lines,
                status: 'posted',
                departmentId: departmentId ?? transaction.department_id ?? null,
              });

              updates.journal_entry_id = journalEntryId;
            }

            // Update the transaction
            await supabase
              .from('credit_card_transactions')
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
            console.error(`Failed to process CC transaction ${transaction.id}:`, error);
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
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const glCount = results.filter(r => r.journalEntryId).length;
      
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['credit-cards'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-rules'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      
      if (successCount > 0) {
        toast.success(
          `Processed ${successCount} CC transaction${successCount !== 1 ? 's' : ''}` +
          (glCount > 0 ? ` • ${glCount} posted to GL` : '')
        );
      } else {
        toast.info('No transactions matched rules');
      }
    },
    onError: (error) => {
      toast.error(`Processing failed: ${error.message}`);
    },
  });
}

/**
 * Hook to apply rules to credit card transactions
 */
export function useApplyCCRules() {
  const processMutation = useProcessCCTransactions();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactions,
      rules,
      organizationId,
      creditCardId,
    }: {
      transactions: CreditCardTransaction[];
      rules: TransactionRule[];
      organizationId: string;
      creditCardId: string;
    }) => {
      // Analyze transactions
      const analysisResults = analyzeCCTransactions(transactions, rules);
      
      // Filter to only those with matches
      const matched = analysisResults.filter(r => r.matchedRule !== null);
      
      if (matched.length === 0) {
        return { processed: 0, posted: 0, total: analysisResults.length };
      }

      // Process the matched transactions
      const results = await processMutation.mutateAsync({
        analysisResults: matched,
        organizationId,
        creditCardId,
      });

      return {
        processed: results.filter(r => r.success).length,
        posted: results.filter(r => r.journalEntryId).length,
        total: analysisResults.length,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-card-transactions'] });
    },
  });
}
