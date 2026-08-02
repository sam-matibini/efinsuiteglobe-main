import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from './useOrganization';
import { toast } from 'sonner';

export interface WiseReceivingAccount {
  id: string;
  organization_id: string;
  currency: string;
  account_holder_name: string | null;
  bank_name: string | null;
  account_number: string | null;
  routing_number: string | null;
  iban: string | null;
  bic_swift: string | null;
  sort_code: string | null;
  institution_address: string | null;
  wise_profile_id: string | null;
  wise_balance_id: string | null;
  gl_bank_account_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type WiseReceivingAccountInput = Omit<
  WiseReceivingAccount,
  'id' | 'organization_id' | 'created_at' | 'updated_at'
>;

/**
 * Wise receiving accounts: one row per organization + currency, holding the
 * bank coordinates customers should transfer to plus the Wise profile/balance
 * ids the webhook uses to attribute incoming deposits.
 */
export function useWiseReceivingAccounts() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['wise-receiving-accounts', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from('wise_receiving_accounts')
        .select('*')
        .eq('organization_id', organization.id)
        .order('currency');
      if (error) throw error;
      return (data ?? []) as WiseReceivingAccount[];
    },
    enabled: !!organization?.id,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['wise-receiving-accounts'] });

  const upsertAccount = useMutation({
    mutationFn: async (input: Partial<WiseReceivingAccountInput> & { id?: string }) => {
      if (!organization?.id) throw new Error('No organization selected');
      const payload = {
        organization_id: organization.id,
        currency: (input.currency || '').toUpperCase(),
        account_holder_name: input.account_holder_name || null,
        bank_name: input.bank_name || null,
        account_number: input.account_number || null,
        routing_number: input.routing_number || null,
        iban: input.iban || null,
        bic_swift: input.bic_swift || null,
        sort_code: input.sort_code || null,
        institution_address: input.institution_address || null,
        wise_profile_id: input.wise_profile_id || null,
        wise_balance_id: input.wise_balance_id || null,
        gl_bank_account_id: input.gl_bank_account_id || null,
        is_active: input.is_active ?? true,
        notes: input.notes || null,
      };

      if (input.id) {
        const { error } = await supabase
          .from('wise_receiving_accounts')
          .update(payload)
          .eq('id', input.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('wise_receiving_accounts')
        .upsert(payload, { onConflict: 'organization_id,currency' });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Wise account saved');
    },
    onError: (e: Error) => toast.error(`Failed to save Wise account: ${e.message}`),
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('wise_receiving_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Wise account removed');
    },
    onError: (e: Error) => toast.error(`Failed to remove Wise account: ${e.message}`),
  });

  return { accounts, isLoading, upsertAccount, deleteAccount };
}

/** Fields safe to show on an invoice / PDF. */
export interface WiseAccountDisplay {
  currency: string;
  account_holder_name?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  routing_number?: string | null;
  iban?: string | null;
  bic_swift?: string | null;
  sort_code?: string | null;
  institution_address?: string | null;
  /** True when this account's currency differs from the invoice currency. */
  currencyMismatch?: boolean;
}

/**
 * Pick the Wise account to display for an invoice: exact currency match first,
 * otherwise the org's first active account flagged as a currency mismatch.
 */
export function selectWiseAccountForCurrency(
  accounts: WiseReceivingAccount[],
  currency?: string | null,
): WiseAccountDisplay | null {
  const active = accounts.filter((a) => a.is_active);
  if (active.length === 0) return null;
  const wanted = (currency || '').toUpperCase();
  const exact = active.find((a) => a.currency.toUpperCase() === wanted);
  const chosen = exact ?? active[0];
  return {
    currency: chosen.currency,
    account_holder_name: chosen.account_holder_name,
    bank_name: chosen.bank_name,
    account_number: chosen.account_number,
    routing_number: chosen.routing_number,
    iban: chosen.iban,
    bic_swift: chosen.bic_swift,
    sort_code: chosen.sort_code,
    institution_address: chosen.institution_address,
    currencyMismatch: !exact,
  };
}
