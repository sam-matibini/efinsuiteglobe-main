// Phase 3.2 — Promote accepted AI categorizations into reusable transaction_rules.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/gemini.ts";

interface AcceptedItem {
  description: string | null;
  gl_account_id: string;
  category?: string | null;
}

interface Payload {
  organization_id: string;
  accepted: AcceptedItem[];
}

const STOPWORDS = new Set([
  "the", "and", "for", "from", "with", "into", "your", "this", "that",
  "payment", "purchase", "debit", "credit", "card", "transaction", "trans",
  "pos", "eft", "www", "com", "inc", "ltd", "llc", "corp",
]);

function deriveKeyword(description: string | null): string | null {
  if (!description) return null;
  const tokens = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !/^\d/.test(t) && !STOPWORDS.has(t));
  if (tokens.length === 0) return null;
  // Longest token — usually the merchant name.
  return tokens.sort((a, b) => b.length - a.length)[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    if (!body.organization_id || !Array.isArray(body.accepted)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Group by (keyword, gl_account_id) to dedupe within this request.
    const groups = new Map<string, { keyword: string; gl_account_id: string; category: string | null }>();
    for (const item of body.accepted) {
      if (!item.gl_account_id) continue;
      const keyword = deriveKeyword(item.description);
      if (!keyword) continue;
      const key = `${keyword}::${item.gl_account_id}`;
      if (!groups.has(key)) {
        groups.set(key, { keyword, gl_account_id: item.gl_account_id, category: item.category ?? null });
      }
    }

    if (groups.size === 0) {
      return new Response(JSON.stringify({ rules_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load existing rules for this org to dedupe against.
    const { data: existing } = await supabase
      .from("transaction_rules")
      .select("id, name, conditions, actions")
      .eq("organization_id", body.organization_id);

    const existingKeys = new Set<string>();
    for (const r of existing ?? []) {
      const conds = (r.conditions as Array<{ field?: string; operator?: string; value?: string }>) ?? [];
      const acts = (r.actions as Array<{ type?: string; glAccountId?: string; account_id?: string }>) ?? [];
      const kw = conds.find((c) => c.field === "description" && c.operator === "contains")?.value?.toLowerCase();
      const acc = acts.find((a) => a.type === "categorize" || a.type === "post_to_gl")?.glAccountId
        ?? acts.find((a) => (a as { account_id?: string }).account_id)?.account_id;
      if (kw && acc) existingKeys.add(`${kw}::${acc}`);
    }

    const toInsert: Array<Record<string, unknown>> = [];
    for (const [key, g] of groups) {
      if (existingKeys.has(key)) continue;
      toInsert.push({
        organization_id: body.organization_id,
        name: `AI: "${g.keyword}"`,
        description: `Auto-created from accepted AI suggestion`,
        is_active: true,
        priority: 50,
        logic_operator: "and",
        conditions: [
          {
            id: crypto.randomUUID(),
            field: "description",
            operator: "contains",
            value: g.keyword,
          },
        ],
        actions: [
          {
            type: "categorize",
            glAccountId: g.gl_account_id,
            category: g.category ?? undefined,
          },
        ],
      });
    }

    let created = 0;
    if (toInsert.length > 0) {
      const { error, data } = await supabase
        .from("transaction_rules")
        .insert(toInsert)
        .select("id");
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      created = data?.length ?? 0;
    }

    return new Response(JSON.stringify({ rules_created: created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
