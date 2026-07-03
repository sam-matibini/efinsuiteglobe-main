import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export type ExecStatementType =
  | 'balance_sheet'
  | 'income_statement'
  | 'cash_flow'
  | 'changes_in_equity'
  | 'compilation_report';

export type ExecSignerRole = 'primary' | 'secondary';

export interface ExecutiveSignatureRow {
  id: string;
  organization_id: string;
  statement_type: ExecStatementType;
  period_start: string;
  period_end: string;
  fiscal_year_id: string | null;
  revision: number;
  is_latest: boolean;
  signer_role: ExecSignerRole;
  signer_user_id: string;
  signer_name: string;
  signer_title: string;
  signature_image_url: string;
  certification_text: string;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  archived_pdf_url: string | null;
  report_snapshot_hash: string | null;
  created_at: string;
}

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface PeriodKey {
  statementType: ExecStatementType;
  periodStart: Date;
  periodEnd: Date;
}

/** Latest signature for a statement + period + role (org-scoped). */
export function useLatestExecutiveSignature(
  key: PeriodKey | null,
  role: ExecSignerRole = 'primary',
) {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: [
      'executive-signature-latest',
      organization?.id,
      key?.statementType,
      key && toDateStr(key.periodStart),
      key && toDateStr(key.periodEnd),
      role,
    ],
    queryFn: async (): Promise<ExecutiveSignatureRow | null> => {
      if (!organization?.id || !key) return null;
      const { data, error } = await supabase
        .from('executive_statement_signatures')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('statement_type', key.statementType)
        .eq('period_start', toDateStr(key.periodStart))
        .eq('period_end', toDateStr(key.periodEnd))
        .eq('signer_role', role)
        .eq('is_latest', true)
        .maybeSingle();
      if (error) throw error;
      return (data as ExecutiveSignatureRow) ?? null;
    },
    enabled: !!organization?.id && !!key,
  });
}

/** Convenience: fetch both signers' latest signatures together. */
export function useLatestExecutiveSignaturesBoth(key: PeriodKey | null) {
  const primary = useLatestExecutiveSignature(key, 'primary');
  const secondary = useLatestExecutiveSignature(key, 'secondary');
  return { primary, secondary };
}

/** All revisions for a statement + period + role. */
export function useExecutiveSignatureHistory(
  key: PeriodKey | null,
  role?: ExecSignerRole,
) {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: [
      'executive-signature-history',
      organization?.id,
      key?.statementType,
      key && toDateStr(key.periodStart),
      key && toDateStr(key.periodEnd),
      role ?? 'all',
    ],
    queryFn: async (): Promise<ExecutiveSignatureRow[]> => {
      if (!organization?.id || !key) return [];
      let q = supabase
        .from('executive_statement_signatures')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('statement_type', key.statementType)
        .eq('period_start', toDateStr(key.periodStart))
        .eq('period_end', toDateStr(key.periodEnd))
        .order('signer_role', { ascending: true })
        .order('revision', { ascending: false });
      if (role) q = q.eq('signer_role', role);
      const { data, error } = await q;
      if (error) throw error;
      return (data as ExecutiveSignatureRow[]) ?? [];
    },
    enabled: !!organization?.id && !!key,
  });
}

interface ExecutiveSignerInfo {
  executive_signer_user_id: string | null;
  executive_signer_name: string | null;
  executive_signer_title: string | null;
  executive_signer_secondary_title: string | null;
  executive_signer2_user_id: string | null;
  executive_signer2_name: string | null;
  executive_signer2_title: string | null;
  executive_signer2_secondary_title: string | null;
}

/** Fetch the org's designated executive signer fields (typed locally; not yet in generated types). */
export function useExecutiveSignerSettings() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['executive-signer-settings', organization?.id],
    queryFn: async (): Promise<ExecutiveSignerInfo | null> => {
      if (!organization?.id) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select(
          'executive_signer_user_id, executive_signer_name, executive_signer_title, executive_signer_secondary_title, executive_signer2_user_id, executive_signer2_name, executive_signer2_title, executive_signer2_secondary_title',
        )
        .eq('id', organization.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ExecutiveSignerInfo) ?? null;
    },
    enabled: !!organization?.id,
  });
}

export function useSaveExecutiveSignerSettings() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  return useMutation({
    mutationFn: async (input: Partial<ExecutiveSignerInfo>) => {
      if (!organization?.id) throw new Error('No active organization');
      const { error } = await supabase
        .from('organizations')
        .update(input as never)
        .eq('id', organization.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executive-signer-settings'] });
      toast.success('Executive signer updated');
    },
    onError: (err: Error) => {
      toast.error('Failed to save: ' + err.message);
    },
  });
}

/** Is the current user a designated executive signer for the active org? Returns the role they're designated as. */
export function useIsDesignatedExecutiveSigner() {
  const { user } = useAuth();
  const { data: settings } = useExecutiveSignerSettings();
  const isPrimary =
    !!user?.id &&
    !!settings?.executive_signer_user_id &&
    settings.executive_signer_user_id === user.id;
  const isSecondary =
    !!user?.id &&
    !!settings?.executive_signer2_user_id &&
    settings.executive_signer2_user_id === user.id;
  const role: ExecSignerRole | null = isPrimary
    ? 'primary'
    : isSecondary
      ? 'secondary'
      : null;
  return {
    isDesignated: isPrimary || isSecondary,
    role,
    isPrimary,
    isSecondary,
    // Convenience: name/title for whichever role applies (primary first)
    signerName: isPrimary
      ? settings?.executive_signer_name || ''
      : isSecondary
        ? settings?.executive_signer2_name || ''
        : '',
    signerTitle: isPrimary
      ? settings?.executive_signer_title || 'CEO/President'
      : isSecondary
        ? settings?.executive_signer2_title || 'CFO/Treasurer'
        : '',
    secondaryTitle: isPrimary
      ? settings?.executive_signer_secondary_title || ''
      : isSecondary
        ? settings?.executive_signer2_secondary_title || ''
        : '',
    // Primary signer info (always available)
    primaryName: settings?.executive_signer_name || '',
    primaryTitle: settings?.executive_signer_title || 'CEO/President',
    // Secondary signer info (always available)
    secondaryName: settings?.executive_signer2_name || '',
    secondarySignerTitle: settings?.executive_signer2_title || 'CFO/Treasurer',
    hasSecondaryDesignated: !!settings?.executive_signer2_user_id,
    hasPrimaryDesignated: !!settings?.executive_signer_user_id,
  };
}

interface SaveSignatureInput {
  statementType: ExecStatementType;
  periodStart: Date;
  periodEnd: Date;
  fiscalYearId?: string | null;
  signerRole?: ExecSignerRole;
  signerName: string;
  signerTitle: string;
  /** Either a https URL (storage) or a base64 data URL. */
  signatureImageUrl: string;
  certificationText: string;
  reportSnapshotHash?: string | null;
  reportSnapshot?: unknown;
}

export function useSaveExecutiveSignature() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (input: SaveSignatureInput) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!organization?.id) throw new Error('No active organization');

      const payload = {
        organization_id: organization.id,
        statement_type: input.statementType,
        period_start: toDateStr(input.periodStart),
        period_end: toDateStr(input.periodEnd),
        fiscal_year_id: input.fiscalYearId ?? null,
        signer_role: input.signerRole ?? 'primary',
        signer_user_id: user.id,
        signer_name: input.signerName,
        signer_title: input.signerTitle,
        signature_image_url: input.signatureImageUrl,
        certification_text: input.certificationText,
        report_snapshot_hash: input.reportSnapshotHash ?? null,
        report_snapshot: (input.reportSnapshot as never) ?? null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      };

      const { data, error } = await supabase
        .from('executive_statement_signatures')
        .insert(payload as never)
        .select()
        .single();

      if (error) throw error;
      return data as ExecutiveSignatureRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executive-signature-latest'] });
      queryClient.invalidateQueries({ queryKey: ['executive-signature-history'] });
      toast.success('Statement signed and archived');
    },
    onError: (err: Error) => {
      toast.error('Failed to save signature: ' + err.message);
    },
  });
}
