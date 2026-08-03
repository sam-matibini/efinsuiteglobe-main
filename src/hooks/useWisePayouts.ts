import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export type WisePayoutMethod = 'eft' | 'etransfer' | 'card';

export interface WisePayoutRecipient {
  id: string;
  organization_id: string;
  vendor_id: string | null;
  employee_id: string | null;
  nickname: string | null;
  currency: string;
  account_holder_name: string;
  bank_name: string | null;
  account_number: string | null;
  routing_number: string | null;
  iban: string | null;
  bic_swift: string | null;
  sort_code: string | null;
  etransfer_email: string | null;
  country: string | null;
  wise_recipient_id: string | null;
  status: string;
  created_at: string;
}

export interface WiseTransfer {
  id: string;
  organization_id: string;
  source_type: string;
  source_id: string | null;
  recipient_id: string | null;
  method: WisePayoutMethod;
  amount: number;
  currency: string;
  reference: string | null;
  wise_quote_id: string | null;
  wise_transfer_id: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

export interface CreateWiseTransferInput {
  source_type: 'bill' | 'ap_batch' | 'payroll' | 'tax' | 'payment_link' | 'manual';
  source_id?: string | null;
  recipient_id?: string | null;
  method: WisePayoutMethod;
  amount: number;
  currency: string;
  reference?: string | null;
  /** Inline destination when no saved recipient exists yet. */
  recipient?: Partial<WisePayoutRecipient> & { account_holder_name: string };
}

export function useWisePayouts() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id ?? null;
  const qc = useQueryClient();

  const recipients = useQuery({
    queryKey: ['wise-payout-recipients', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wise_payout_recipients' as never)
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WisePayoutRecipient[];
    },
  });

  const transfers = useQuery({
    queryKey: ['wise-transfers', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wise_transfers' as never)
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as WiseTransfer[];
    },
  });

  const saveRecipient = useMutation({
    mutationFn: async (input: Partial<WisePayoutRecipient> & { account_holder_name: string }) => {
      if (!orgId) throw new Error('No organization selected');
      const { data, error } = await supabase.functions.invoke('wise-create-recipient', {
        body: { organization_id: orgId, recipient: input },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as { recipient: WisePayoutRecipient };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wise-payout-recipients'] });
      toast.success('Wise recipient saved');
    },
    onError: (e: Error) => toast.error(`Wise recipient failed: ${e.message}`),
  });

  const createTransfer = useMutation({
    mutationFn: async (input: CreateWiseTransferInput) => {
      if (!orgId) throw new Error('No organization selected');
      const { data, error } = await supabase.functions.invoke('wise-create-transfer', {
        body: { organization_id: orgId, ...input },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as { transfer: WiseTransfer; live: boolean };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['wise-transfers'] });
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['vendor-payments'] });
      toast.success(res.live ? 'Wise transfer submitted' : 'Payment recorded — confirm it in Wise');
    },
    onError: (e: Error) => toast.error(`Wise transfer failed: ${e.message}`),
  });

  return {
    recipients: recipients.data ?? [],
    transfers: transfers.data ?? [],
    isLoading: recipients.isLoading || transfers.isLoading,
    saveRecipient,
    createTransfer,
  };
}

/** Vendor -> payout provider routing (Stripe or Wise). */
export interface VendorPayoutRouting {
  id: string;
  organization_id: string;
  vendor_id: string;
  payout_provider: 'stripe' | 'wise';
  stripe_connected_account_id: string | null;
  wise_recipient_id: string | null;
  default_payout_method: string;
}

export function useVendorPayoutRouting() {
  const { currentOrganization } = useOrganizationContext();
  const orgId = currentOrganization?.id ?? null;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['vendor-payout-routing', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_payout_routing' as never)
        .select('*')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return (data ?? []) as unknown as VendorPayoutRouting[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Omit<VendorPayoutRouting, 'id' | 'organization_id'>) => {
      if (!orgId) throw new Error('No organization selected');
      const { error } = await supabase
        .from('vendor_payout_routing' as never)
        .upsert(
          { organization_id: orgId, ...input } as never,
          { onConflict: 'organization_id,vendor_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-payout-routing'] });
      toast.success('Payout routing saved');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return { routing: query.data ?? [], isLoading: query.isLoading, upsert };
}
