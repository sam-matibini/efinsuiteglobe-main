import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WiseReceivingAccount {
  id: string;
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
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type WiseReceivingAccountInput = Omit<
  WiseReceivingAccount,
  'id' | 'created_at' | 'updated_at'
>;

/**
 * Wise receiving accounts are a PLATFORM-level shared pool: one account per
 * currency, owned by the platform's Wise profile. Every organization that
 * enables Wise invoice payments shows the same bank coordinates for a given
 * currency; payments are attributed via each invoice's unique reference.
 *
 * Any authenticated user can read them (they appear on invoices); only platform
 * admins can create, edit or delete them (enforced by RLS).
 */
export function useWiseReceivingAccounts() {
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['wise-receiving-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wise_receiving_accounts')
        .select('*')
        .order('currency');
      if (error) throw error;
      return (data ?? []) as unknown as WiseReceivingAccount[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['wise-receiving-accounts'] });

  const upsertAccount = useMutation({
    mutationFn: async (input: Partial<WiseReceivingAccountInput> & { id?: string }) => {
      const payload = {
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
        is_active: input.is_active ?? true,
        notes: input.notes || null,
      };

      if (input.id) {
        const { error } = await supabase
          .from('wise_receiving_accounts')
          .update(payload as never)
          .eq('id', input.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('wise_receiving_accounts')
        .upsert(payload as never, { onConflict: 'currency' });
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
 * otherwise the first active account in the shared pool, flagged as a mismatch.
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
