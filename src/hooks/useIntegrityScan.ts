import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export interface IntegrityFinding {
  id: string;
  organization_id: string;
  check_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  payload: Record<string, unknown>;
  detected_at: string;
  resolved_at: string | null;
}

/**
 * Hook for the Always-Balanced ledger integrity scan.
 * Runs `run_integrity_scan` and exposes the latest findings for the org.
 */
export function useIntegrityScan() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const queryClient = useQueryClient();

  const findingsQuery = useQuery({
    queryKey: ['integrity-findings', orgId],
    queryFn: async (): Promise<IntegrityFinding[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('integrity_findings')
        .select('*')
        .eq('organization_id', orgId)
        .is('resolved_at', null)
        .order('detected_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as IntegrityFinding[];
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });

  const scanMutation = useMutation({
    mutationFn: async (): Promise<IntegrityFinding[]> => {
      if (!orgId) throw new Error('No organization selected');
      const { data, error } = await supabase.rpc('run_integrity_scan', {
        p_organization_id: orgId,
      });
      if (error) throw error;
      return (data ?? []) as IntegrityFinding[];
    },
    onSuccess: (findings) => {
      queryClient.invalidateQueries({ queryKey: ['integrity-findings', orgId] });
      const critical = findings.filter((f) => f.severity === 'critical').length;
      if (findings.length === 0) {
        toast.success('Integrity scan passed — ledger is fully balanced.');
      } else if (critical > 0) {
        toast.error(`Integrity scan found ${critical} critical issue${critical === 1 ? '' : 's'}.`);
      } else {
        toast.warning(`Integrity scan flagged ${findings.length} item${findings.length === 1 ? '' : 's'}.`);
      }
    },
    onError: (err: Error) => {
      toast.error(`Integrity scan failed: ${err.message}`);
    },
  });

  return {
    findings: findingsQuery.data ?? [],
    isLoading: findingsQuery.isLoading,
    refetch: findingsQuery.refetch,
    runScan: scanMutation.mutate,
    isScanning: scanMutation.isPending,
    lastScanResult: scanMutation.data ?? null,
  };
}
