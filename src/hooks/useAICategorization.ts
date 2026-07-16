// Phase 3 — AI categorization hook.
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CategorizationSuggestion {
  id: string;
  gl_account_id: string | null;
  category: string | null;
  confidence: number;
  reasoning?: string;
  source: "rule" | "cache" | "ai" | "none";
}

export function useAICategorization() {
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categorize = useCallback(
    async (
      organizationId: string,
      transactionIds: string[],
    ): Promise<CategorizationSuggestion[]> => {
      setIsCategorizing(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "ai-categorize-transactions",
          { body: { organization_id: organizationId, transaction_ids: transactionIds } },
        );
        if (fnError) throw new Error(fnError.message);
        if ((data as { error?: string })?.error) {
          throw new Error((data as { error: string }).error);
        }
        return (data as { suggestions: CategorizationSuggestion[] }).suggestions ?? [];
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return [];
      } finally {
        setIsCategorizing(false);
      }
    },
    [],
  );

  const applySuggestions = useCallback(
    async (accepted: CategorizationSuggestion[]): Promise<number> => {
      setIsApplying(true);
      setError(null);
      try {
        let n = 0;
        for (const s of accepted) {
          if (!s.gl_account_id) continue;
          const { error: upErr } = await supabase
            .from("bank_transactions")
            .update({
              gl_account_id: s.gl_account_id,
              category: s.category ?? null,
            })
            .eq("id", s.id);
          if (!upErr) n++;
        }
        return n;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return 0;
      } finally {
        setIsApplying(false);
      }
    },
    [],
  );

  return { isCategorizing, isApplying, error, categorize, applySuggestions };
}
