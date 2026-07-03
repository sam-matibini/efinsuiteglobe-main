import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';

export interface DepreciationPostingResult {
  assetId: string;
  assetNumber: string;
  assetName: string;
  periodStart: string;
  periodEnd: string;
  depreciationAmount: number;
  journalEntryId: string;
  success: boolean;
  error?: string;
}

interface PostDepreciationParams {
  organizationId: string;
  assetId: string;
  assetNumber: string;
  assetName: string;
  depreciationAccountId: string;
  accumulatedDepreciationAccountId: string;
  depreciationAmount: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Hook to post depreciation entries to the General Ledger
 * Creates balanced journal entries with:
 * - Debit: Depreciation Expense
 * - Credit: Accumulated Depreciation
 */
export function usePostDepreciationToGL() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: PostDepreciationParams): Promise<DepreciationPostingResult> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!params.depreciationAccountId || !params.accumulatedDepreciationAccountId) {
        throw new Error('Depreciation accounts not configured for this asset');
      }

      // Create journal entry as draft first
      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          organization_id: params.organizationId,
          entry_date: format(params.periodEnd, 'yyyy-MM-dd'),
          reference: `DEP-${params.assetNumber}-${format(params.periodStart, 'yyyyMM')}`,
          description: `Depreciation - ${params.assetName} (${format(params.periodStart, 'MMM yyyy')})`,
          status: 'draft',
          journal_type: 'depreciation',
          created_by: user?.id,
        })
        .select()
        .single();

      if (jeError) throw jeError;

      // Create journal lines
      const lines = [
        {
          journal_entry_id: journalEntry.id,
          account_id: params.depreciationAccountId,
          description: `Depreciation expense - ${params.assetName}`,
          debit: params.depreciationAmount,
          credit: 0,
        },
        {
          journal_entry_id: journalEntry.id,
          account_id: params.accumulatedDepreciationAccountId,
          description: `Accumulated depreciation - ${params.assetName}`,
          debit: 0,
          credit: params.depreciationAmount,
        },
      ];

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(lines);

      if (linesError) {
        // Rollback journal entry
        await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
        throw linesError;
      }

      // Post the journal entry
      const { error: postError } = await supabase
        .from('journal_entries')
        .update({ 
          status: 'posted', 
          posted_at: new Date().toISOString(),
          posted_by: user?.id,
        })
        .eq('id', journalEntry.id);

      if (postError) throw postError;

      // Update depreciation_entries table if it exists
      await supabase
        .from('depreciation_entries')
        .update({ 
          status: 'posted', 
          journal_entry_id: journalEntry.id,
          posted_at: new Date().toISOString(),
          posted_by: user?.id,
        })
        .eq('asset_id', params.assetId)
        .eq('period_start', format(params.periodStart, 'yyyy-MM-dd'));

      // Update asset accumulated depreciation and book value
      const { data: asset } = await supabase
        .from('fixed_assets')
        .select('accumulated_depreciation, book_value')
        .eq('id', params.assetId)
        .single();

      if (asset) {
        await supabase
          .from('fixed_assets')
          .update({
            accumulated_depreciation: (asset.accumulated_depreciation || 0) + params.depreciationAmount,
            book_value: (asset.book_value || 0) - params.depreciationAmount,
          })
          .eq('id', params.assetId);
      }

      return {
        assetId: params.assetId,
        assetNumber: params.assetNumber,
        assetName: params.assetName,
        periodStart: format(params.periodStart, 'yyyy-MM-dd'),
        periodEnd: format(params.periodEnd, 'yyyy-MM-dd'),
        depreciationAmount: params.depreciationAmount,
        journalEntryId: journalEntry.id,
        success: true,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['depreciation-entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to post depreciation', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

/**
 * Hook to run batch depreciation for all active assets
 */
export function useBatchDepreciationPosting() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      organizationId: string;
      periodDate: Date;
      assets: Array<{
        id: string;
        asset_number: string;
        name: string;
        depreciation_account_id: string | null;
        accumulated_depreciation_account_id: string | null;
        acquisition_cost: number;
        salvage_value: number;
        useful_life_months: number;
        depreciation_method: string;
        declining_rate: number | null;
        book_value: number;
        half_year_convention?: boolean;
        depreciation_start_date?: string;
      }>;
    }): Promise<DepreciationPostingResult[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      const results: DepreciationPostingResult[] = [];
      
      const periodStart = startOfMonth(params.periodDate);
      const periodEnd = endOfMonth(params.periodDate);

      for (const asset of params.assets) {
        try {
          if (!asset.depreciation_account_id || !asset.accumulated_depreciation_account_id) {
            results.push({
              assetId: asset.id,
              assetNumber: asset.asset_number,
              assetName: asset.name,
              periodStart: format(periodStart, 'yyyy-MM-dd'),
              periodEnd: format(periodEnd, 'yyyy-MM-dd'),
              depreciationAmount: 0,
              journalEntryId: '',
              success: false,
              error: 'GL accounts not configured',
            });
            continue;
          }

          // Calculate depreciation
          let depAmount: number;
          if (asset.depreciation_method === 'straight_line') {
            const depreciableAmount = asset.acquisition_cost - asset.salvage_value;
            depAmount = depreciableAmount / asset.useful_life_months;
          } else {
            depAmount = (asset.book_value * ((asset.declining_rate || 20) / 100)) / 12;
          }

          // Apply half-year convention: 50% depreciation in the first calendar year
          if (asset.half_year_convention && asset.depreciation_start_date) {
            const startYear = parseInt(asset.depreciation_start_date.substring(0, 4), 10);
            const periodYear = params.periodDate.getFullYear();
            if (periodYear === startYear) {
              depAmount = depAmount * 0.5;
            }
          }

          // Don't depreciate below salvage value
          if (asset.book_value - depAmount < asset.salvage_value) {
            depAmount = Math.max(0, asset.book_value - asset.salvage_value);
          }

          if (depAmount <= 0) {
            results.push({
              assetId: asset.id,
              assetNumber: asset.asset_number,
              assetName: asset.name,
              periodStart: format(periodStart, 'yyyy-MM-dd'),
              periodEnd: format(periodEnd, 'yyyy-MM-dd'),
              depreciationAmount: 0,
              journalEntryId: '',
              success: false,
              error: 'Asset fully depreciated',
            });
            continue;
          }

          // Create journal entry
          const { data: journalEntry, error: jeError } = await supabase
            .from('journal_entries')
            .insert({
              organization_id: params.organizationId,
              entry_date: format(periodEnd, 'yyyy-MM-dd'),
              reference: `DEP-${asset.asset_number}-${format(periodStart, 'yyyyMM')}`,
              description: `Depreciation - ${asset.name} (${format(periodStart, 'MMM yyyy')})`,
              status: 'draft',
              journal_type: 'depreciation',
              created_by: user?.id,
            })
            .select()
            .single();

          if (jeError) throw jeError;

          // Create lines
          const { error: linesError } = await supabase
            .from('journal_entry_lines')
            .insert([
              {
                journal_entry_id: journalEntry.id,
                account_id: asset.depreciation_account_id,
                description: `Depreciation expense - ${asset.name}`,
                debit: Math.round(depAmount * 100) / 100,
                credit: 0,
              },
              {
                journal_entry_id: journalEntry.id,
                account_id: asset.accumulated_depreciation_account_id,
                description: `Accumulated depreciation - ${asset.name}`,
                debit: 0,
                credit: Math.round(depAmount * 100) / 100,
              },
            ]);

          if (linesError) {
            await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
            throw linesError;
          }

          // Post
          await supabase
            .from('journal_entries')
            .update({ status: 'posted', posted_at: new Date().toISOString(), posted_by: user?.id })
            .eq('id', journalEntry.id);

          // Update asset
          await supabase
            .from('fixed_assets')
            .update({
              accumulated_depreciation: (asset.book_value > asset.acquisition_cost ? 0 : asset.acquisition_cost - asset.book_value) + depAmount,
              book_value: asset.book_value - depAmount,
            })
            .eq('id', asset.id);

          results.push({
            assetId: asset.id,
            assetNumber: asset.asset_number,
            assetName: asset.name,
            periodStart: format(periodStart, 'yyyy-MM-dd'),
            periodEnd: format(periodEnd, 'yyyy-MM-dd'),
            depreciationAmount: Math.round(depAmount * 100) / 100,
            journalEntryId: journalEntry.id,
            success: true,
          });
        } catch (error: any) {
          results.push({
            assetId: asset.id,
            assetNumber: asset.asset_number,
            assetName: asset.name,
            periodStart: format(periodStart, 'yyyy-MM-dd'),
            periodEnd: format(periodEnd, 'yyyy-MM-dd'),
            depreciationAmount: 0,
            journalEntryId: '',
            success: false,
            error: error.message,
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const totalAmount = results.filter(r => r.success).reduce((sum, r) => sum + r.depreciationAmount, 0);
      
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      queryClient.invalidateQueries({ queryKey: ['depreciation-entries'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      
      toast({ 
        title: 'Depreciation Posted', 
        description: `${successCount} entries posted, total: $${totalAmount.toLocaleString()}` 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Batch depreciation failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}
