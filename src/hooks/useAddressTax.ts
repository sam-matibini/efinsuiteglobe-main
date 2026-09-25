/**
 * Phase 12 — Address-tax + nexus hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';
import type { AddressTaxRequest, AddressTaxResponse } from '@/lib/addressTax/types';

export function useTaxProviderSettings() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tax-provider-settings', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_provider_settings').select('*').eq('organization_id', orgId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: {
      provider: 'avalara' | 'taxjar' | 'none';
      environment: 'sandbox' | 'production';
      company_code?: string;
      default_origin_address?: unknown;
      auto_calculate_on_invoice?: boolean;
      auto_validate_addresses?: boolean;
    }) => {
      if (!orgId) throw new Error('No org');
      const { error } = await supabase
        .from('tax_provider_settings')
        .upsert([{ organization_id: orgId, ...input } as never], { onConflict: 'organization_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-provider-settings', orgId] });
      toast.success('Tax provider saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { settings: query.data, isLoading: query.isLoading, upsert };
}

export function useAddressTax() {
  const calculate = useMutation({
    mutationFn: async (req: AddressTaxRequest): Promise<AddressTaxResponse> => {
      const { data, error } = await supabase.functions.invoke('tax-address-calculate', { body: req });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as AddressTaxResponse;
    },
    onError: (e: Error) => toast.error(`Tax calc failed: ${e.message}`),
  });

  const validate = useMutation({
    mutationFn: async (input: { organizationId: string; address: Record<string, unknown> }) => {
      const { data, error } = await supabase.functions.invoke('tax-address-validate', { body: input });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onError: (e: Error) => toast.error(`Address validation failed: ${e.message}`),
  });

  return { calculate, validate };
}

export function useNexusRegistrations() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tax-nexus', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_nexus_registrations').select('*').eq('organization_id', orgId!).order('region_code');
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: {
      id?: string;
      country_code?: string;
      region_code: string;
      registration_number?: string;
      effective_date: string;
      expiry_date?: string | null;
      filing_frequency?: 'monthly' | 'quarterly' | 'annually' | null;
      economic_nexus_threshold_amount?: number | null;
      economic_nexus_threshold_transactions?: number | null;
      is_active?: boolean;
      notes?: string | null;
    }) => {
      if (!orgId) throw new Error('No org');
      const payload = { organization_id: orgId, country_code: 'US', ...input };
      const { error } = input.id
        ? await supabase.from('tax_nexus_registrations').update(payload).eq('id', input.id)
        : await supabase.from('tax_nexus_registrations').upsert([payload], { onConflict: 'organization_id,country_code,region_code' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-nexus', orgId] });
      toast.success('Nexus saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_nexus_registrations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-nexus', orgId] }),
  });

  return { registrations: query.data ?? [], isLoading: query.isLoading, upsert, remove };
}

export function useEconomicNexusTracker() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  return useQuery({
    queryKey: ['tax-nexus-tracker', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_economic_nexus_tracker').select('*').eq('organization_id', orgId!)
        .order('period_end', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useExemptionCertificates(customerId?: string) {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tax-exemptions', orgId, customerId ?? 'all'],
    enabled: !!orgId,
    queryFn: async () => {
      let q = supabase.from('tax_exemption_certificates').select('*').eq('organization_id', orgId!);
      if (customerId) q = q.eq('customer_id', customerId);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: {
      id?: string;
      customer_id?: string | null;
      certificate_number: string;
      exemption_reason: string;
      exemption_type?: string;
      region_code?: string | null;
      issued_date?: string | null;
      expiry_date?: string | null;
      document_url?: string | null;
      is_active?: boolean;
      notes?: string | null;
    }) => {
      if (!orgId) throw new Error('No org');
      const payload = { organization_id: orgId, ...input };
      const { error } = input.id
        ? await supabase.from('tax_exemption_certificates').update(payload).eq('id', input.id)
        : await supabase.from('tax_exemption_certificates').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-exemptions', orgId] });
      toast.success('Certificate saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { certificates: query.data ?? [], isLoading: query.isLoading, upsert };
}
