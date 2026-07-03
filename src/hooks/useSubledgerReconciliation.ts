import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface SubledgerRow {
  subledger: string;
  reference_id: string | null;
  reference_label: string;
  subledger_balance: number;
  gl_balance: number;
  difference: number;
}

export interface SafeRecalcResult {
  corrected_count: number;
  total_drift: number;
}

/**
 * Phase 2 — Always Balanced.
 * Compares AR/AP/Bank subledgers against GL control accounts and exposes
 * a "safe recalculate" wrapper that rebuilds account balances from the GL.
 */
export function useSubledgerReconciliation() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  const recon = useQuery({
    queryKey: ['subledger-reconciliation', orgId],
    queryFn: async (): Promise<SubledgerRow[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase.rpc('subledger_reconciliation', {
        p_organization_id: orgId,
      });
      if (error) throw error;
      return (data ?? []) as SubledgerRow[];
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  const safeRecalc = useMutation({
    mutationFn: async (): Promise<SafeRecalcResult | null> => {
      if (!orgId) throw new Error('No organization selected');
      const { data, error } = await supabase.rpc('safe_recalculate_balances', {
        p_organization_id: orgId,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as SafeRecalcResult | null;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['subledger-reconciliation', orgId] });
      queryClient.invalidateQueries({ queryKey: ['integrity-findings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['balance-sheet'] });
      if (!res || res.corrected_count === 0) {
        toast.success('Balances are already in sync.');
      } else {
        toast.success(`Recalculated ${res.corrected_count} account balance(s).`);
      }
    },
    onError: (err: Error) => toast.error(`Safe recalculate failed: ${err.message}`),
  });

  return {
    rows: recon.data ?? [],
    isLoading: recon.isLoading,
    refetch: recon.refetch,
    safeRecalculate: safeRecalc.mutate,
    isRecalculating: safeRecalc.isPending,
  };
}
