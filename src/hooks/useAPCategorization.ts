// Phase 4 — AI categorization hook for AP lines (bills + expense claims).
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CategorizationSuggestion, PromoteItem } from "./useAICategorization";

export type APTarget = "bill" | "expense";

export function useAPCategorization() {
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categorize = useCallback(
    async (
      organizationId: string,
      target: APTarget,
      lineIds: string[],
    ): Promise<CategorizationSuggestion[]> => {
      setIsCategorizing(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "ai-categorize-ap-lines",
          { body: { organization_id: organizationId, target, line_ids: lineIds } },
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
    async (target: APTarget, accepted: CategorizationSuggestion[]): Promise<number> => {
      setIsApplying(true);
      setError(null);
      try {
        const table = target === "bill" ? "bill_lines" : "expense_claim_lines";
        let n = 0;
        for (const s of accepted) {
          if (!s.gl_account_id) continue;
          const update: Record<string, unknown> = { expense_account_id: s.gl_account_id };
          if (target === "expense" && s.category) update.category = s.category;
          const { error: upErr } = await supabase
            .from(table)
            .update(update)
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

  const promoteRules = useCallback(
    async (organizationId: string, items: PromoteItem[]): Promise<number> => {
      if (items.length === 0) return 0;
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "ai-promote-categorization-rules",
          { body: { organization_id: organizationId, accepted: items, context: "ap" } },
        );
        if (fnError) return 0;
        return (data as { rules_created?: number })?.rules_created ?? 0;
      } catch {
        return 0;
      }
    },
    [],
  );

  return { isCategorizing, isApplying, error, categorize, applySuggestions, promoteRules };
}
