import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkReverseProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
}

/**
 * Hook to bulk reverse all posted journal entries that haven't been reversed yet.
 * This will create reversing entries for each and reset account balances to opening balances.
 */
export function useBulkReverseJournalEntries() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
      onProgress,
    }: {
      organizationId: string;
      userId: string;
      onProgress?: (progress: BulkReverseProgress) => void;
    }) => {
      // Get all posted entries that haven't been reversed (exclude REV- entries to avoid double-reversing)
      const { data: postedEntries, error: fetchError } = await supabase
        .from('journal_entries')
        .select(`
          id,
          reference,
          entry_date,
          description,
          journal_entry_lines (
            account_id,
            description,
            debit,
            credit
          )
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'posted')
        .not('reference', 'like', 'REV-%')
        .order('entry_date', { ascending: false });
      
      if (fetchError) throw fetchError;
      
      if (!postedEntries || postedEntries.length === 0) {
        return { total: 0, succeeded: 0, failed: 0 };
      }
      
      const progress: BulkReverseProgress = {
        total: postedEntries.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
      };
      
      const reversalDate = new Date().toISOString().split('T')[0];
      const errors: string[] = [];
      
      // Process entries in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < postedEntries.length; i += batchSize) {
        const batch = postedEntries.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (entry) => {
          try {
            const lines = entry.journal_entry_lines || [];
            
            // Skip entries with no lines
            if (lines.length === 0) {
              progress.processed++;
              progress.succeeded++;
              onProgress?.(progress);
              return;
            }
            
            // Create the reversing entry
            const reversalRef = `REV-${entry.reference}`;
            
            const { data: reversalEntry, error: entryError } = await supabase
              .from('journal_entries')
              .insert({
                organization_id: organizationId,
                reference: reversalRef,
                entry_date: reversalDate,
                description: `Bulk Reversal of ${entry.reference}`,
                notes: `Bulk reversing entry for ${entry.reference}`,
                created_by: userId,
                status: 'posted',
                posted_by: userId,
                posted_at: new Date().toISOString(),
                reversal_of: entry.id,
              })
              .select()
              .single();
            
            if (entryError) throw entryError;
            
            // Create reversed lines (swap debit and credit)
            const reversedLines = lines.map((line, index) => ({
              journal_entry_id: reversalEntry.id,
              account_id: line.account_id,
              description: line.description || null,
              debit: Number(line.credit) || 0,
              credit: Number(line.debit) || 0,
              line_order: index,
            }));
            
            const { error: linesError } = await supabase
              .from('journal_entry_lines')
              .insert(reversedLines);
            
            if (linesError) throw linesError;
            
            // Mark the original entry as reversed
            const { error: updateError } = await supabase
              .from('journal_entries')
              .update({
                status: 'reversed',
                reversed_by: userId,
                reversed_at: new Date().toISOString(),
              })
              .eq('id', entry.id);
            
            if (updateError) throw updateError;
            
            progress.succeeded++;
          } catch (err: any) {
            progress.failed++;
            errors.push(`${entry.reference}: ${err.message}`);
          } finally {
            progress.processed++;
            onProgress?.(progress);
          }
        }));
      }
      
      // After all reversals, recalculate all account balances
      const { error: recalcError } = await supabase.rpc('recalculate_all_account_balances', {
        p_organization_id: organizationId,
      });
      
      if (recalcError) {
        console.warn('Balance recalculation warning:', recalcError);
      }
      
      return {
        total: progress.total,
        succeeded: progress.succeeded,
        failed: progress.failed,
        errors: errors.length > 0 ? errors : undefined,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['financial-reports'] });
      
      if (result.total === 0) {
        toast.info('No posted journal entries found to reverse');
      } else if (result.failed === 0) {
        toast.success(`Successfully reversed ${result.succeeded} journal entries`);
      } else {
        toast.warning(`Reversed ${result.succeeded} entries, ${result.failed} failed`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Bulk reversal failed: ${error.message}`);
    },
  });
}
