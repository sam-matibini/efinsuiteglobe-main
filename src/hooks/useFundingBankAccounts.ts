import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBankAccounts, BankAccount } from './useBankAccounts';

export type Rail = 'instant' | 'ach' | 'eft' | 'wire' | 'wallet_stripe' | 'wallet_paddle' | 'cheque' | 'manual' | 'card';

export interface FundingBankAccount extends BankAccount {
  isPlaidLinked: boolean;
  isStripeReady: boolean;
  isPaysafeEftEnabled: boolean;
  isNibssEnabled: boolean;
  isRtgsEnabled: boolean;
  canDrawACH: boolean;
  canSendACH: boolean;
  isDefault: boolean;
  capabilities: string[];
  railsSupported: Rail[];
}

export function decorateBankAccount(a: BankAccount): FundingBankAccount {
  const isPlaidLinked = !!a.plaid_access_token;
  const isStripeReady = !!(a as { stripe_bank_account_id?: string | null }).stripe_bank_account_id;
  const isPaysafeEftEnabled = !!(a as { paysafe_eft_enabled?: boolean }).paysafe_eft_enabled;
  const isPaysafeCardEnabled = !!(a as { paysafe_card_enabled?: boolean }).paysafe_card_enabled;
  const isNibssEnabled = !!(a as { is_nibss_enabled?: boolean }).is_nibss_enabled;
  const isRtgsEnabled = !!(a as { is_rtgs_enabled?: boolean }).is_rtgs_enabled;
  const isDefault = !!(a as { is_treasury_funding_default?: boolean }).is_treasury_funding_default;
  const stored = ((a as { rails_supported?: string[] }).rails_supported ?? []) as Rail[];

  const derived = new Set<Rail>(stored);
  derived.add('manual');
  derived.add('cheque');
  if (isStripeReady) { derived.add('ach'); derived.add('instant'); }
  if (isPlaidLinked) { derived.add('eft'); }
  if (isPaysafeEftEnabled) { derived.add('eft'); }
  if (isPaysafeCardEnabled) { derived.add('card'); }

  const capabilities: string[] = [];
  if (isPlaidLinked) capabilities.push('Plaid');
  if (isStripeReady) capabilities.push('ACH');
  if (derived.has('instant')) capabilities.push('Instant');
  if (isPaysafeEftEnabled || derived.has('eft')) capabilities.push('EFT');
  if (isPaysafeCardEnabled || derived.has('card')) capabilities.push('Card');
  if (derived.has('wire')) capabilities.push('Wire');
  if (isDefault) capabilities.push('Default');
  return {
    ...a,
    isPlaidLinked,
    isStripeReady,
    isPaysafeEftEnabled,
    isNibssEnabled,
    isRtgsEnabled,
    canDrawACH: isStripeReady,
    canSendACH: isStripeReady,
    isDefault,
    capabilities,
    railsSupported: Array.from(derived),
  };
}

export function useFundingBankAccounts() {
  const { accounts, isLoading } = useBankAccounts();
  const queryClient = useQueryClient();

  const decorated = useMemo<FundingBankAccount[]>(
    () => (accounts ?? []).map(decorateBankAccount),
    [accounts]
  );

  const defaultAccount = useMemo(
    () => decorated.find((a) => a.isDefault) ?? null,
    [decorated]
  );

  const enableStripeAch = useMutation({
    mutationFn: async (bankAccountId: string) => {
      const { data, error } = await supabase.functions.invoke('plaid-stripe-processor-token', {
        body: { bank_account_id: bankAccountId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Stripe ACH enabled on this bank account');
    },
    onError: (e: Error) => toast.error(`Failed to enable ACH: ${e.message}`),
  });

  const setDefault = useMutation({
    mutationFn: async (bankAccountId: string) => {
      const target = accounts.find((a) => a.id === bankAccountId);
      if (!target) throw new Error('Account not found');
      // Clear current default for this org, then set new
      await supabase
        .from('bank_accounts')
        .update({ is_treasury_funding_default: false } as any)
        .eq('organization_id', target.organization_id)
        .eq('is_treasury_funding_default', true);
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_treasury_funding_default: true } as any)
        .eq('id', bankAccountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('Default funding bank updated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const enablePaysafeEft = useMutation({
    mutationFn: async (bankAccountId: string) => {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ paysafe_eft_enabled: true, paysafe_card_enabled: true } as any)
        .eq('id', bankAccountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('EFT enabled on this bank account');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const disablePaysafeEft = useMutation({
    mutationFn: async (bankAccountId: string) => {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ paysafe_eft_enabled: false } as any)
        .eq('id', bankAccountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      toast.success('EFT disabled');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const toggleFlag = (column: 'is_nibss_enabled' | 'is_rtgs_enabled', enabled: boolean, successMsg: string) =>
    useMutation({
      mutationFn: async (bankAccountId: string) => {
        const { error } = await supabase
          .from('bank_accounts')
          .update({ [column]: enabled } as any)
          .eq('id', bankAccountId);
        if (error) throw error;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
        toast.success(successMsg);
      },
      onError: (e: Error) => toast.error(`Failed: ${e.message}`),
    });

  const enableNibss  = toggleFlag('is_nibss_enabled', true,  'NIBSS Instant/NEFT enabled on this bank account');
  const disableNibss = toggleFlag('is_nibss_enabled', false, 'NIBSS Instant/NEFT disabled');
  const enableRtgs   = toggleFlag('is_rtgs_enabled',  true,  'CBN RTGS enabled on this bank account');
  const disableRtgs  = toggleFlag('is_rtgs_enabled',  false, 'CBN RTGS disabled');

  return {
    accounts: decorated, defaultAccount, isLoading,
    enableStripeAch, enablePaysafeEft, disablePaysafeEft, setDefault,
    enableNibss, disableNibss, enableRtgs, disableRtgs,
  };
}
