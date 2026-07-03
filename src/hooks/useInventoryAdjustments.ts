import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface InventoryAdjustment {
  id: string;
  organization_id: string;
  adjustment_number: string;
  adjustment_date: string;
  reason: string;
  notes: string | null;
  status: string;
  journal_entry_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryAdjustmentLine {
  id: string;
  adjustment_id: string;
  item_id: string;
  quantity_on_hand: number;
  quantity_counted: number;
  quantity_difference: number;
  unit_cost: number;
  total_adjustment: number;
  line_order: number;
  created_at: string;
}

export interface AdjustmentLineInput {
  item_id: string;
  quantity_on_hand: number;
  quantity_counted: number;
  quantity_difference: number;
  unit_cost: number;
  total_adjustment: number;
  line_order: number;
}

export interface AdjustmentInput {
  adjustment_date: string;
  reason: string;
  notes?: string;
  lines: AdjustmentLineInput[];
}

export function useInventoryAdjustments(organizationId?: string) {
  return useQuery({
    queryKey: ['inventory-adjustments', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('inventory_adjustments')
        .select(`
          *,
          lines:inventory_adjustment_lines(
            *,
            item:inventory_items(sku, name)
          )
        `)
        .eq('organization_id', organizationId)
        .order('adjustment_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
}

export function useCreateInventoryAdjustment(organizationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: AdjustmentInput) => {
      if (!organizationId) throw new Error('Organization ID required');
      if (!user?.id) throw new Error('User not authenticated');

      // Generate adjustment number
      const { data: existingAdjustments } = await supabase
        .from('inventory_adjustments')
        .select('adjustment_number')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (existingAdjustments && existingAdjustments.length > 0) {
        const lastNum = parseInt(existingAdjustments[0].adjustment_number.replace('ADJ-', '')) || 0;
        nextNumber = lastNum + 1;
      }
      const adjustmentNumber = `ADJ-${String(nextNumber).padStart(5, '0')}`;

      // Calculate total adjustment value for journal entry
      const totalDecrease = input.lines
        .filter(l => l.quantity_difference < 0)
        .reduce((sum, l) => sum + Math.abs(l.total_adjustment), 0);
      
      const totalIncrease = input.lines
        .filter(l => l.quantity_difference > 0)
        .reduce((sum, l) => sum + l.total_adjustment, 0);

      let journalEntryId: string | null = null;

      // Create journal entry if there's a net change
      const netChange = totalIncrease - totalDecrease;
      if (netChange !== 0) {
        // Get inventory and adjustment expense accounts
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, code, name, account_type')
          .eq('organization_id', organizationId);

        const inventoryAccount = accounts?.find(a => 
          a.code === '1300' || a.name.toLowerCase().includes('inventory') && a.account_type === 'asset'
        );
        const adjustmentExpenseAccount = accounts?.find(a => 
          a.code === '5400' || a.name.toLowerCase().includes('inventory adjustment') || 
          (a.account_type === 'expense' && a.name.toLowerCase().includes('cost'))
        );

        if (inventoryAccount && adjustmentExpenseAccount) {
          const journalRef = `INV-ADJ-${adjustmentNumber}`;
          
          // Create journal entry
          const { data: journalEntry, error: jeError } = await supabase
            .from('journal_entries')
            .insert({
              organization_id: organizationId,
              reference: journalRef,
              entry_date: input.adjustment_date,
              description: `Inventory adjustment: ${input.reason}${input.notes ? ' - ' + input.notes : ''}`,
              status: 'posted',
              created_by: user.id,
              posted_by: user.id,
              posted_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (jeError) throw jeError;
          journalEntryId = journalEntry.id;

          // Create journal entry lines
          const journalLines = [];
          
          if (netChange < 0) {
            // Write-down: Debit Expense, Credit Inventory
            journalLines.push({
              journal_entry_id: journalEntry.id,
              account_id: adjustmentExpenseAccount.id,
              description: 'Inventory write-down',
              debit: Math.abs(netChange),
              credit: 0,
              line_order: 0,
            });
            journalLines.push({
              journal_entry_id: journalEntry.id,
              account_id: inventoryAccount.id,
              description: 'Inventory reduction',
              debit: 0,
              credit: Math.abs(netChange),
              line_order: 1,
            });
          } else {
            // Write-up: Debit Inventory, Credit Expense (or income)
            journalLines.push({
              journal_entry_id: journalEntry.id,
              account_id: inventoryAccount.id,
              description: 'Inventory increase',
              debit: netChange,
              credit: 0,
              line_order: 0,
            });
            journalLines.push({
              journal_entry_id: journalEntry.id,
              account_id: adjustmentExpenseAccount.id,
              description: 'Inventory adjustment credit',
              debit: 0,
              credit: netChange,
              line_order: 1,
            });
          }

          const { error: linesError } = await supabase
            .from('journal_entry_lines')
            .insert(journalLines);

          if (linesError) throw linesError;
        }
      }

      // Create the adjustment record
      const { data: adjustment, error: adjError } = await supabase
        .from('inventory_adjustments')
        .insert({
          organization_id: organizationId,
          adjustment_number: adjustmentNumber,
          adjustment_date: input.adjustment_date,
          reason: input.reason,
          notes: input.notes || null,
          status: 'posted',
          journal_entry_id: journalEntryId,
          created_by: user.id,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (adjError) throw adjError;

      // Create adjustment lines
      const adjustmentLines = input.lines.map(line => ({
        adjustment_id: adjustment.id,
        item_id: line.item_id,
        quantity_on_hand: line.quantity_on_hand,
        quantity_counted: line.quantity_counted,
        quantity_difference: line.quantity_difference,
        unit_cost: line.unit_cost,
        total_adjustment: line.total_adjustment,
        line_order: line.line_order,
      }));

      const { error: linesError } = await supabase
        .from('inventory_adjustment_lines')
        .insert(adjustmentLines);

      if (linesError) throw linesError;

      // Update inventory quantities and create transactions
      for (const line of input.lines) {
        // Update item quantity
        const newQty = line.quantity_counted;
        await supabase
          .from('inventory_items')
          .update({ quantity_on_hand: newQty })
          .eq('id', line.item_id);

        // Create inventory transaction
        await supabase
          .from('inventory_transactions')
          .insert({
            organization_id: organizationId,
            item_id: line.item_id,
            transaction_type: line.quantity_difference > 0 ? 'adjustment_in' : 'adjustment_out',
            transaction_date: input.adjustment_date,
            reference: adjustmentNumber,
            quantity: Math.abs(line.quantity_difference),
            unit_cost: line.unit_cost,
            total_cost: Math.abs(line.total_adjustment),
            journal_entry_id: journalEntryId,
            notes: `Inventory adjustment: ${input.reason}`,
            created_by: user.id,
          });
      }

      return adjustment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({ title: 'Inventory adjustment posted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create adjustment', description: error.message, variant: 'destructive' });
    },
  });
}
