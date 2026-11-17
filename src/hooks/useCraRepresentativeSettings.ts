import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import type { CatalogOverride } from '@/lib/cra/mypayment/catalog';
import { DEFAULT_POLICY, type PaymentPolicy } from '@/lib/cra/mypayment/workflow';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type AccessLevel = 'level_1' | 'level_2' | 'level_3';

/** Metadata only. There is no password, MFA or token field, by design. */
export interface RepresentativeSettings {
  representative_name: string;
  rep_id: string;
  group_id: string;
  authentication_method: 'cra_sign_in' | 'sign_in_partner';
  authorization_status: 'active' | 'inactive';
  access_level: AccessLevel;
  notes: string;
  updated_at?: string;
}

export const EMPTY_REPRESENTATIVE: RepresentativeSettings = {
  representative_name: '',
  rep_id: '',
  group_id: '',
  authentication_method: 'cra_sign_in',
  authorization_status: 'inactive',
  access_level: 'level_1',
  notes: '',
};

export interface RepresentedClient {
  id: string;
  client_name: string;
  payer_kind: 'individual' | 'business';
  business_number: string;
  program_accounts: string[];
  access_level: AccessLevel;
  status: 'pending' | 'active' | 'revoked' | 'expired';
  authorized_on: string | null;
  expires_on: string | null;
  notes: string;
  updated_at: string;
}

export type RepresentedClientInput = Omit<RepresentedClient, 'id' | 'updated_at'> & { id?: string };

/** Uppercases, strips spaces, and checks the shapes CRA uses for RepID and GroupID. */
export function validateRepresentative(input: RepresentativeSettings): string | null {
  const rep = input.rep_id.trim().toUpperCase();
  const group = input.group_id.trim().toUpperCase();
  if (rep && !/^[A-Z0-9]{7,8}$/.test(rep)) return 'A RepID is 7 or 8 letters and numbers, for example R7EFS18.';
  if (group && !/^G[A-Z0-9]{6,7}$/.test(group)) return 'A GroupID starts with G and has 7 or 8 characters.';
  if (input.authorization_status === 'active' && !input.representative_name.trim()) return 'Enter the representative name before marking it active.';
  if (input.authorization_status === 'active' && !rep && !group) return 'Enter a RepID or GroupID before marking it active.';
  return null;
}

/** Reject anything in notes that looks like a password or one-time code. */
export function looksLikeSecret(text: string): boolean {
  return /\b(password|passcode|pwd|mot de passe|otp|one[- ]time code|mfa code|security code)\b\s*[:=]/i.test(text);
}

export function useCraRepresentativeSettings() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const settings = useQuery({
    queryKey: ['cra-representative', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<RepresentativeSettings> => {
      const { data, error } = await db.from('cra_representative_settings').select('*').eq('organization_id', orgId).maybeSingle();
      if (error) throw error;
      return data ? { ...EMPTY_REPRESENTATIVE, ...data } : EMPTY_REPRESENTATIVE;
    },
  });

  const clients = useQuery({
    queryKey: ['cra-represented-clients', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db.from('cra_represented_clients').select('*').eq('organization_id', orgId).order('client_name');
      if (error) throw error;
      return (data ?? []) as RepresentedClient[];
    },
  });

  const policy = useQuery({
    queryKey: ['cra-payment-policy', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<PaymentPolicy> => {
      const { data, error } = await db.from('cra_payment_policies').select('*').eq('organization_id', orgId).maybeSingle();
      if (error || !data) return DEFAULT_POLICY;
      return {
        approval_levels: data.approval_levels === 2 ? 2 : 1,
        review_threshold: data.review_threshold === null ? null : Number(data.review_threshold),
        separate_duties: !!data.separate_duties,
        reviewer_roles: data.reviewer_roles ?? DEFAULT_POLICY.reviewer_roles,
        approver_roles: data.approver_roles ?? DEFAULT_POLICY.approver_roles,
        max_payment_amount: data.max_payment_amount === null ? null : Number(data.max_payment_amount),
        duplicate_window_days: Number(data.duplicate_window_days ?? DEFAULT_POLICY.duplicate_window_days),
      };
    },
  });

  const overrides = useQuery({
    queryKey: ['cra-payment-catalog', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db.from('cra_payment_catalog_overrides').select('*').eq('organization_id', orgId);
      if (error) return [] as CatalogOverride[];
      return (data ?? []) as CatalogOverride[];
    },
  });

  const saveSettings = useMutation({
    mutationFn: async (input: RepresentativeSettings) => {
      const problem = validateRepresentative(input);
      if (problem) throw new Error(problem);
      if (looksLikeSecret(input.notes)) throw new Error('Notes look like they contain a password or code. eFinsuite never stores CRA sign-in secrets.');
      const row = {
        organization_id: orgId,
        representative_name: input.representative_name.trim(),
        rep_id: input.rep_id.trim().toUpperCase(),
        group_id: input.group_id.trim().toUpperCase(),
        authentication_method: input.authentication_method,
        authorization_status: input.authorization_status,
        access_level: input.access_level,
        notes: input.notes.trim(),
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      };
      const { error } = await db.from('cra_representative_settings').upsert(row, { onConflict: 'organization_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-representative', orgId] });
      toast.success('CRA Representative settings saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveClient = useMutation({
    mutationFn: async (input: RepresentedClientInput) => {
      if (!input.client_name.trim()) throw new Error('Enter the client name.');
      const bn = input.business_number.replace(/\s/g, '');
      if (bn && !/^[0-9]{9}$/.test(bn)) throw new Error('Business number must be 9 digits.');
      const accounts = input.program_accounts.map((a) => a.replace(/[\s-]/g, '').toUpperCase()).filter(Boolean);
      const bad = accounts.find((a) => !/^[0-9]{9}[A-Z]{2}[0-9]{4}$/.test(a) || (bn && !a.startsWith(bn)));
      if (bad) throw new Error(`${bad} is not a program account for this business number.`);
      if (input.expires_on && input.authorized_on && input.expires_on < input.authorized_on) throw new Error('The expiry date is before the authorization date.');
      if (looksLikeSecret(input.notes)) throw new Error('Notes look like they contain a password or code. Remove it.');
      const row = {
        organization_id: orgId,
        client_name: input.client_name.trim(),
        payer_kind: input.payer_kind,
        business_number: bn,
        program_accounts: accounts,
        access_level: input.access_level,
        status: input.status,
        authorized_on: input.authorized_on || null,
        expires_on: input.expires_on || null,
        notes: input.notes.trim(),
        updated_at: new Date().toISOString(),
      };
      const { error } = input.id
        ? await db.from('cra_represented_clients').update(row).eq('id', input.id)
        : await db.from('cra_represented_clients').insert({ ...row, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-represented-clients', orgId] });
      toast.success('Client authorization saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('cra_represented_clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-represented-clients', orgId] });
      toast.success('Client removed from the register');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const savePolicy = useMutation({
    mutationFn: async (input: PaymentPolicy) => {
      if (input.reviewer_roles.length === 0 || input.approver_roles.length === 0) throw new Error('Pick at least one reviewer role and one approver role.');
      const { error } = await db.from('cra_payment_policies').upsert({
        organization_id: orgId,
        ...input,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-payment-policy', orgId] });
      toast.success('Approval policy saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveOverride = useMutation({
    mutationFn: async (input: CatalogOverride) => {
      const { error } = await db.from('cra_payment_catalog_overrides').upsert({
        organization_id: orgId,
        ...input,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,payer_kind,type_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-payment-catalog', orgId] });
      toast.success('Payment categories updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeOverride = useMutation({
    mutationFn: async (input: { payer_kind: string; type_key: string }) => {
      const { error } = await db.from('cra_payment_catalog_overrides').delete()
        .eq('organization_id', orgId).eq('payer_kind', input.payer_kind).eq('type_key', input.type_key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cra-payment-catalog', orgId] });
      toast.success('Category restored to the CRA default');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    settings: settings.data ?? EMPTY_REPRESENTATIVE,
    settingsLoading: settings.isLoading,
    settingsError: settings.error as Error | null,
    clients: clients.data ?? [],
    policy: policy.data ?? DEFAULT_POLICY,
    overrides: overrides.data ?? [],
    saveSettings,
    saveClient,
    removeClient,
    savePolicy,
    saveOverride,
    removeOverride,
  };
}
