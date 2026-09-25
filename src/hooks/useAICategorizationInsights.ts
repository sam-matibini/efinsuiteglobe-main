// Phase 5 — Insights hook: reads ai_categorization_feedback + ai_setup_logs.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CategorizationInsights {
  totalSuggestions: number;
  acceptedCount: number;
  overriddenCount: number;
  acceptanceRate: number;
  avgConfidence: number;
  cacheHitRate: number;
  aiCallsToday: number;
  dailyCap: number;
  volumeByDay: Array<{ day: string; bank: number; bill: number; expense: number }>;
  topCorrections: Array<{
    vendor_key: string | null;
    desc_key: string | null;
    suggested_account_id: string | null;
    final_account_id: string;
    count: number;
    context: "bank" | "ap" | "revenue";
  }>;
}

const DAILY_CAP = 2000;

export function useCategorizationInsights(
  organizationId: string | undefined,
  opts?: { context?: "bank" | "ap" | "revenue" },
) {
  const contextFilter = opts?.context;
  return useQuery({
    queryKey: ["ai-categorization-insights", organizationId, contextFilter ?? "all"],
    enabled: !!organizationId,
    queryFn: async (): Promise<CategorizationInsights> => {
      const orgId = organizationId!;
      const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const since24h = new Date(Date.now() - 24 * 3_600_000).toISOString();

      let fbQuery = supabase
        .from("ai_categorization_feedback")
        .select(
          "context,target,suggested_account_id,final_account_id,accepted,source,confidence,vendor_key,desc_key,created_at",
        )
        .eq("organization_id", orgId)
        .gte("created_at", since30)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (contextFilter) fbQuery = fbQuery.eq("context", contextFilter);
      const { data: fb = [] } = await fbQuery;

      const { data: logs = [] } = await supabase
        .from("ai_setup_logs")
        .select("detected_value,created_at,setup_type")
        .eq("organization_id", orgId)
        .in("setup_type", ["categorization", "ap_categorization"])
        .gte("created_at", since24h);

      const total = fb.length;
      const accepted = fb.filter((r) => r.accepted).length;
      const overridden = fb.filter(
        (r) => !r.accepted && r.final_account_id && r.suggested_account_id,
      ).length;
      const confVals = fb
        .map((r) => Number(r.confidence ?? 0))
        .filter((n) => n > 0);
      const avgConfidence =
        confVals.length > 0 ? confVals.reduce((a, b) => a + b, 0) / confVals.length : 0;
      const cacheHits = fb.filter((r) => r.source === "cache").length;

      let aiCallsToday = 0;
      for (const l of logs) {
        const n = (l.detected_value as { ai_calls?: number } | null)?.ai_calls ?? 0;
        aiCallsToday += n;
      }

      // Volume by day
      const byDay = new Map<string, { bank: number; bill: number; expense: number }>();
      for (const r of fb) {
        const day = String(r.created_at).slice(0, 10);
        const rec = byDay.get(day) ?? { bank: 0, bill: 0, expense: 0 };
        if (r.target === "bank_transaction") rec.bank++;
        else if (r.target === "bill") rec.bill++;
        else if (r.target === "expense") rec.expense++;
        byDay.set(day, rec);
      }
      const volumeByDay = Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, rec]) => ({ day, ...rec }));

      // Top corrections
      const corrKey = new Map<
        string,
        {
          vendor_key: string | null;
          desc_key: string | null;
          suggested_account_id: string | null;
          final_account_id: string;
          count: number;
          context: "bank" | "ap" | "revenue";
        }
      >();
      for (const r of fb) {
        if (
          !r.final_account_id ||
          r.accepted ||
          r.suggested_account_id === r.final_account_id
        )
          continue;
        const k = `${r.context}|${r.vendor_key ?? ""}|${r.desc_key ?? ""}|${r.suggested_account_id ?? ""}→${r.final_account_id}`;
        const existing = corrKey.get(k);
        if (existing) existing.count++;
        else
          corrKey.set(k, {
            vendor_key: r.vendor_key,
            desc_key: r.desc_key,
            suggested_account_id: r.suggested_account_id,
            final_account_id: r.final_account_id,
            count: 1,
            context: r.context as "bank" | "ap" | "revenue",
          });
      }
      const topCorrections = Array.from(corrKey.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      return {
        totalSuggestions: total,
        acceptedCount: accepted,
        overriddenCount: overridden,
        acceptanceRate: total > 0 ? accepted / total : 0,
        avgConfidence,
        cacheHitRate: total > 0 ? cacheHits / total : 0,
        aiCallsToday,
        dailyCap: DAILY_CAP,
        volumeByDay,
        topCorrections,
      };
    },
  });
}
