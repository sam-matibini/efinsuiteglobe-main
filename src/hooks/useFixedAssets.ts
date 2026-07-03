import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { addMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import { getFiscalYearForDate, getFiscalYearStart, getFiscalYearEnd, isInFiscalYear } from '@/lib/fiscalYearUtils';
import { parseLocalDate } from '@/lib/utils';

// Types
export interface FixedAssetCategory {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  default_useful_life_months: number;
  default_depreciation_method: string;
  default_declining_rate: number | null;
  asset_account_id: string | null;
  depreciation_account_id: string | null;
  accumulated_depreciation_account_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FixedAsset {
  id: string;
  organization_id: string;
  category_id: string | null;
  asset_number: string;
  name: string;
  description: string | null;
  serial_number: string | null;
  location: string | null;
  acquisition_date: string;
  acquisition_cost: number;
  acquisition_method: string;
  vendor_id: string | null;
  bill_id: string | null;
  useful_life_months: number;
  salvage_value: number;
  depreciation_method: string;
  declining_rate: number | null;
  depreciation_start_date: string;
  accumulated_depreciation: number;
  book_value: number;
  asset_account_id: string | null;
  depreciation_account_id: string | null;
  accumulated_depreciation_account_id: string | null;
  status: string;
  disposal_date: string | null;
  disposal_amount: number | null;
  disposal_method: string | null;
  disposal_journal_entry_id: string | null;
  half_year_convention: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category?: FixedAssetCategory;
}

export interface DepreciationEntry {
  id: string;
  asset_id: string;
  period_start: string;
  period_end: string;
  depreciation_amount: number;
  accumulated_depreciation: number;
  book_value: number;
  status: string;
  journal_entry_id: string | null;
  posted_at: string | null;
  posted_by: string | null;
  created_at: string;
}

// Categories Hooks
export function useFixedAssetCategories(organizationId?: string) {
  return useQuery({
    queryKey: ['fixed-asset-categories', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('fixed_asset_categories')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');
      
      if (error) throw error;
      return data as FixedAssetCategory[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateFixedAssetCategory(organizationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (category: { name: string; description?: string; default_useful_life_months?: number; default_depreciation_method?: string }) => {
      if (!organizationId) throw new Error('Organization ID required');
      const { data, error } = await supabase
        .from('fixed_asset_categories')
        .insert({ 
          name: category.name, 
          description: category.description,
          default_useful_life_months: category.default_useful_life_months || 60,
          default_depreciation_method: category.default_depreciation_method || 'straight_line',
          default_declining_rate: 20,
          is_active: true,
          organization_id: organizationId 
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-asset-categories'] });
      toast({ title: 'Category created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create category', description: error.message, variant: 'destructive' });
    },
  });
}

// Assets Hooks
export function useFixedAssets(organizationId?: string) {
  return useQuery({
    queryKey: ['fixed-assets', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('fixed_assets')
        .select('*')
        .eq('organization_id', organizationId)
        .order('asset_number');
      
      if (error) throw error;
      return data as FixedAsset[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateFixedAsset(organizationId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (asset: {
      asset_number: string;
      name: string;
      description?: string | null;
      serial_number?: string | null;
      location?: string | null;
      category_id?: string | null;
      acquisition_date: string;
      acquisition_cost: number;
      acquisition_method?: string;
      vendor_id?: string | null;
      useful_life_months: number;
      salvage_value?: number;
      depreciation_method: string;
      declining_rate?: number | null;
      depreciation_start_date: string;
      asset_account_id?: string | null;
      depreciation_account_id?: string | null;
      accumulated_depreciation_account_id?: string | null;
      notes?: string | null;
    }) => {
      if (!organizationId) throw new Error('Organization ID required');
      const bookValue = asset.acquisition_cost - 0;
      
      const { data, error } = await supabase
        .from('fixed_assets')
        .insert({ 
          ...asset, 
          organization_id: organizationId,
          book_value: bookValue,
          accumulated_depreciation: 0,
          status: 'active',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      toast({ title: 'Asset created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create asset', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateFixedAsset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...asset }: Partial<FixedAsset> & { id: string }) => {
      const { data, error } = await supabase
        .from('fixed_assets')
        .update(asset)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      toast({ title: 'Asset updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update asset', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteFixedAsset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fixed_assets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      toast({ title: 'Asset deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete asset', description: error.message, variant: 'destructive' });
    },
  });
}

// Depreciation Entries Hooks
export function useDepreciationEntries(assetId: string) {
  return useQuery({
    queryKey: ['depreciation-entries', assetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('depreciation_entries')
        .select('*')
        .eq('asset_id', assetId)
        .order('period_start');
      
      if (error) throw error;
      return data as DepreciationEntry[];
    },
    enabled: !!assetId,
  });
}

// Depreciation Calculations
export function calculateStraightLineDepreciation(
  acquisitionCost: number,
  salvageValue: number,
  usefulLifeMonths: number
): number {
  const depreciableAmount = acquisitionCost - salvageValue;
  return depreciableAmount / usefulLifeMonths;
}

export function calculateDecliningBalanceDepreciation(
  bookValue: number,
  annualRate: number
): number {
  return (bookValue * (annualRate / 100)) / 12;
}

/**
 * Generate depreciation schedule for an asset
 * @param asset - The fixed asset
 * @param fiscalYearEndMonth - Optional: The organization's fiscal year end month (1-12). 
 *                             Defaults to 12 (calendar year) for backward compatibility.
 * @returns Array of depreciation entries
 */
export function generateDepreciationSchedule(
  asset: FixedAsset, 
  fiscalYearEndMonth: number = 12
): Omit<DepreciationEntry, 'id' | 'created_at'>[] {
  const schedule: Omit<DepreciationEntry, 'id' | 'created_at'>[] = [];
  
  const startDate = parseLocalDate(asset.depreciation_start_date);
  const endDate = addMonths(startDate, asset.useful_life_months);
  
  // Determine the FIRST FISCAL YEAR the asset is in service
  // This is critical for half-year convention
  const firstFiscalYear = getFiscalYearForDate(startDate, fiscalYearEndMonth);
  
  let currentDate = startOfMonth(startDate);
  let accumulatedDepreciation = asset.accumulated_depreciation || 0;
  let bookValue = asset.acquisition_cost - accumulatedDepreciation;
  
  while (currentDate < endDate && bookValue > asset.salvage_value) {
    let monthlyDepreciation: number;
    
    // Determine which fiscal year this month belongs to
    const currentFiscalYear = getFiscalYearForDate(currentDate, fiscalYearEndMonth);
    const isInFirstFiscalYear = currentFiscalYear === firstFiscalYear;
    
    if (asset.depreciation_method === 'straight_line') {
      monthlyDepreciation = calculateStraightLineDepreciation(
        asset.acquisition_cost,
        asset.salvage_value,
        asset.useful_life_months
      );
    } else {
      monthlyDepreciation = calculateDecliningBalanceDepreciation(
        bookValue,
        asset.declining_rate || 20
      );
    }
    
    // Apply half-year convention: 50% depreciation in first FISCAL year of ownership
    // This follows CRA CCA rules where only 50% of normal depreciation is allowed
    // in the first fiscal year an asset is put into service
    if (asset.half_year_convention && isInFirstFiscalYear) {
      monthlyDepreciation = monthlyDepreciation * 0.5;
    }
    
    if (bookValue - monthlyDepreciation < asset.salvage_value) {
      monthlyDepreciation = bookValue - asset.salvage_value;
    }
    
    if (monthlyDepreciation <= 0) break;
    
    accumulatedDepreciation += monthlyDepreciation;
    bookValue -= monthlyDepreciation;
    
    schedule.push({
      asset_id: asset.id,
      period_start: format(currentDate, 'yyyy-MM-dd'),
      period_end: format(endOfMonth(currentDate), 'yyyy-MM-dd'),
      depreciation_amount: Math.round(monthlyDepreciation * 100) / 100,
      accumulated_depreciation: Math.round(accumulatedDepreciation * 100) / 100,
      book_value: Math.round(bookValue * 100) / 100,
      status: 'scheduled',
      journal_entry_id: null,
      posted_at: null,
      posted_by: null,
    });
    
    currentDate = addMonths(currentDate, 1);
  }
  
  return schedule;
}

/**
 * Get depreciation entries for a specific fiscal year
 * @param asset - The fixed asset
 * @param fiscalYear - The fiscal year number
 * @param fiscalYearEndMonth - The organization's fiscal year end month (1-12)
 * @returns Array of depreciation entries for that fiscal year
 */
export function getDepreciationForFiscalYear(
  asset: FixedAsset,
  fiscalYear: number,
  fiscalYearEndMonth: number = 12
): { entries: Omit<DepreciationEntry, 'id' | 'created_at'>[]; total: number } {
  const schedule = generateDepreciationSchedule(asset, fiscalYearEndMonth);
  const fyStart = getFiscalYearStart(fiscalYear, fiscalYearEndMonth);
  const fyEnd = getFiscalYearEnd(fiscalYear, fiscalYearEndMonth);
  
  const entries = schedule.filter(entry => {
    const entryDate = parseLocalDate(entry.period_start);
    return entryDate >= fyStart && entryDate <= fyEnd;
  });
  
  const total = entries.reduce((sum, e) => sum + e.depreciation_amount, 0);
  
  return { entries, total: Math.round(total * 100) / 100 };
}
