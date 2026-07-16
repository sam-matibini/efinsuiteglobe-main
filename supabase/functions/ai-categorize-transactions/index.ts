// Phase 3 — AI Transaction Categorization
// Suggests gl_account_id + category for bank_transactions using Gemini Flash.
// Deterministic transaction_rules are applied first; only unmatched rows hit AI.
// Results cached per (org, description-hash+sign) for 30 days.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { callGemini, corsHeaders } from "../_shared/gemini.ts";
import { GEMINI_MODELS } from "../_shared/geminiModels.ts";

interface Body {
  organization_id: string;
  transaction_ids: string[];
}

interface Suggestion {
  id: string;
  gl_account_id: string | null;
  category: string | null;
  confidence: number;
  reasoning?: string;
  source: "rule" | "cache" | "ai" | "none";
}

const DAILY_CAP = 2000;
const BATCH_SIZE = 50;
const CACHE_TTL_DAYS = 30;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
    .replace(/[0-9]{4,}/g, "#") // strip long digit sequences
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supa.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Body;
    if (!body?.organization_id || !Array.isArray(body.transaction_ids) || body.transaction_ids.length === 0) {
      return json({ error: "organization_id and transaction_ids[] required" }, 400);
    }

    const { data: isMember } = await supa.rpc("is_org_member", {
      _user_id: userData.user.id,
      _org_id: body.organization_id,
    });
    if (!isMember) return json({ error: "Forbidden" }, 403);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Daily cap check (last 24h summed transaction count).
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { data: recentLogs } = await admin
      .from("ai_setup_logs")
      .select("detected_value")
      .eq("organization_id", body.organization_id)
      .eq("setup_type", "transaction_categorization")
      .gte("created_at", since);
    const used = (recentLogs ?? []).reduce((sum, l) => {
      const n = (l.detected_value as { count?: number } | null)?.count ?? 0;
      return sum + n;
    }, 0);
    if (used >= DAILY_CAP) {
      return json({ error: `Daily categorization cap reached (${DAILY_CAP}/day)` }, 429);
    }

    // Load transactions.
    const { data: txns, error: txnErr } = await admin
      .from("bank_transactions")
      .select("id, description, amount, transaction_type, payee_payor, category, gl_account_id, bank_account_id")
      .in("id", body.transaction_ids);
    if (txnErr) return json({ error: txnErr.message }, 500);

    // Load chart of accounts (postable only).
    const { data: accounts } = await admin
      .from("accounts")
      .select("id, code, name, account_type")
      .eq("organization_id", body.organization_id)
      .eq("is_active", true)
      .eq("posting_allowed", true)
      .order("code");
    const accountList = accounts ?? [];
    const accountIds = new Set(accountList.map((a) => a.id));

    // Load org transaction_rules (simple substring match on description).
    const { data: rules } = await admin
      .from("transaction_rules")
      .select("id, name, match_pattern, gl_account_id, category, is_active")
      .eq("organization_id", body.organization_id)
      .eq("is_active", true);

    // Note: transaction_rules use jsonb conditions/actions; deterministic matching
    // is deferred to a future phase. All uncategorized rows go through cache → AI.
    const suggestions: Suggestion[] = [];
    const toAi: typeof txns = [];

    for (const t of txns ?? []) {

      const sign = Number(t.amount) >= 0 ? "+" : "-";
      const cacheKeyRaw = `${body.organization_id}|${sign}|${normDesc(t.description ?? "")}`;
      const argsHash = await hashKey(cacheKeyRaw);
      const { data: cached } = await admin
        .from("ai_formula_cache")
        .select("value, confidence, created_at")
        .eq("organization_id", body.organization_id)
        .eq("formula", "CATEGORIZE")
        .eq("args_hash", argsHash)
        .maybeSingle();
      if (cached) {
        const ageDays = (Date.now() - new Date(cached.created_at).getTime()) / 86_400_000;
        if (ageDays < CACHE_TTL_DAYS) {
          const v = cached.value as { gl_account_id?: string; category?: string; reasoning?: string };
          if (v?.gl_account_id && accountIds.has(v.gl_account_id)) {
            suggestions.push({
              id: t.id,
              gl_account_id: v.gl_account_id,
              category: v.category ?? null,
              confidence: cached.confidence ?? 0.8,
              reasoning: v.reasoning,
              source: "cache",
            });
            continue;
          }
        }
      }

      toAi.push(t);
    }

    // 3) AI batches.
    let aiCallCount = 0;
    if (toAi.length > 0 && accountList.length > 0) {
      const accountsPrompt = accountList
        .map((a) => `${a.id}|${a.code}|${a.name}|${a.account_type}`)
        .join("\n");

      const schema = {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                gl_account_id: { type: "string" },
                category: { type: "string" },
                confidence: { type: "number" },
                reasoning: { type: "string" },
              },
              required: ["id", "gl_account_id", "category", "confidence"],
            },
          },
        },
        required: ["results"],
      };

      for (let i = 0; i < toAi.length; i += BATCH_SIZE) {
        const batch = toAi.slice(i, i + BATCH_SIZE);
        const txPrompt = batch
          .map(
            (t) =>
              `${t.id} | ${t.transaction_type} | ${t.amount} | ${(t.payee_payor ?? "").replace(/\|/g, " ")} | ${(t.description ?? "").replace(/\|/g, " ")}`,
          )
          .join("\n");

        const res = await callGemini({
          model: GEMINI_MODELS.categorization,
          system: `You classify bank transactions to a GL account and a short category.
Accounts (id|code|name|type):
${accountsPrompt}

Rules:
- Pick the single best gl_account_id from the list above. Do not invent ids.
- Deposits/credits typically map to revenue or income accounts; withdrawals/debits to expense accounts.
- Return a concise "category" label (1-3 words) that a bookkeeper would use.
- confidence 0..1 — your honest estimate.`,
          temperature: 0.1,
          maxOutputTokens: 4096,
          jsonSchema: schema,
          messages: [
            {
              role: "user",
              text: `Classify these transactions (id | type | amount | payee | description):\n${txPrompt}`,
            },
          ],
        });
        aiCallCount++;

        const results = ((res.json as { results?: Array<Record<string, unknown>> })?.results ?? []) as Array<{
          id: string;
          gl_account_id: string;
          category?: string;
          confidence?: number;
          reasoning?: string;
        }>;

        // Persist cache + collect suggestions.
        for (const r of results) {
          const t = batch.find((b) => b.id === r.id);
          if (!t) continue;
          if (!r.gl_account_id || !accountIds.has(r.gl_account_id)) {
            suggestions.push({
              id: t.id,
              gl_account_id: null,
              category: null,
              confidence: 0,
              reasoning: "AI returned invalid account id",
              source: "none",
            });
            continue;
          }
          suggestions.push({
            id: t.id,
            gl_account_id: r.gl_account_id,
            category: r.category ?? null,
            confidence: Number(r.confidence ?? 0.6),
            reasoning: r.reasoning,
            source: "ai",
          });

          // Cache it.
          const sign = Number(t.amount) >= 0 ? "+" : "-";
          const argsHash = await hashKey(
            `${body.organization_id}|${sign}|${normDesc(t.description ?? "")}`,
          );
          await admin.from("ai_formula_cache").upsert({
            organization_id: body.organization_id,
            formula: "CATEGORIZE",
            args_hash: argsHash,
            value: {
              gl_account_id: r.gl_account_id,
              category: r.category ?? null,
              reasoning: r.reasoning ?? null,
            } as unknown as Record<string, unknown>,
            confidence: Number(r.confidence ?? 0.6),
            created_at: new Date().toISOString(),
          });
        }

        // Any batch item not returned by AI → mark as none.
        for (const t of batch) {
          if (!suggestions.find((s) => s.id === t.id)) {
            suggestions.push({
              id: t.id,
              gl_account_id: null,
              category: null,
              confidence: 0,
              source: "none",
            });
          }
        }
      }
    }

    // Log usage.
    await admin.from("ai_setup_logs").insert({
      organization_id: body.organization_id,
      setup_type: "transaction_categorization",
      detected_value: {
        count: (txns ?? []).length,
        ai_calls: aiCallCount,
        rule_hits: suggestions.filter((s) => s.source === "rule").length,
        cache_hits: suggestions.filter((s) => s.source === "cache").length,
      },
      confidence_score: null,
      was_overridden: false,
    });

    return json({ suggestions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ai-categorize-transactions error", msg);
    return json({ error: msg }, 500);
  }
});
