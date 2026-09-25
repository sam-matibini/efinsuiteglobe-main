import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { toast } from 'sonner';

export interface ForecastRun {
  id: string;
  organization_id: string;
  horizon_weeks: number;
  horizon_months: number;
  inputs: Record<string, unknown>;
  summary: Record<string, unknown>;
  created_at: string;
}

export interface ForecastLine {
  id: string;
  run_id: string;
  organization_id: string;
  bucket_type: 'week' | 'month';
  bucket_start: string;
  bucket_end: string;
  authority: string;
  program_code: string | null;
  projected_liability: number;
  projected_funding: number;
  funding_gap: number;
  confidence: number;
  details: Record<string, unknown>;
}

export function useTreasuryForecast() {
  const { currentOrganization } = useOrganizationContext();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const runs = useQuery({
    queryKey: ['treasury-forecast-runs', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('treasury_forecast_runs')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as ForecastRun[];
    },
  });

  const latestRun = runs.data?.[0] ?? null;

  const lines = useQuery({
    queryKey: ['treasury-forecast-lines', latestRun?.id],
    enabled: !!latestRun?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('treasury_forecast_lines')
        .select('*')
        .eq('run_id', latestRun!.id)
        .order('bucket_start', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ForecastLine[];
    },
  });

  const generate = useMutation({
    mutationFn: async (input: { payrollGrowth?: number; revenueGrowth?: number }) => {
      const { data, error } = await supabase.functions.invoke('treasury-forecast-engine', {
        body: { organization_id: orgId, ...input },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treasury-forecast-runs', orgId] });
      qc.invalidateQueries({ queryKey: ['treasury-forecast-lines'] });
      toast.success('Forecast updated');
    },
    onError: (e: Error) => toast.error(`Forecast failed: ${e.message}`),
  });

  return {
    runs: runs.data ?? [],
    latestRun,
    lines: lines.data ?? [],
    isLoading: runs.isLoading || lines.isLoading,
    generate,
  };
}
