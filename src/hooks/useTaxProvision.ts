/**
 * Phase 14 — Tax Provisioning hooks (ASC 740 / IAS 12).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';
import { computeProvision, buildEtrReconciliation } from '@/lib/taxProvision/calculator';
import type {
  ProvisionPeriod,
  JurisdictionRate,
  TemporaryDifference,
  TempDiffMovement,
  ProvisionAdjustment,
  NolCarryforward,
  ProvisionFramework,
  ProvisionPeriodType,
} from '@/lib/taxProvision/types';

export function useProvisionPeriods() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tax-provision-periods', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_provision_periods')
        .select('*')
        .eq('organization_id', orgId!)
        .order('period_end', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProvisionPeriod[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: {
      period_label: string;
      period_start: string;
      period_end: string;
      period_type: ProvisionPeriodType;
      reporting_framework: ProvisionFramework;
      pretax_book_income_cents: number;
      notes?: string | null;
    }) => {
      if (!orgId) throw new Error('No organization');
      const { data, error } = await supabase
        .from('tax_provision_periods')
        .insert({ organization_id: orgId, ...input })
        .select()
        .single();
      if (error) throw error;
      return data as ProvisionPeriod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-provision-periods', orgId] });
      toast.success('Provision period created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (input: Partial<ProvisionPeriod> & { id: string }) => {
      const { id, ...rest } = input;
      const { error } = await supabase.from('tax_provision_periods').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-provision-periods', orgId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_provision_periods').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-provision-periods', orgId] }),
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, create, update, remove };
}

export function useJurisdictionRates() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tax-jurisdiction-rates', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_jurisdiction_rates')
        .select('*')
        .eq('organization_id', orgId!)
        .order('effective_from', { ascending: false });
      if (error) throw error;
      return (data ?? []) as JurisdictionRate[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Omit<JurisdictionRate, 'id' | 'organization_id'>) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('tax_jurisdiction_rates')
        .insert({ organization_id: orgId, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-jurisdiction-rates', orgId] });
      toast.success('Statutory rate added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_jurisdiction_rates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-jurisdiction-rates', orgId] }),
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, create, remove };
}

export function useTemporaryDifferences() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tax-temp-diffs', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_temporary_differences')
        .select('*')
        .eq('organization_id', orgId!)
        .order('name');
      if (error) throw error;
      return (data ?? []) as TemporaryDifference[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Omit<TemporaryDifference, 'id' | 'organization_id'>) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('tax_temporary_differences')
        .insert({ organization_id: orgId, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-temp-diffs', orgId] });
      toast.success('Temporary difference added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_temporary_differences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-temp-diffs', orgId] }),
    onError: (e: any) => toast.error(e.message),
  });

  return { ...query, create, remove };
}

export function useProvisionDetail(periodId: string | null) {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const movements = useQuery({
    queryKey: ['tax-temp-diff-movements', periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_temp_diff_movements')
        .select('*')
        .eq('provision_period_id', periodId!);
      if (error) throw error;
      return (data ?? []) as TempDiffMovement[];
    },
  });

  const adjustments = useQuery({
    queryKey: ['tax-provision-adjustments', periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_provision_adjustments')
        .select('*')
        .eq('provision_period_id', periodId!);
      if (error) throw error;
      return (data ?? []) as ProvisionAdjustment[];
    },
  });

  const upsertMovement = useMutation({
    mutationFn: async (input: Partial<TempDiffMovement> & { provision_period_id: string; temp_diff_id: string }) => {
      if (!orgId) throw new Error('No organization');
      const payload = { organization_id: orgId, ...input };
      const { error } = await supabase
        .from('tax_temp_diff_movements')
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-temp-diff-movements', periodId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addAdjustment = useMutation({
    mutationFn: async (input: Omit<ProvisionAdjustment, 'id'>) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('tax_provision_adjustments')
        .insert({ organization_id: orgId, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-provision-adjustments', periodId] });
      toast.success('Adjustment added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeAdjustment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_provision_adjustments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-provision-adjustments', periodId] }),
  });

  return { movements, adjustments, upsertMovement, addAdjustment, removeAdjustment };
}

export function useNolCarryforwards() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tax-nol-carryforwards', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_nol_carryforwards')
        .select('*')
        .eq('organization_id', orgId!)
        .order('origin_year', { ascending: false });
      if (error) throw error;
      return (data ?? []) as NolCarryforward[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Omit<NolCarryforward, 'id' | 'organization_id'>) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('tax_nol_carryforwards')
        .insert({ organization_id: orgId, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-nol-carryforwards', orgId] });
      toast.success('NOL carryforward added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_nol_carryforwards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-nol-carryforwards', orgId] }),
  });

  return { ...query, create, remove };
}

export { computeProvision, buildEtrReconciliation };
