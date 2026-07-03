/**
 * Phase 11 — Tax submissions hook.
 * Read/create submission records and trigger the e-file edge function.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';
import type { EFilePacket, SubmissionRow } from '@/lib/efile/types';

export function useTaxSubmissions(filingPeriodId?: string) {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['tax-submissions', orgId, filingPeriodId ?? 'all'],
    enabled: Boolean(orgId),
    queryFn: async () => {
      let q = supabase
        .from('tax_submissions')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (filingPeriodId) q = q.eq('filing_period_id', filingPeriodId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as SubmissionRow[];
    },
  });

  const createSubmission = useMutation({
    mutationFn: async (input: {
      packet: EFilePacket;
      filingPeriodId: string;
      authorityId: string;
      taxReturnId?: string | null;
    }) => {
      if (!orgId) throw new Error('No organization');
      const { packet } = input;
      const { data, error } = await supabase
        .from('tax_submissions')
        .insert({
          organization_id: orgId,
          tax_return_id: input.taxReturnId ?? null,
          filing_period_id: input.filingPeriodId,
          authority_id: input.authorityId,
          channel: packet.channel,
          status: 'drafted',
          form_code: packet.form.formCode,
          period_start: packet.form.periodStart,
          period_end: packet.form.periodEnd,
          net_payable: packet.form.netPayable,
          currency: packet.form.currency,
          payload: { contents: packet.contents, filename: packet.filename },
          payload_format: packet.format,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SubmissionRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-submissions', orgId] });
    },
  });

  const transmitDirect = useMutation({
    mutationFn: async (input: { submissionId: string; channel: string }) => {
      const { data, error } = await supabase.functions.invoke('tax-efile-submit', {
        body: { submissionId: input.submissionId, channel: input.channel },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-submissions', orgId] });
      toast.success('Submission transmitted');
    },
    onError: (e: Error) => toast.error(`Submission failed: ${e.message}`),
  });

  const recordConfirmation = useMutation({
    mutationFn: async (input: { submissionId: string; confirmationNumber: string }) => {
      const { error } = await supabase
        .from('tax_submissions')
        .update({
          status: 'acknowledged',
          confirmation_number: input.confirmationNumber,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', input.submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-submissions', orgId] });
      toast.success('Confirmation recorded');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markRejected = useMutation({
    mutationFn: async (input: { submissionId: string; reason: string }) => {
      const { error } = await supabase
        .from('tax_submissions')
        .update({ status: 'rejected', error_message: input.reason })
        .eq('id', input.submissionId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-submissions', orgId] }),
  });

  return { ...list, submissions: list.data ?? [], createSubmission, transmitDirect, recordConfirmation, markRejected };
}

export function useAuthorityCredentials(authorityId?: string) {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['tax-authority-credentials', orgId, authorityId],
    enabled: Boolean(orgId && authorityId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_authority_credentials')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('authority_id', authorityId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: {
      credential_type: 'hmrc_oauth' | 'cra_wac' | 'us_state_login' | 'generic';
      vrn?: string;
      business_number?: string;
      account_reference?: string;
      payload?: Record<string, unknown>;
    }) => {
      if (!orgId || !authorityId) throw new Error('Missing context');
      const { error } = await supabase
        .from('tax_authority_credentials')
        .upsert(
          [{
            organization_id: orgId,
            authority_id: authorityId,
            credential_type: input.credential_type,
            vrn: input.vrn ?? null,
            business_number: input.business_number ?? null,
            account_reference: input.account_reference ?? null,
            payload: (input.payload ?? {}) as never,
          }],
          { onConflict: 'organization_id,authority_id,credential_type' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-authority-credentials', orgId] });
      toast.success('Credentials saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { credentials: query.data ?? [], isLoading: query.isLoading, upsert };
}
