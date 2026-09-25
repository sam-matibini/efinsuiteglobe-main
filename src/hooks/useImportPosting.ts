import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';
import { ImportBatch, ImportBatchRow } from '@/types/import';
import { formatLocalDateString } from '@/lib/utils';

interface PostingResult {
  success: boolean;
  journalEntryIds: string[];
  postedDebits: number;
  postedCredits: number;
  errors: string[];
}

export function useImportPosting() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const postImportBatch = useMutation({
    mutationFn: async ({ 
      batch, 
      rows 
    }: { 
      batch: ImportBatch; 
      rows: ImportBatchRow[] 
    }): Promise<PostingResult> => {
      if (!organization?.id) throw new Error('No organization selected');

      const { data: userData } = await supabase.auth.getUser();

      // Update batch status to posting
      await supabase
        .from('import_batches')
        .update({ status: 'posting' })
        .eq('id', batch.id);

      const candidateRows = rows.filter(r => r.is_valid && r.matched_account_id);

      const isPostable = (a: { is_header: boolean | null; posting_allowed: boolean | null }) =>
        !a.is_header && a.posting_allowed !== false;

      // Detect header/non-posting mappings; attempt auto-remap to a postable descendant.
      const matchedAccountIds = Array.from(new Set(candidateRows.map(r => r.matched_account_id!).filter(Boolean)));
      const { data: matchedAccounts, error: accountsError } = await supabase
        .from('accounts')
        .select('id, is_header, posting_allowed, name')
        .in('id', matchedAccountIds);

      if (accountsError) throw accountsError;

      const nonPostableAccountIds = new Set(
        (matchedAccounts || []).filter(a => !isPostable(a)).map(a => a.id)
      );

      let validRows = candidateRows;

      if (nonPostableAccountIds.size > 0) {
        const { data: allAccounts, error: allAccountsError } = await supabase
          .from('accounts')
          .select('id, name, code, parent_id, is_header, posting_allowed')
          .eq('organization_id', organization.id);

        if (allAccountsError) throw allAccountsError;

        const postableSet = new Set((allAccounts || []).filter(isPostable).map(a => a.id));

        const childrenByParent = new Map<string, typeof allAccounts>();
        for (const a of allAccounts || []) {
          const key = a.parent_id ?? '__root__';
          const arr = childrenByParent.get(key) ?? [];
          arr.push(a);
          childrenByParent.set(key, arr);
        }
        for (const arr of childrenByParent.values()) {
          arr.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        }

        const getFirstPostableDescendant = (startId: string): string | null => {
          const visited = new Set<string>();
          const queue: string[] = [startId];

          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            const children = childrenByParent.get(current) ?? [];
            for (const child of children) {
              if (postableSet.has(child.id)) return child.id;
              queue.push(child.id);
            }
          }

          return null;
        };

        const replacementByNonPostableId = new Map<string, string>();
        for (const badId of nonPostableAccountIds) {
          const replacement = getFirstPostableDescendant(badId);
          if (replacement && replacement !== badId) {
            replacementByNonPostableId.set(badId, replacement);
          }
        }

        // Persist remaps to DB (grouped to minimize requests)
        const updates = Array.from(replacementByNonPostableId.entries()).map(([fromId, toId]) => {
          const rowIds = candidateRows.filter(r => r.matched_account_id === fromId).map(r => r.id);
          if (rowIds.length === 0) return null;
          return supabase
            .from('import_batch_rows')
            .update({ matched_account_id: toId, match_type: 'auto_child', match_confidence: 80 })
            .in('id', rowIds);
        }).filter(Boolean);

        if (updates.length > 0) {
          const results = await Promise.all(updates as any);
          const firstError = results.find((r: any) => r?.error)?.error;
          if (firstError) throw firstError;
        }

        // Apply remaps locally for this posting run
        validRows = candidateRows.map(r => {
          const replacement = replacementByNonPostableId.get(r.matched_account_id!);
          return replacement ? { ...r, matched_account_id: replacement } : r;
        });

        const stillBad = validRows.filter(r => !postableSet.has(r.matched_account_id!));
        if (stillBad.length > 0) {
          const nameById = new Map((allAccounts || []).map(a => [a.id, a.name] as const));
          const nonPostableNames = Array.from(new Set(stillBad.map(r => nameById.get(r.matched_account_id!) || 'Unknown')))
            .slice(0, 10);

          throw new Error(
            `Some rows are mapped to header/non-posting accounts: ${nonPostableNames.join(', ') || 'Unknown'}. Please remap to posting accounts.`
          );
        }
      }

      const journalEntryIds: string[] = [];
      const errors: string[] = [];

      // Normalize negative debit/credit values: a negative on one side is a positive on the other.
      const normalizeRow = (r: typeof validRows[number]) => {
        const rawDr = Number(r.debit_amount) || 0;
        const rawCr = Number(r.credit_amount) || 0;
        const dr = Math.max(rawDr, 0) + Math.max(-rawCr, 0);
        const cr = Math.max(rawCr, 0) + Math.max(-rawDr, 0);
        return { dr, cr };
      };

      // Calculate totals using normalized amounts
      let totalDebits = 0;
      let totalCredits = 0;

      for (const row of validRows) {
        const { dr, cr } = normalizeRow(row);
        totalDebits += dr;
        totalCredits += cr;
      }

      // Validate balance
      const difference = Math.abs(totalDebits - totalCredits);
      if (difference > 0.01) {
        throw new Error(`Import is out of balance. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}, Difference: ${difference.toFixed(2)}`);
      }

      try {
        if (batch.posting_mode === 'opening_balance') {
          // Update opening balances directly on accounts
          for (const row of validRows) {
            if (!row.matched_account_id) continue;

            // Get current account
            const { data: account } = await supabase
              .from('accounts')
              .select('opening_balance, normal_balance')
              .eq('id', row.matched_account_id)
              .single();

            if (!account) {
              errors.push(`Account not found for row ${row.row_number}`);
              continue;
            }

            // Calculate new opening balance using normalized amounts
            const { dr: normDr, cr: normCr } = normalizeRow(row);
            let newBalance = account.opening_balance || 0;
            if (account.normal_balance === 'debit') {
              newBalance += normDr - normCr;
            } else {
              newBalance += normCr - normDr;
            }

            // Update account opening balance
            const { error: updateError } = await supabase
              .from('accounts')
              .update({ opening_balance: newBalance })
              .eq('id', row.matched_account_id);

            if (updateError) {
              errors.push(`Failed to update account for row ${row.row_number}: ${updateError.message}`);
            }

            // Mark row as posted
            await supabase
              .from('import_batch_rows')
              .update({ is_posted: true, posted_at: new Date().toISOString() })
              .eq('id', row.id);
          }
        } else {
          // Create journal entry using direct insert
          // Generate unique reference with timestamp to avoid duplicate key violations
          const timestamp = Date.now().toString(36).toUpperCase();
          const reference = `IMP-${batch.fiscal_year}-${timestamp}`;

          const { data: journalEntry, error: jeError } = await supabase
            .from('journal_entries')
            .insert({
              organization_id: organization.id,
              entry_date: batch.as_of_date,
              description: `${batch.import_type === 'trial_balance' ? 'Trial Balance' : 'Opening Balance'} Import - ${batch.source_system || 'Manual'}`,
              reference,
              status: 'draft',
              journal_type: 'adjustment',
              created_by: userData.user?.id,
            })
            .select()
            .single();

          if (jeError) throw jeError;

          // Insert journal lines (normalize negatives so the CHECK constraint holds)
          const journalLines = validRows
            .filter(r => {
              if (!r.matched_account_id) return false;
              const { dr, cr } = normalizeRow(r);
              return dr > 0 || cr > 0;
            })
            .map(r => {
              const { dr, cr } = normalizeRow(r);
              return {
                journal_entry_id: journalEntry.id,
                account_id: r.matched_account_id!,
                debit: dr,
                credit: cr,
                description: `Import: ${r.account_code || ''}${r.account_name ? ' - ' + r.account_name : ''}`.trim() || null,
              };
            });

          if (journalLines.length > 0) {
            const { error: linesError } = await supabase
              .from('journal_entry_lines')
              .insert(journalLines);

            if (linesError) throw linesError;
          }

          // Post the journal entry
          const { error: postError } = await supabase
            .from('journal_entries')
            .update({ status: 'posted' })
            .eq('id', journalEntry.id);

          if (postError) throw postError;

          journalEntryIds.push(journalEntry.id);

          // Mark all rows as posted
          for (const row of validRows) {
            await supabase
              .from('import_batch_rows')
              .update({ is_posted: true, posted_at: new Date().toISOString() })
              .eq('id', row.id);
          }
        }

        // Update batch status to posted
        await supabase
          .from('import_batches')
          .update({
            status: 'posted',
            posted_at: new Date().toISOString(),
            posted_by: userData.user?.id,
            posted_total_debits: totalDebits,
            posted_total_credits: totalCredits,
            journal_entry_ids: journalEntryIds,
          })
          .eq('id', batch.id);

        // Log audit
        await supabase.from('import_audit_logs').insert({
          batch_id: batch.id,
          action: 'posted',
          details: {
            total_debits: totalDebits,
            total_credits: totalCredits,
            rows_posted: validRows.length,
            journal_entry_ids: journalEntryIds,
          },
          performed_by: userData.user?.id,
        });

        return {
          success: true,
          journalEntryIds,
          postedDebits: totalDebits,
          postedCredits: totalCredits,
          errors,
        };
      } catch (error) {
        // Update batch status to failed
        await supabase
          .from('import_batches')
          .update({ status: 'failed' })
          .eq('id', batch.id);

        throw error;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
      
      if (result.errors.length > 0) {
        toast.warning(`Import posted with ${result.errors.length} warnings`);
      } else {
        toast.success('Import posted successfully');
      }
    },
    onError: (error) => {
      toast.error('Failed to post import: ' + error.message);
    },
  });

  const reverseImportBatch = useMutation({
    mutationFn: async ({ 
      batchId, 
      reason 
    }: { 
      batchId: string; 
      reason: string;
    }) => {
      if (!organization?.id) throw new Error('No organization selected');

      const { data: userData } = await supabase.auth.getUser();

      // Get the batch
      const { data: batch, error: batchError } = await supabase
        .from('import_batches')
        .select('*')
        .eq('id', batchId)
        .single();

      if (batchError || !batch) throw new Error('Batch not found');
      if (batch.status !== 'posted') throw new Error('Only posted batches can be reversed');

      // Get the rows
      const { data: rows } = await supabase
        .from('import_batch_rows')
        .select('*')
        .eq('batch_id', batchId)
        .eq('is_posted', true);

      const reversalJournalIds: string[] = [];

      if (batch.posting_mode === 'opening_balance') {
        // Reverse opening balances
        for (const row of rows || []) {
          if (!row.matched_account_id) continue;

          const { data: account } = await supabase
            .from('accounts')
            .select('opening_balance, normal_balance')
            .eq('id', row.matched_account_id)
            .single();

          if (!account) continue;

          // Reverse the balance change
          let newBalance = account.opening_balance || 0;
          if (account.normal_balance === 'debit') {
            newBalance -= (row.debit_amount || 0) - (row.credit_amount || 0);
          } else {
            newBalance -= (row.credit_amount || 0) - (row.debit_amount || 0);
          }

          await supabase
            .from('accounts')
            .update({ opening_balance: newBalance })
            .eq('id', row.matched_account_id);
        }
      } else if (batch.journal_entry_ids?.length > 0) {
        // Create REV- counter-entries so reports that include both 'posted' and
        // 'reversed' (Income Statement, Balance Sheet, Cash Flow, FX) net to zero.
        const nowIso = new Date().toISOString();
        for (const jeId of batch.journal_entry_ids) {
          const { data: original, error: jeErr } = await supabase
            .from('journal_entries')
            .select('id, reference, entry_date, description, status, organization_id')
            .eq('id', jeId)
            .single();
          if (jeErr || !original) continue;
          if (original.status !== 'posted') continue;

          const { data: lines, error: linesErr } = await supabase
            .from('journal_entry_lines')
            .select('account_id, description, debit, credit, base_currency_debit, base_currency_credit, line_order')
            .eq('journal_entry_id', jeId);
          if (linesErr) continue;

          const { data: reversalEntry, error: insertErr } = await supabase
            .from('journal_entries')
            .insert({
              organization_id: original.organization_id,
              reference: `REV-${original.reference}`,
              entry_date: original.entry_date,
              description: `Reversal of ${original.reference}`,
              notes: reason,
              status: 'posted',
              created_by: userData.user?.id,
              posted_by: userData.user?.id,
              posted_at: nowIso,
              reversal_of: original.id,
            })
            .select('id')
            .single();
          if (insertErr || !reversalEntry) continue;

          if (lines && lines.length > 0) {
            const reversedLines = lines.map((l, idx) => ({
              journal_entry_id: reversalEntry.id,
              account_id: l.account_id,
              description: l.description ?? null,
              debit: Number(l.credit) || 0,
              credit: Number(l.debit) || 0,
              base_currency_debit: l.base_currency_credit ?? null,
              base_currency_credit: l.base_currency_debit ?? null,
              line_order: l.line_order ?? idx,
            }));
            await supabase.from('journal_entry_lines').insert(reversedLines);
          }

          await supabase
            .from('journal_entries')
            .update({
              status: 'reversed',
              reversed_by: userData.user?.id,
              reversed_at: nowIso,
            })
            .eq('id', original.id);

          reversalJournalIds.push(reversalEntry.id);
        }

        // Recalculate cached account balances so Chart of Accounts and dashboards stay in sync.
        const { error: recalcErr } = await supabase.rpc('recalculate_all_account_balances', {
          p_organization_id: organization.id,
        });
        if (recalcErr) console.warn('recalculate_all_account_balances warning:', recalcErr);
      }

      // Update batch
      await supabase
        .from('import_batches')
        .update({
          status: 'reversed',
          reversed_at: new Date().toISOString(),
          reversed_by: userData.user?.id,
          reversal_reason: reason,
          reversal_journal_entry_ids: reversalJournalIds,
        })
        .eq('id', batchId);

      // Log audit
      await supabase.from('import_audit_logs').insert({
        batch_id: batchId,
        action: 'reversed',
        details: {
          reason,
          reversal_journal_ids: reversalJournalIds,
        },
        performed_by: userData.user?.id,
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-batches'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
      queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
      queryClient.invalidateQueries({ queryKey: ['comparative-financial-reports'] });
      queryClient.invalidateQueries({ queryKey: ['fx-reports'] });
      queryClient.invalidateQueries({ queryKey: ['balance-sheet'] });
      queryClient.invalidateQueries({ queryKey: ['income-statement'] });
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
      toast.success('Import reversed successfully');
    },
    onError: (error) => {
      toast.error('Failed to reverse import: ' + error.message);
    },
  });

  return { postImportBatch, reverseImportBatch };
}
