import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConnectedActivityItem {
  id: string;
  kind: 'transfer' | 'topup' | 'application_fee';
  occurred_at: string;
  amount: number;
  currency: string;
  status: string | null;
  description: string | null;
  reference: string | null;
}

export function useConnectedAccountActivity(connectedAccountId?: string | null) {
  return useQuery({
    queryKey: ['stripe-connect-activity', connectedAccountId],
    enabled: !!connectedAccountId,
    queryFn: async (): Promise<ConnectedActivityItem[]> => {
      const [transfers, topups, fees] = await Promise.all([
        supabase.from('stripe_connect_transfers' as any).select('*').eq('connected_account_id', connectedAccountId!).order('created_at', { ascending: false }).limit(100),
        supabase.from('stripe_connect_topups' as any).select('*').eq('organization_id', '__none__').limit(0), // topups are platform-scoped; placeholder
        supabase.from('stripe_application_fees' as any).select('*').eq('connected_account_id', connectedAccountId!).order('created_at', { ascending: false }).limit(100),
      ]);

      const items: ConnectedActivityItem[] = [];
      for (const t of (transfers.data ?? []) as any[]) {
        items.push({
          id: t.id, kind: 'transfer', occurred_at: t.created_at,
          amount: -Math.abs(Number(t.amount)), currency: (t.currency ?? '').toLowerCase(),
          status: t.status, description: t.description ?? t.purpose, reference: t.stripe_transfer_id,
        });
      }
      for (const f of (fees.data ?? []) as any[]) {
        items.push({
          id: f.id, kind: 'application_fee', occurred_at: f.created_at,
          amount: Number(f.amount), currency: (f.currency ?? '').toLowerCase(),
          status: null, description: 'Application fee', reference: f.stripe_fee_id,
        });
      }
      void topups;
      items.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
      return items;
    },
  });
}
