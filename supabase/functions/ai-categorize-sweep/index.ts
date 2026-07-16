// Phase 6 — Scheduled AI categorization sweep.
// Runs periodically (via cron/pg_net) and auto-categorizes uncategorized lines
// for orgs that have opted-in via ai_categorization_settings.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SCOPE_LIMIT = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settingsList } = await admin
      .from("ai_categorization_settings")
      .select("organization_id, auto_apply_scopes")
      .eq("auto_apply_enabled", true);

    const results: Array<Record<string, unknown>> = [];
    for (const cfg of settingsList ?? []) {
      const orgId = cfg.organization_id as string;
      const scopes: string[] = cfg.auto_apply_scopes ?? [];
      const summary: Record<string, number> = { bank: 0, bill: 0, expense: 0 };

      const invoke = async (path: string, body: unknown) => {
        const r = await fetch(`${Deno.env.get("SUPABASE_URL")!}/functions/v1/${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
          },
          body: JSON.stringify(body),
        });
        return (await r.json().catch(() => ({}))) as { auto_applied?: string[] };
      };

      if (scopes.includes("bank")) {
        const { data: rows } = await admin
          .from("bank_transactions")
          .select("id")
          .eq("organization_id", orgId)
          .is("gl_account_id", null)
          .limit(SCOPE_LIMIT);
        const ids = (rows ?? []).map((r) => r.id);
        if (ids.length > 0) {
          const res = await invoke("ai-categorize-transactions", {
            organization_id: orgId,
            transaction_ids: ids,
            auto_apply: true,
          });
          summary.bank = res.auto_applied?.length ?? 0;
        }
      }

      for (const target of ["bill", "expense"] as const) {
        if (!scopes.includes(target)) continue;
        const table = target === "bill" ? "bill_lines" : "expense_claim_lines";
        const parent = target === "bill" ? "bills" : "expense_claims";
        const { data: rows } = await admin
          .from(table)
          .select(`id, ${parent}!inner(organization_id)`)
          .is("expense_account_id", null)
          .eq(`${parent}.organization_id`, orgId)
          .limit(SCOPE_LIMIT);
        const ids = (rows ?? []).map((r: { id: string }) => r.id);
        if (ids.length > 0) {
          const res = await invoke("ai-categorize-ap-lines", {
            organization_id: orgId,
            target,
            line_ids: ids,
            auto_apply: true,
          });
          summary[target] = res.auto_applied?.length ?? 0;
        }
      }

      await admin.from("ai_setup_logs").insert({
        organization_id: orgId,
        setup_type: "auto_apply_sweep",
        detected_value: summary as unknown as Record<string, unknown>,
        confidence_score: null,
        was_overridden: false,
      });
      results.push({ organization_id: orgId, ...summary });
    }

    return j({ ok: true, processed: results.length, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ai-categorize-sweep error", msg);
    return j({ error: msg }, 500);
  }
});
