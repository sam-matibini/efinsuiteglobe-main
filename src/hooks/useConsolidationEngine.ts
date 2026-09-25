import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ConsolidationRun {
  id: string;
  group_id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  base_currency: string;
  status: "pending" | "running" | "completed" | "failed";
  total_assets: number | null;
  total_liabilities: number | null;
  total_equity: number | null;
  total_revenue: number | null;
  total_expenses: number | null;
  net_income: number | null;
  elimination_summary: { members?: Array<Record<string, unknown>> } | null;
  fx_summary: Record<string, number> | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export function useConsolidationRuns(groupId: string | null) {
  return useQuery({
    queryKey: ["consolidation-runs", groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const { data, error } = await supabase
        .from("consolidation_runs")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ConsolidationRun[];
    },
    enabled: !!groupId,
  });
}

export function useRunConsolidation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { group_id: string; period_start: string; period_end: string; base_currency?: string }) => {
      const { data, error } = await supabase.functions.invoke("consolidation-engine", { body: vars });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["consolidation-runs", v.group_id] });
      toast.success("Consolidation run completed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
