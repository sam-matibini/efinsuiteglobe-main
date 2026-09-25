import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface PadAgreement {
  id: string;
  organization_id: string;
  bank_account_id: string | null;
  payer_name: string;
  payer_title: string | null;
  payer_email: string | null;
  signature_data: string | null;
  signature_text: string | null;
  agreement_text: string | null;
  accepted_at: string;
  ip_address: string | null;
  max_amount_per_debit: number | null;
  max_amount_per_period: number | null;
  frequency: 'sporadic' | 'recurring';
  cra_program_account_ids: string[];
  cra_pad_number: string | null;
  scope: 'general' | 'cra';
  status: 'active' | 'revoked' | 'expired';
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
}

export interface CreatePadAgreementInput {
  bank_account_id: string;
  payer_name: string;
  payer_title?: string;
  payer_email?: string;
  signature_text: string;
  max_amount_per_debit: number;
  max_amount_per_period?: number;
  frequency: 'sporadic' | 'recurring';
  cra_program_account_ids?: string[];
  cra_pad_number?: string;
  scope?: 'general' | 'cra';
}

export function usePadAgreements(opts?: { scope?: 'general' | 'cra' }) {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['pad-agreements', orgId, opts?.scope ?? 'all'],
    enabled: !!orgId,
    queryFn: async () => {
      let q = (supabase as any)
        .from('pad_agreements')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (opts?.scope) q = q.eq('scope', opts.scope);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PadAgreement[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreatePadAgreementInput) => {
      if (!orgId) throw new Error('No organization');
      const agreementText =
        `I, ${input.payer_name}, authorize efinsuite (on behalf of the account holder) to debit ` +
        `the designated bank account for Canada Revenue Agency remittances and related payments ` +
        `up to CAD ${input.max_amount_per_debit.toFixed(2)} per transaction, on a ${input.frequency} ` +
        `basis. I understand I have certain recourse rights if any debit does not comply with this ` +
        `agreement, including the right to receive reimbursement for any debit that is not authorized ` +
        `or is not consistent with this PAD agreement. To obtain more information on my recourse rights, ` +
        `I may contact my financial institution or visit www.payments.ca.`;

      const payload = {
        organization_id: orgId,
        bank_account_id: input.bank_account_id,
        payer_name: input.payer_name,
        payer_title: input.payer_title ?? null,
        payer_email: input.payer_email ?? null,
        signature_text: input.signature_text,
        signature_data: input.signature_text,
        agreement_text: agreementText,
        account_reference: input.cra_pad_number ?? null,
        max_amount_per_debit: input.max_amount_per_debit,
        max_amount_per_period: input.max_amount_per_period ?? null,
        frequency: input.frequency,
        cra_program_account_ids: input.cra_program_account_ids ?? [],
        cra_pad_number: input.cra_pad_number ?? null,
        scope: input.scope ?? 'cra',
        status: 'active',
        accepted_at: new Date().toISOString(),
        created_by: user?.id ?? null,
      };
      const { data, error } = await (supabase as any).from('pad_agreements').insert(payload).select().single();
      if (error) throw error;
      return data as PadAgreement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pad-agreements'] });
      toast.success('PAD agreement saved');
    },
    onError: (e: Error) => toast.error(`Failed to save PAD: ${e.message}`),
  });

  const revoke = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await (supabase as any)
        .from('pad_agreements')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_reason: reason ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pad-agreements'] });
      toast.success('PAD agreement revoked');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const activePadForBankAccount = (bankAccountId: string | null | undefined) => {
    if (!bankAccountId) return null;
    return (query.data ?? []).find(
      (p) => p.bank_account_id === bankAccountId && p.status === 'active',
    ) ?? null;
  };

  return {
    pads: query.data ?? [],
    isLoading: query.isLoading,
    create,
    revoke,
    activePadForBankAccount,
  };
}
