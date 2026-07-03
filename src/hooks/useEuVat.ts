/**
 * Phase 13 — EU VAT OSS / VIES / Reverse-charge hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';
import { calculateEuVat } from '@/lib/euVat/calculator';
import { generateOssReturnXml, quarterDates } from '@/lib/euVat/ossXml';
import type { EuVatCalcInput, OssScheme } from '@/lib/euVat/types';

export function useEuVatRates() {
  return useQuery({
    queryKey: ['eu-vat-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eu_vat_rates').select('*').order('country_code');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
  });
}

export function useOssRegistrations() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['eu-oss-registrations', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eu_vat_oss_registrations').select('*')
        .eq('organization_id', orgId!).order('effective_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: {
      id?: string;
      scheme: OssScheme;
      member_state_of_identification: string;
      oss_registration_number: string;
      ioss_intermediary_number?: string | null;
      effective_date: string;
      end_date?: string | null;
      is_active?: boolean;
      notes?: string | null;
    }) => {
      if (!orgId) throw new Error('No org');
      const payload = { organization_id: orgId, ...input };
      const { error } = input.id
        ? await supabase.from('eu_vat_oss_registrations').update(payload).eq('id', input.id)
        : await supabase.from('eu_vat_oss_registrations').upsert([payload], {
            onConflict: 'organization_id,scheme,member_state_of_identification',
          });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eu-oss-registrations', orgId] });
      toast.success('OSS registration saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { registrations: query.data ?? [], isLoading: query.isLoading, upsert };
}

export function useViesValidate() {
  const qc = useQueryClient();
  const { currentOrganization } = useOrganizationContext();
  return useMutation({
    mutationFn: async (input: { countryCode: string; vatNumber: string; customerId?: string }) => {
      if (!currentOrganization?.id) throw new Error('No org');
      const { data, error } = await supabase.functions.invoke('eu-vies-validate', {
        body: { organizationId: currentOrganization.id, ...input },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { isValid: boolean; traderName?: string; traderAddress?: string; cached: boolean };
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['eu-vies-validations'] });
      toast[d.isValid ? 'success' : 'warning'](
        d.isValid ? `VAT ID valid${d.traderName ? ` — ${d.traderName}` : ''}` : 'VAT ID NOT valid (VIES)',
      );
    },
    onError: (e: Error) => toast.error(`VIES check failed: ${e.message}`),
  });
}

export function useEuVatCalculator() {
  const { data: rates = [] } = useEuVatRates();

  const lookup = (cc: string, type: 'standard' | 'reduced' = 'standard'): number | null => {
    const row = rates.find(r => r.country_code === cc.toUpperCase());
    if (!row) return null;
    if (type === 'reduced') return Number(row.reduced_rate_1 ?? row.standard_rate);
    return Number(row.standard_rate);
  };

  return {
    calculate: (input: EuVatCalcInput, vatNumberValidated = false) =>
      calculateEuVat(input, lookup, vatNumberValidated),
    rates,
  };
}

export function useOssReturns() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['eu-oss-returns', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eu_oss_returns').select('*')
        .eq('organization_id', orgId!)
        .order('period_year', { ascending: false })
        .order('period_quarter', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const generate = useMutation({
    mutationFn: async (input: {
      registrationId: string;
      scheme: OssScheme;
      memberStateOfIdentification: string;
      ossRegistrationNumber: string;
      year: number;
      quarter: 1 | 2 | 3 | 4;
    }) => {
      if (!orgId) throw new Error('No org');
      const { start, end } = quarterDates(input.year, input.quarter);

      // Aggregate from reverse-charge log? OSS lines are B2C; we read from
      // eu_oss_return_lines that the user can also build from invoices later.
      // For now, generate an empty draft the user fills in; aggregation
      // from invoice tax lines is a follow-up integration.
      const xml = generateOssReturnXml({
        organizationId: orgId,
        registrationId: input.registrationId,
        scheme: input.scheme,
        ossRegistrationNumber: input.ossRegistrationNumber,
        memberStateOfIdentification: input.memberStateOfIdentification,
        periodYear: input.year,
        periodQuarter: input.quarter,
        periodStart: start,
        periodEnd: end,
        currency: 'EUR',
        lines: [],
      });

      const { data, error } = await supabase.from('eu_oss_returns').upsert(
        [{
          organization_id: orgId,
          registration_id: input.registrationId,
          scheme: input.scheme,
          period_year: input.year,
          period_quarter: input.quarter,
          period_start: start,
          period_end: end,
          status: 'generated',
          xml_payload: xml,
          currency: 'EUR',
        }],
        { onConflict: 'organization_id,scheme,period_year,period_quarter' },
      ).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eu-oss-returns', orgId] });
      toast.success('OSS return generated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markSubmitted = useMutation({
    mutationFn: async (input: { id: string; confirmation_number?: string }) => {
      const { error } = await supabase.from('eu_oss_returns').update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        confirmation_number: input.confirmation_number ?? null,
      }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eu-oss-returns', orgId] });
      toast.success('Marked as submitted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { returns: query.data ?? [], isLoading: query.isLoading, generate, markSubmitted };
}

export function useReverseChargeLog() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['eu-reverse-charge', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eu_reverse_charge_log').select('*')
        .eq('organization_id', orgId!).order('document_date', { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const log = useMutation({
    mutationFn: async (input: {
      invoice_id?: string | null;
      document_reference?: string;
      document_date: string;
      customer_id?: string | null;
      customer_name?: string;
      customer_country_code: string;
      customer_vat_number: string;
      supply_type: 'services' | 'goods' | 'triangulation';
      taxable_amount: number;
      currency?: string;
      vies_validation_id?: string | null;
      notes?: string;
    }) => {
      if (!orgId) throw new Error('No org');
      const { error } = await supabase.from('eu_reverse_charge_log').insert([{
        organization_id: orgId,
        ...input,
        taxable_amount_cents: Math.round(input.taxable_amount * 100),
        currency: input.currency ?? 'EUR',
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eu-reverse-charge', orgId] });
      toast.success('Reverse charge logged');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { entries: query.data ?? [], isLoading: query.isLoading, log };
}
