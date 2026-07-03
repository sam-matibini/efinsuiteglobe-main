import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StripeConnectedAccount {
  id: string;
  organization_id: string;
  stripe_account_id: string;
  account_type: 'express' | 'standard' | 'custom';
  country: string | null;
  default_currency: string | null;
  email: string | null;
  business_profile: any;
  capabilities: Record<string, string>;
  requirements: any;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  disabled_reason: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export function useStripeConnectedAccounts(organizationId?: string | null) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['stripe-connected-accounts', organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<StripeConnectedAccount[]> => {
      const { data, error } = await supabase
        .from('stripe_connected_accounts' as any)
        .select('*')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const onboard = useMutation({
    mutationFn: async (input: {
      organization_id: string;
      account_type?: 'express' | 'standard';
      country?: string;
      email?: string;
      business_type?: 'individual' | 'company' | 'non_profit' | 'government_entity';
      connected_account_id?: string;
    }) => {
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        body: {
          ...input,
          return_url: `${origin}/banking-payments/stripe-connect?status=return`,
          refresh_url: `${origin}/banking-payments/stripe-connect?status=refresh`,
        },
      });
      if (error) {
        // Extract structured body from non-2xx responses
        let parsed: any = null;
        try { parsed = await (error as any).context?.json?.(); } catch { /* ignore */ }
        const err: any = new Error(parsed?.error || error.message);
        err.code = parsed?.code;
        err.doc_url = parsed?.doc_url;
        err.hint = parsed?.hint;
        throw err;
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { onboarding_url: string; connected_account: StripeConnectedAccount };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['stripe-connected-accounts'] });
      if (data?.onboarding_url) window.location.href = data.onboarding_url;
    },
    onError: (e: any) => {
      const msg = e?.message || '';
      const isPlatformProfile = e?.code === 'platform_profile_incomplete'
        || /platform-profile|managing losses|platform profile/i.test(msg);
      if (isPlatformProfile) {
        const url = e?.doc_url || 'https://dashboard.stripe.com/settings/connect/platform-profile';
        toast.error(
          e?.hint || 'Stripe Platform Profile incomplete. Complete the loss-liability section in the same mode (test/live) as your STRIPE_SECRET_KEY, then retry.',
          {
            duration: 12000,
            action: { label: 'Open Stripe', onClick: () => window.open(url, '_blank', 'noopener,noreferrer') },
          },
        );
      } else {
        toast.error(`Onboarding failed: ${msg}`);
      }
    },
  });

  const sync = useMutation({
    mutationFn: async (connected_account_id: string) => {
      const { data, error } = await supabase.functions.invoke('stripe-connect-sync', {
        body: { connected_account_id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stripe-connected-accounts'] });
      toast.success('Connected account refreshed');
    },
    onError: (e: Error) => toast.error(`Sync failed: ${e.message}`),
  });

  const createTransfer = useMutation({
    mutationFn: async (input: {
      organization_id: string;
      connected_account_id: string;
      amount: number;
      currency: string;
      purpose: 'bill_payment' | 'payroll' | 'manual' | 'invoice_settlement';
      description?: string;
      related_entity_type?: string;
      related_entity_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('stripe-connect-transfer', { body: input });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stripe-connect-transfers'] });
      toast.success('Transfer initiated');
    },
    onError: (e: Error) => toast.error(`Transfer failed: ${e.message}`),
  });

  return { accounts: list.data ?? [], isLoading: list.isLoading, onboard, sync, createTransfer };
}
