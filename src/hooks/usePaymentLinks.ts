import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type PaymentLinkStatus = 'open' | 'paid' | 'expired' | 'cancelled';
export type PaymentLinkMethod = 'credit_card' | 'debit_card' | 'visa_debit' | 'any_card' | 'eft' | 'all';
export type InstantMethod = 'interac_etransfer' | 'card_instant_funding';

export interface PaymentLink {
  id: string;
  organization_id: string;
  reference: string;
  status: PaymentLinkStatus;
  amount: number;
  currency: string;
  description: string | null;
  invoice_id: string | null;
  customer_id: string | null;
  create_invoice_on_payment: boolean;
  payment_method: PaymentLinkMethod;
  paysafe_payment_handle_id: string | null;
  hosted_url: string | null;
  expires_at: string | null;
  paid_at: string | null;
  metadata: Record<string, unknown> | null;
  payer_name: string | null;
  payer_email: string | null;
  deposit_bank_account_id: string | null;
  instant_payment: boolean;
  instant_method: InstantMethod | null;
  created_at: string;
  created_by: string | null;
}

export interface CreatePaymentLinkInput {
  amount: number;
  currency?: string;
  description?: string | null;
  invoice_id?: string | null;
  customer_id?: string | null;
  create_invoice_on_payment?: boolean;
  payment_method?: PaymentLinkMethod;
  expires_at?: string | null;
  payer_name?: string | null;
  payer_email?: string | null;
  deposit_bank_account_id?: string | null;
  instant_payment?: boolean;
  instant_method?: InstantMethod | null;
  metadata?: Record<string, unknown> | null;
}

export function usePaymentLinks() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const notifyEmailResult = (result: unknown, fallbackSuccess: string) => {
    const payload = result as { success?: boolean; error?: string; setupRequired?: boolean } | null;
    if (payload?.success === false) {
      toast.warning(payload.error || 'Payment link created, but email was not sent');
      return;
    }
    toast.success(fallbackSuccess);
  };

  const query = useQuery({
    queryKey: ['payment-links', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_links' as never)
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PaymentLink[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: CreatePaymentLinkInput) => {
      if (!orgId) throw new Error('No organization');
      const { data: refData, error: refErr } = await supabase.rpc('next_payment_link_reference' as never, { p_org: orgId } as never);
      if (refErr) throw refErr;
      const reference = refData as unknown as string;

      const { data, error } = await supabase
        .from('payment_links' as never)
        .insert({
          organization_id: orgId,
          reference,
          status: 'open',
          currency: input.currency ?? 'CAD',
          payment_method: input.payment_method ?? 'all',
          create_invoice_on_payment: input.create_invoice_on_payment ?? false,
          created_by: user?.id,
          amount: input.amount,
          description: input.description ?? null,
          invoice_id: input.invoice_id ?? null,
          customer_id: input.customer_id ?? null,
          expires_at: input.expires_at ?? null,
          payer_name: input.payer_name ?? null,
          payer_email: input.payer_email ?? null,
          deposit_bank_account_id: input.deposit_bank_account_id ?? null,
          instant_payment: input.instant_payment ?? false,
          instant_method: input.instant_payment ? (input.instant_method ?? null) : null,
          metadata: input.metadata ?? null,
        } as never)
        .select()
        .single();
      if (error) throw error;
      const link = data as unknown as PaymentLink;

      // Fire-and-forget email if payer_email present
      if (input.payer_email) {
        supabase.functions.invoke('send-payment-link-email', { body: { link_id: (link as { id: string }).id } })
          .then(({ data, error: e }) => {
            if (e) toast.error(`Link created, but email failed: ${e.message}`);
            else notifyEmailResult(data, `Payment link emailed to ${input.payer_email}`);
          });
      }
      return link;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-links', orgId] });
      toast.success('Payment link created');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const resendEmail = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('send-payment-link-email', { body: { link_id: id } });
      if (error) throw error;
      const payload = data as { success?: boolean; error?: string } | null;
      if (payload?.success === false) throw new Error(payload.error || 'Email was not sent');
    },
    onSuccess: () => toast.success('Email sent'),
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_links' as never).update({ status: 'cancelled' } as never).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-links', orgId] });
      toast.success('Link cancelled');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payment_links' as never).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-links', orgId] });
      toast.success('Link deleted');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return {
    links: query.data ?? [],
    isLoading: query.isLoading,
    create,
    cancel,
    remove,
    resendEmail,
  };
}
