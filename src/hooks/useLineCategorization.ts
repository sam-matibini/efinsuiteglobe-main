// Phase 8 — Unified categorization hook covering AP + revenue targets.
// Routes to the appropriate edge function and writes the correct account column
// per target when applying accepted suggestions.
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CategorizationSuggestion, PromoteItem } from "./useAICategorization";

export type LineContext = "ap" | "revenue";
export type LineTarget = "bill" | "expense" | "invoice" | "journal";

const CONFIG: Record<
  LineTarget,
  { context: LineContext; endpoint: string; table: string; accountCol: string }
> = {
  bill: {
    context: "ap",
    endpoint: "ai-categorize-ap-lines",
    table: "bill_lines",
    accountCol: "expense_account_id",
  },
  expense: {
    context: "ap",
    endpoint: "ai-categorize-ap-lines",
    table: "expense_claim_lines",
    accountCol: "expense_account_id",
  },
  invoice: {
    context: "revenue",
    endpoint: "ai-categorize-revenue-lines",
    table: "invoice_lines",
    accountCol: "income_account_id",
  },
  journal: {
    context: "revenue",
    endpoint: "ai-categorize-revenue-lines",
    table: "journal_entry_lines",
    accountCol: "account_id",
  },
};

export function useLineCategorization() {
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categorize = useCallback(
    async (
      organizationId: string,
      target: LineTarget,
      lineIds: string[],
    ): Promise<CategorizationSuggestion[]> => {
      setIsCategorizing(true);
      setError(null);
      try {
        const cfg = CONFIG[target];
        const body =
          cfg.context === "ap"
            ? { organization_id: organizationId, target, line_ids: lineIds }
            : { organization_id: organizationId, target, line_ids: lineIds };
        const { data, error: fnError } = await supabase.functions.invoke(cfg.endpoint, { body });
        if (fnError) throw new Error(fnError.message);
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
        return (data as { suggestions: CategorizationSuggestion[] }).suggestions ?? [];
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return [];
      } finally {
        setIsCategorizing(false);
      }
    },
    [],
  );

  const applySuggestions = useCallback(
    async (target: LineTarget, accepted: CategorizationSuggestion[]): Promise<number> => {
      setIsApplying(true);
      setError(null);
      try {
        const cfg = CONFIG[target];
        let n = 0;
        for (const s of accepted) {
          if (!s.gl_account_id) continue;
          const update: Record<string, unknown> = { [cfg.accountCol]: s.gl_account_id };
          if ((target === "expense" || target === "bill") && s.category) {
            update.category = s.category;
          }
          // deno-lint-ignore no-explicit-any
          const { error: upErr } = await (supabase.from as any)(cfg.table)
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
    async (organizationId: string, target: LineTarget, items: PromoteItem[]): Promise<number> => {
      if (items.length === 0) return 0;
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "ai-promote-categorization-rules",
          {
            body: {
              organization_id: organizationId,
              accepted: items,
              context: CONFIG[target].context,
            },
          },
        );
        if (fnError) return 0;
        return (data as { rules_created?: number })?.rules_created ?? 0;
      } catch {
        return 0;
      }
    },
    [],
  );

  return {
    isCategorizing,
    isApplying,
    error,
    categorize,
    applySuggestions,
    promoteRules,
    getConfig: (t: LineTarget) => CONFIG[t],
  };
}
