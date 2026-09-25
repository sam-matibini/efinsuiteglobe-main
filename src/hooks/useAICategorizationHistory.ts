// Phase 7 — Hook for AI categorization application history + undo.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CategorizationApplication {
  id: string;
  organization_id: string;
  context: "bank" | "ap" | "revenue";
  target: "bank_transaction" | "bill" | "expense" | "po" | "invoice" | "journal";
  row_id: string;
  prior_value: Record<string, unknown> | null;
  new_value: Record<string, unknown>;
  confidence: number | null;
  source: string | null;
  reasoning: string | null;
  applied_at: string;
  undone_at: string | null;
}

export function useAICategorizationHistory(organizationId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ai-categorization-history", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<CategorizationApplication[]> => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("ai_categorization_applications")
        .select("*")
        .eq("organization_id", organizationId!)
        .gte("applied_at", since)
        .order("applied_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as CategorizationApplication[];
    },
  });

  const undo = useMutation({
    mutationFn: async (applicationIds: string[]) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase.functions.invoke("ai-undo-categorization", {
        body: { organization_id: organizationId, application_ids: applicationIds },
      });
      if (error) throw error;
      return data as { ok: boolean; undone: number; errors: Array<{ id: string; error: string }> };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-categorization-history", organizationId] });
      qc.invalidateQueries({ queryKey: ["ai-categorization-insights", organizationId] });
    },
  });

  return { ...query, undo };
}
