import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { parseLocalDate } from '@/lib/utils';

// Types
export interface InventoryCategory {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  organization_id: string;
  category_id: string | null;
  sku: string;
  name: string;
  description: string | null;
  unit_of_measure: string;
  cost_price: number;
  selling_price: number;
  quantity_on_hand: number;
  reorder_point: number | null;
  reorder_quantity: number | null;
  inventory_account_id: string | null;
  cogs_account_id: string | null;
  income_account_id: string | null;
  is_taxable: boolean;
  tax_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  category?: InventoryCategory;
}

export interface InventoryLot {
  id: string;
  item_id: string;
  lot_number: string | null;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  received_date: string;
  expiry_date: string | null;
  reference: string | null;
  created_at: string;
}

export interface InventoryTransaction {
  id: string;
  organization_id: string;
  item_id: string;
  lot_id: string | null;
  transaction_type: string;
  transaction_date: string;
  reference: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  bill_id: string | null;
  invoice_id: string | null;
  journal_entry_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  item?: InventoryItem;
}

// Categories Hooks
export function useInventoryCategories(organizationId?: string) {
  return useQuery({
    queryKey: ['inventory-categories', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('inventory_categories')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');
      
      if (error) throw error;
      return data as InventoryCategory[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateInventoryCategory(organizationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (category: { name: string; description?: string }) => {
      if (!organizationId) throw new Error('Organization ID required');
      const { data, error } = await supabase
        .from('inventory_categories')
        .insert({ name: category.name, description: category.description, organization_id: organizationId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-categories'] });
      toast({ title: 'Category created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create category', description: error.message, variant: 'destructive' });
    },
  });
}

// Items Hooks
export function useInventoryItems(organizationId?: string) {
  return useQuery({
    queryKey: ['inventory-items', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');
      
      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateInventoryItem(organizationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: Omit<InventoryItem, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => {
      if (!organizationId) throw new Error('Organization ID required');
      const { data, error } = await supabase
        .from('inventory_items')
        .insert({ ...item, organization_id: organizationId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast({ title: 'Item created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create item', description: error.message, variant: 'destructive' });
    },
  });
}

export function useBulkCreateInventoryItems(organizationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (items: Omit<InventoryItem, 'id' | 'organization_id' | 'created_at' | 'updated_at'>[]) => {
      if (!organizationId) throw new Error('Organization ID required');
      
      const itemsWithOrg = items.map(item => ({
        ...item,
        organization_id: organizationId,
      }));

      const { data, error } = await supabase
        .from('inventory_items')
        .insert(itemsWithOrg)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast({ title: `${data.length} items imported successfully` });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to import items', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...item }: Partial<InventoryItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('inventory_items')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast({ title: 'Item updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update item', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast({ title: 'Item deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete item', description: error.message, variant: 'destructive' });
    },
  });
}

// Lots Hooks
export function useInventoryLots(itemId?: string) {
  return useQuery({
    queryKey: ['inventory-lots', itemId],
    queryFn: async () => {
      let query = supabase
        .from('inventory_lots')
        .select('*')
        .order('received_date', { ascending: true });
      
      if (itemId) {
        query = query.eq('item_id', itemId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as InventoryLot[];
    },
    enabled: true,
  });
}

export function useCreateInventoryLot() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (lot: {
      item_id: string;
      lot_number: string | null;
      quantity_received: number;
      quantity_remaining: number;
      unit_cost: number;
      received_date: string;
      expiry_date: string | null;
      reference: string | null;
    }) => {
      const { data, error } = await supabase
        .from('inventory_lots')
        .insert(lot)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      toast({ title: 'Lot created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create lot', description: error.message, variant: 'destructive' });
    },
  });
}

// Transactions Hooks
export function useInventoryTransactions(organizationId?: string, itemId?: string) {
  return useQuery({
    queryKey: ['inventory-transactions', organizationId, itemId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabase
        .from('inventory_transactions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('transaction_date', { ascending: false });
      
      if (itemId) {
        query = query.eq('item_id', itemId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as InventoryTransaction[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateInventoryTransaction(organizationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (transaction: {
      item_id: string;
      transaction_type: string;
      transaction_date: string;
      reference: string | null;
      quantity: number;
      unit_cost: number;
      total_cost: number;
      notes: string | null;
    }) => {
      if (!organizationId) throw new Error('Organization ID required');
      const { data, error } = await supabase
        .from('inventory_transactions')
        .insert({ ...transaction, organization_id: organizationId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-lots'] });
      toast({ title: 'Transaction recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record transaction', description: error.message, variant: 'destructive' });
    },
  });
}

// FIFO Cost Calculation
export function calculateFIFOCost(lots: InventoryLot[], quantityNeeded: number): { totalCost: number; lotsUsed: { lotId: string; quantity: number; cost: number }[] } {
  const lotsUsed: { lotId: string; quantity: number; cost: number }[] = [];
  let remainingQuantity = quantityNeeded;
  let totalCost = 0;

  const sortedLots = [...lots].sort((a, b) => 
    parseLocalDate(a.received_date).getTime() - parseLocalDate(b.received_date).getTime()
  );

  for (const lot of sortedLots) {
    if (remainingQuantity <= 0) break;
    if (lot.quantity_remaining <= 0) continue;

    const quantityFromLot = Math.min(lot.quantity_remaining, remainingQuantity);
    const costFromLot = quantityFromLot * lot.unit_cost;

    lotsUsed.push({
      lotId: lot.id,
      quantity: quantityFromLot,
      cost: costFromLot,
    });

    totalCost += costFromLot;
    remainingQuantity -= quantityFromLot;
  }

  return { totalCost, lotsUsed };
}
