// Phase 7 — Undo an AI-auto-applied categorization.
// Restores the row's prior column value(s), marks the application record undone,
// and logs a corrective feedback row so the model learns from the reversal.
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

interface Body {
  organization_id: string;
  application_ids: string[];
}

const TABLE_BY_TARGET: Record<string, string> = {
  bank_transaction: "bank_transactions",
  bill: "bill_lines",
  expense: "expense_claim_lines",
  po: "purchase_order_lines",
  invoice: "invoice_lines",
  journal: "journal_entry_lines",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return j({ error: "Unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supa.auth.getUser();
    if (!userData?.user) return j({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Body;
    if (!body?.organization_id || !Array.isArray(body?.application_ids) || body.application_ids.length === 0) {
      return j({ error: "organization_id and application_ids[] required" }, 400);
    }

    const { data: isMember } = await supa.rpc("is_org_member", {
      _user_id: userData.user.id,
      _org_id: body.organization_id,
    });
    if (!isMember) return j({ error: "Forbidden" }, 403);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: apps, error: fetchErr } = await admin
      .from("ai_categorization_applications")
      .select("id, target, row_id, prior_value, new_value, context")
      .eq("organization_id", body.organization_id)
      .in("id", body.application_ids)
      .is("undone_at", null);
    if (fetchErr) return j({ error: fetchErr.message }, 500);

    let undone = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const app of apps ?? []) {
      const table = TABLE_BY_TARGET[app.target];
      if (!table) {
        errors.push({ id: app.id, error: `Unknown target ${app.target}` });
        continue;
      }
      const prior = (app.prior_value ?? {}) as Record<string, unknown>;
      const cols = Object.keys(prior);
      if (cols.length === 0) {
        errors.push({ id: app.id, error: "No prior_value recorded" });
        continue;
      }
      const update: Record<string, unknown> = {};
      for (const c of cols) update[c] = prior[c];

      const { error: upErr } = await admin.from(table).update(update).eq("id", app.row_id);
      if (upErr) {
        errors.push({ id: app.id, error: upErr.message });
        continue;
      }

      await admin
        .from("ai_categorization_applications")
        .update({ undone_at: new Date().toISOString(), undone_by: userData.user.id })
        .eq("id", app.id);

      // Corrective feedback — the AI-applied value was rejected.
      const newVal = (app.new_value ?? {}) as Record<string, unknown>;
      const primaryCol = cols[0];
      const suggested = newVal[primaryCol] as string | null | undefined;
      const finalPrior = prior[primaryCol] as string | null | undefined;
      const targetKey =
        app.target === "bank_transaction" ? "bank_transaction" : (app.target as string);
      await admin.from("ai_categorization_feedback").insert({
        organization_id: body.organization_id,
        context: app.context,
        target: targetKey,
        line_id: app.row_id,
        suggested_account_id: suggested ?? null,
        final_account_id: finalPrior ?? null,
        source: "manual",
        confidence: null,
        created_by: userData.user.id,
      });

      undone++;
    }

    return j({ ok: true, undone, errors });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ai-undo-categorization error", msg);
    return j({ error: msg }, 500);
  }
});
