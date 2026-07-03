import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';

export interface OrgRemittanceSummary {
  organization_id: string;
  organization_name: string;
  pending_count: number;
  pending_amount: number;
  processing_count: number;
  processing_amount: number;
  completed_count: number;
  last_paid_at: string | null;
  last_activity_at: string | null;
  pad_active: boolean;
}

export function useMultiBusinessRemittance() {
  const { organizations } = useOrganizationContext();
  const orgIds = organizations.map((o) => o.id);

  const query = useQuery({
    queryKey: ['multi-business-remittance', orgIds.join(',')],
    enabled: orgIds.length > 0,
    queryFn: async () => {
      const [{ data: sums, error: sumsErr }, { data: pads, error: padsErr }] = await Promise.all([
        supabase.from('cra_remittance_summary').select('*').in('organization_id', orgIds),
        supabase.from('pad_agreements').select('organization_id, status').eq('status', 'active').in('organization_id', orgIds),
      ]);
      if (sumsErr) throw sumsErr;
      if (padsErr) throw padsErr;
      const padSet = new Set((pads ?? []).map((p) => p.organization_id));
      const byOrg = new Map<string, OrgRemittanceSummary>();
      for (const o of organizations) {
        const s = (sums ?? []).find((x: any) => x.organization_id === o.id);
        byOrg.set(o.id, {
          organization_id: o.id,
          organization_name: o.name,
          pending_count: Number(s?.pending_count ?? 0),
          pending_amount: Number(s?.pending_amount ?? 0),
          processing_count: Number(s?.processing_count ?? 0),
          processing_amount: Number(s?.processing_amount ?? 0),
          completed_count: Number(s?.completed_count ?? 0),
          last_paid_at: s?.last_paid_at ?? null,
          last_activity_at: s?.last_activity_at ?? null,
          pad_active: padSet.has(o.id),
        });
      }
      return Array.from(byOrg.values());
    },
  });

  return { summaries: query.data ?? [], isLoading: query.isLoading };
}
