import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ================================================================
// CCA CLASSES
// ================================================================

export interface CCAClass {
  id: string;
  organization_id: string | null;
  country_id: string | null;
  class_number: string;
  description: string | null;
  rate: number;
  method: string;
  half_year_rule: boolean;
  recapture_eligible: boolean;
  terminal_loss_eligible: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCCAClasses(organizationId?: string, countryId?: string) {
  return useQuery({
    queryKey: ['cca-classes', organizationId, countryId],
    queryFn: async () => {
      let query = supabase
        .from('cca_classes')
        .select('*')
        .eq('is_active', true);
      
      // Filter by country if provided
      if (countryId) {
        query = query.eq('country_id', countryId);
      }
      
      // Include org-specific overrides if org provided
      if (organizationId) {
        query = query.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
      } else {
        query = query.is('organization_id', null);
      }
      
      const { data, error } = await query.order('class_number');
      
      if (error) throw error;
      return data as CCAClass[];
    },
    enabled: true,
  });
}

// ================================================================
// ASSET MOVEMENTS
// ================================================================

export interface AssetMovement {
  id: string;
  asset_id: string;
  movement_type: string;
  movement_date: string;
  from_location: string | null;
  to_location: string | null;
  from_department: string | null;
  to_department: string | null;
  from_custodian: string | null;
  to_custodian: string | null;
  reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export function useAssetMovements(assetId?: string) {
  return useQuery({
    queryKey: ['asset-movements', assetId],
    queryFn: async () => {
      if (!assetId) return [];
      const { data, error } = await supabase
        .from('asset_movements')
        .select('*')
        .eq('asset_id', assetId)
        .order('movement_date', { ascending: false });
      
      if (error) throw error;
      return data as AssetMovement[];
    },
    enabled: !!assetId,
  });
}

export function useCreateAssetMovement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (movement: Omit<AssetMovement, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('asset_movements')
        .insert({ ...movement, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['asset-movements', variables.asset_id] });
      toast({ title: 'Movement recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record movement', description: error.message, variant: 'destructive' });
    },
  });
}

// ================================================================
// ASSET AUDIT TRAIL
// ================================================================

export interface AssetAuditEntry {
  id: string;
  asset_id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  performed_by: string | null;
  performed_at: string;
  details: Record<string, any> | null;
}

export function useAssetAuditTrail(assetId?: string) {
  return useQuery({
    queryKey: ['asset-audit-trail', assetId],
    queryFn: async () => {
      if (!assetId) return [];
      const { data, error } = await supabase
        .from('asset_audit_trail')
        .select('*')
        .eq('asset_id', assetId)
        .order('performed_at', { ascending: false });
      
      if (error) throw error;
      return data as AssetAuditEntry[];
    },
    enabled: !!assetId,
  });
}

export function useCreateAuditEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: Omit<AssetAuditEntry, 'id' | 'performed_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('asset_audit_trail')
        .insert({ ...entry, performed_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['asset-audit-trail', variables.asset_id] });
    },
  });
}

// ================================================================
// ASSET DISPOSALS
// ================================================================

export interface AssetDisposal {
  id: string;
  asset_id: string;
  disposal_type: string;
  disposal_date: string;
  proceeds: number;
  costs_of_disposal: number;
  net_proceeds: number;
  book_value_at_disposal: number;
  accumulated_dep_at_disposal: number;
  gain_loss: number;
  final_depreciation_amount: number;
  buyer_name: string | null;
  buyer_reference: string | null;
  approved_by: string | null;
  approved_at: string | null;
  journal_entry_id: string | null;
  depreciation_journal_entry_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export function useAssetDisposals(organizationId?: string) {
  return useQuery({
    queryKey: ['asset-disposals', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('asset_disposals')
        .select(`
          *,
          fixed_assets!inner(organization_id, asset_number, name)
        `)
        .eq('fixed_assets.organization_id', organizationId)
        .order('disposal_date', { ascending: false });
      
      if (error) throw error;
      return data as (AssetDisposal & { fixed_assets: { asset_number: string; name: string } })[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateAssetDisposal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (disposal: Omit<AssetDisposal, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create disposal record
      const { data, error } = await supabase
        .from('asset_disposals')
        .insert({ ...disposal, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update asset status
      await supabase
        .from('fixed_assets')
        .update({ 
          status: 'disposed', 
          disposal_date: disposal.disposal_date,
          disposal_amount: disposal.proceeds,
          disposal_method: disposal.disposal_type,
        })
        .eq('id', disposal.asset_id);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-disposals'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      toast({ title: 'Asset disposed successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to dispose asset', description: error.message, variant: 'destructive' });
    },
  });
}

// ================================================================
// ASSET REVALUATIONS
// ================================================================

export interface AssetRevaluation {
  id: string;
  asset_id: string;
  revaluation_type: string;
  revaluation_date: string;
  old_book_value: number;
  new_book_value: number;
  adjustment_amount: number;
  appraiser_name: string | null;
  appraiser_reference: string | null;
  journal_entry_id: string | null;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
}

export function useAssetRevaluations(assetId?: string) {
  return useQuery({
    queryKey: ['asset-revaluations', assetId],
    queryFn: async () => {
      if (!assetId) return [];
      const { data, error } = await supabase
        .from('asset_revaluations')
        .select('*')
        .eq('asset_id', assetId)
        .order('revaluation_date', { ascending: false });
      
      if (error) throw error;
      return data as AssetRevaluation[];
    },
    enabled: !!assetId,
  });
}

export function useCreateAssetRevaluation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (revaluation: Omit<AssetRevaluation, 'id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create revaluation record
      const { data, error } = await supabase
        .from('asset_revaluations')
        .insert({ ...revaluation, created_by: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update asset book value
      await supabase
        .from('fixed_assets')
        .update({ 
          book_value: revaluation.new_book_value,
          last_revaluation_date: revaluation.revaluation_date,
          revaluation_amount: revaluation.adjustment_amount,
          impairment_amount: revaluation.revaluation_type === 'impairment' 
            ? revaluation.adjustment_amount 
            : undefined,
        })
        .eq('id', revaluation.asset_id);
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['asset-revaluations', variables.asset_id] });
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      toast({ title: 'Revaluation recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record revaluation', description: error.message, variant: 'destructive' });
    },
  });
}

// ================================================================
// DISPOSAL CALCULATION HELPER
// ================================================================

export function calculateDisposalGainLoss(
  acquisitionCost: number,
  accumulatedDepreciation: number,
  proceeds: number,
  costsOfDisposal: number = 0
): { bookValue: number; netProceeds: number; gainLoss: number } {
  const bookValue = acquisitionCost - accumulatedDepreciation;
  const netProceeds = proceeds - costsOfDisposal;
  const gainLoss = netProceeds - bookValue;
  
  return {
    bookValue: Math.round(bookValue * 100) / 100,
    netProceeds: Math.round(netProceeds * 100) / 100,
    gainLoss: Math.round(gainLoss * 100) / 100,
  };
}

// ================================================================
// CCA TAX DEPRECIATION CALCULATION
// ================================================================

export function calculateCCADepreciation(
  undepreciatedCapitalCost: number,
  ccaRate: number,
  isFirstYear: boolean,
  halfYearRule: boolean
): number {
  let depreciation = undepreciatedCapitalCost * (ccaRate / 100);
  
  // Apply half-year rule in first year
  if (isFirstYear && halfYearRule) {
    depreciation = depreciation * 0.5;
  }
  
  return Math.round(depreciation * 100) / 100;
}
