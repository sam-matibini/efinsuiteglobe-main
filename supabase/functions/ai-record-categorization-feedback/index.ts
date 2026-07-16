// Phase 5 — Record AI categorization feedback (accepted / overridden).
// - Inserts one row per suggestion into ai_categorization_feedback.
// - Invalidates matching ai_formula_cache rows when the user overrode a cache/ai suggestion.
// - Auto-promotes a rule when >=3 overrides converge on the same corrected account for a vendor.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Context = "bank" | "ap";
type Target = "bank_transaction" | "bill" | "expense";
type Source = "cache" | "ai" | "none" | "manual";

interface FeedbackItem {
  line_id: string;
  target: Target;
  suggested_account_id: string | null;
  final_account_id: string | null;
  source: Source;
  confidence: number | null;
  vendor_key?: string | null;
  desc_key?: string | null;
}

interface Body {
  organization_id: string;
  context: Context;
  items: FeedbackItem[];
}

const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hashKey(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normDesc(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[0-9]{4,}/g, "#")
    .trim();
}

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
    if (!body?.organization_id || !body?.context || !Array.isArray(body?.items)) {
      return j({ error: "organization_id, context, items[] required" }, 400);
    }
    if (body.items.length === 0) return j({ ok: true, inserted: 0 });

    const { data: isMember } = await supa.rpc("is_org_member", {
      _user_id: userData.user.id,
      _org_id: body.organization_id,
    });
    if (!isMember) return j({ error: "Forbidden" }, 403);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Insert feedback rows
    const rows = body.items.map((it) => ({
      organization_id: body.organization_id,
      context: body.context,
      target: it.target,
      line_id: it.line_id,
      suggested_account_id: it.suggested_account_id,
      final_account_id: it.final_account_id,
      source: it.source,
      confidence: it.confidence,
      vendor_key: (it.vendor_key ?? "").toLowerCase() || null,
      desc_key: normDesc(it.desc_key ?? "") || null,
      created_by: userData.user.id,
    }));

    const { error: insErr } = await admin
      .from("ai_categorization_feedback")
      .insert(rows);
    if (insErr) return j({ error: insErr.message }, 500);

    // Invalidate stale cache for overridden cache/ai suggestions
    const formula = body.context === "bank" ? "CATEGORIZE_TXN" : "CATEGORIZE_AP";
    const prefix = body.context === "bank" ? "" : "AP|";
    let cacheInvalidated = 0;
    for (const it of body.items) {
      const overridden =
        it.suggested_account_id !== it.final_account_id &&
        (it.source === "cache" || it.source === "ai");
      if (!overridden) continue;
      const vendor = (it.vendor_key ?? "").toLowerCase();
      const desc = normDesc(it.desc_key ?? "");
      const key = `${body.organization_id}|${prefix}${vendor}|${desc}`;
      const argsHash = await hashKey(key);
      const { error: delErr } = await admin
        .from("ai_formula_cache")
        .delete()
        .eq("organization_id", body.organization_id)
        .eq("formula", formula)
        .eq("args_hash", argsHash);
      if (!delErr) cacheInvalidated++;
    }

    // Auto-promote rules: if >=3 corrections agree on same final account for same (vendor,desc_key)
    let autoRulesPromoted = 0;
    const overrideKeys = new Map<
      string,
      { vendor: string; desc: string; final: string }
    >();
    for (const it of body.items) {
      if (
        !it.final_account_id ||
        it.suggested_account_id === it.final_account_id ||
        !(it.vendor_key || it.desc_key)
      )
        continue;
      const vendor = (it.vendor_key ?? "").toLowerCase();
      const desc = normDesc(it.desc_key ?? "");
      overrideKeys.set(`${vendor}|${desc}|${it.final_account_id}`, {
        vendor,
        desc,
        final: it.final_account_id,
      });
    }
    for (const entry of overrideKeys.values()) {
      const { count } = await admin
        .from("ai_categorization_feedback")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", body.organization_id)
        .eq("context", body.context)
        .eq("final_account_id", entry.final)
        .eq("vendor_key", entry.vendor || null)
        .eq("desc_key", entry.desc || null);
      if ((count ?? 0) >= 3) {
        const { data, error } = await supa.functions.invoke(
          "ai-promote-categorization-rules",
          {
            body: {
              organization_id: body.organization_id,
              context: body.context === "bank" ? "bank" : "ap",
              accepted: [
                {
                  description: entry.desc || entry.vendor || null,
                  gl_account_id: entry.final,
                },
              ],
            },
          },
        );
        if (!error) {
          autoRulesPromoted += (data as { rules_created?: number })?.rules_created ?? 0;
        }
      }
    }

    return j({
      ok: true,
      inserted: rows.length,
      cache_invalidated: cacheInvalidated,
      auto_rules_promoted: autoRulesPromoted,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ai-record-categorization-feedback error", msg);
    return j({ error: msg }, 500);
  }
});
