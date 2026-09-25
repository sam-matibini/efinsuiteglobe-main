import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type AnomalyCategory = 'period_swing' | 'missed_period' | 'duplicate_payment' | 'low_match_score' | 'other';
export type AnomalyStatus = 'open' | 'acknowledged' | 'dismissed' | 'resolved';

export interface TreasuryAnomaly {
  id: string;
  organization_id: string;
  severity: AnomalySeverity;
  category: AnomalyCategory;
  authority: string | null;
  program_code: string | null;
  related_tax_payment_id: string | null;
  payload: Record<string, unknown>;
  fingerprint: string;
  status: AnomalyStatus;
  assignee_user_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useTreasuryAnomalies(opts?: { status?: AnomalyStatus }) {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['treasury-anomalies', orgId, opts?.status ?? 'all'],
    enabled: !!orgId,
    queryFn: async () => {
      let q = (supabase as any).from('treasury_anomalies').select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (opts?.status) q = q.eq('status', opts.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TreasuryAnomaly[];
    },
  });

  const scan = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('treasury-anomaly-scan', {
        body: { organization_id: orgId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treasury-anomalies'] });
      toast.success('Scan complete');
    },
    onError: (e: Error) => toast.error(`Scan failed: ${e.message}`),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: AnomalyStatus; note?: string }) => {
      const patch: Record<string, unknown> = { status };
      if (status === 'resolved' || status === 'dismissed') {
        patch.resolved_at = new Date().toISOString();
        patch.resolved_by = user?.id ?? null;
      }
      if (note) patch.payload = { note };
      const { error } = await (supabase as any).from('treasury_anomalies').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treasury-anomalies'] });
      toast.success('Anomaly updated');
    },
    onError: (e: Error) => toast.error(`Update failed: ${e.message}`),
  });

  return {
    anomalies: query.data ?? [],
    open: (query.data ?? []).filter((a) => a.status === 'open'),
    critical: (query.data ?? []).filter((a) => a.severity === 'critical' && a.status === 'open'),
    isLoading: query.isLoading,
    scan,
    updateStatus,
  };
}
