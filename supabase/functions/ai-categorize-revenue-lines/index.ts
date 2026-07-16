// Phase 7 — AI categorization for revenue-side lines (invoices + manual journal entries).
// Mirrors ai-categorize-ap-lines but targets revenue/other-income accounts and
// writes to invoice_lines.income_account_id / journal_entry_lines.account_id.
// Only DRAFT invoices/journals are touched.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { callGemini, corsHeaders } from "../_shared/gemini.ts";
import { GEMINI_MODELS } from "../_shared/geminiModels.ts";

type Target = "invoice" | "journal";

interface Body {
  organization_id: string;
  target: Target;
  line_ids: string[];
  auto_apply?: boolean;
}

interface Suggestion {
  id: string;
  gl_account_id: string | null;
  category: string | null;
  confidence: number;
  reasoning?: string;
  source: "cache" | "ai" | "none";
}

const DAILY_CAP = 2000;
const BATCH_SIZE = 50;
const CACHE_TTL_DAYS = 30;

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
const normDesc = (s: string) =>
  (s || "").toLowerCase().replace(/\s+/g, " ").replace(/[0-9]{4,}/g, "#").trim();

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
    if (
      !body?.organization_id ||
      !["invoice", "journal"].includes(body?.target) ||
      !Array.isArray(body?.line_ids) ||
      body.line_ids.length === 0
    ) {
      return j({ error: "organization_id, target, line_ids[] required" }, 400);
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

    // Daily cap
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { data: recentLogs } = await admin
      .from("ai_setup_logs")
      .select("detected_value")
      .eq("organization_id", body.organization_id)
      .eq("setup_type", "revenue_categorization")
      .gte("created_at", since);
    const used = (recentLogs ?? []).reduce((sum, l) => {
      const n = (l.detected_value as { count?: number } | null)?.count ?? 0;
      return sum + n;
    }, 0);
    if (used >= DAILY_CAP) {
      return j({ error: `Daily categorization cap reached (${DAILY_CAP}/day)` }, 429);
    }

    // Load lines — only from DRAFT parents in this org
    type Line = {
      id: string;
      description: string | null;
      amount: number | null;
      party: string | null;
    };
    let lines: Line[] = [];

    if (body.target === "invoice") {
      const { data, error } = await admin
        .from("invoice_lines")
        .select("id, description, amount, invoices:invoice_id(status, organization_id, customer:customer_id(name))")
        .in("id", body.line_ids);
      if (error) return j({ error: error.message }, 500);
      lines = (data ?? [])
        .filter((r: any) => r.invoices?.organization_id === body.organization_id && r.invoices?.status === "draft")
        .map((r: any) => ({
          id: r.id,
          description: r.description,
          amount: r.amount,
          party: r.invoices?.customer?.name ?? null,
        }));
    } else {
      const { data, error } = await admin
        .from("journal_entry_lines")
        .select("id, description, debit, credit, journal_entries:journal_entry_id(status, organization_id, reference)")
        .in("id", body.line_ids);
      if (error) return j({ error: error.message }, 500);
      lines = (data ?? [])
        .filter((r: any) => r.journal_entries?.organization_id === body.organization_id && r.journal_entries?.status === "draft")
        .map((r: any) => ({
          id: r.id,
          description: r.description,
          amount: Number(r.credit ?? 0) - Number(r.debit ?? 0),
          party: r.journal_entries?.reference ?? null,
        }));
    }

    // Revenue-side postable accounts
    const { data: accounts } = await admin
      .from("accounts")
      .select("id, code, name, account_type")
      .eq("organization_id", body.organization_id)
      .eq("is_active", true)
      .eq("posting_allowed", true)
      .in("account_type", ["revenue", "other_income", "liability"]) // liability covers deferred revenue
      .order("code");
    const accountList = accounts ?? [];
    const accountIds = new Set(accountList.map((a) => a.id));

    const suggestions: Suggestion[] = [];
    const toAi: Line[] = [];

    for (const l of lines) {
      const raw = `${body.organization_id}|REV|${(l.party ?? "").toLowerCase()}|${normDesc(l.description ?? "")}`;
      const argsHash = await hashKey(raw);
      const { data: cached } = await admin
        .from("ai_formula_cache")
        .select("value, confidence, created_at")
        .eq("organization_id", body.organization_id)
        .eq("formula", "CATEGORIZE_REVENUE")
        .eq("args_hash", argsHash)
        .maybeSingle();
      if (cached) {
        const ageDays = (Date.now() - new Date(cached.created_at).getTime()) / 86_400_000;
        if (ageDays < CACHE_TTL_DAYS) {
          const v = cached.value as { gl_account_id?: string; category?: string; reasoning?: string };
          if (v?.gl_account_id && accountIds.has(v.gl_account_id)) {
            suggestions.push({
              id: l.id,
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
      toAi.push(l);
    }

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
        const linePrompt = batch
          .map(
            (l) =>
              `${l.id} | ${(l.party ?? "").replace(/\|/g, " ")} | ${l.amount ?? 0} | ${(l.description ?? "").replace(/\|/g, " ")}`,
          )
          .join("\n");

        const res = await callGemini({
          model: GEMINI_MODELS.categorization,
          system: `You classify revenue-side line items (customer invoices or manual journal entries) to a GL revenue / other-income / deferred-revenue account and a short category.
Accounts (id|code|name|type):
${accountsPrompt}

Rules:
- Pick the single best gl_account_id from the list above. Do not invent ids.
- Prefer revenue/other_income accounts. Use a liability account only for clearly deferred/unearned revenue.
- Return a concise "category" label (1-3 words) that a bookkeeper would use.
- confidence 0..1 — your honest estimate.`,
          temperature: 0.1,
          maxOutputTokens: 4096,
          jsonSchema: schema,
          messages: [
            {
              role: "user",
              text: `Classify these revenue lines (id | customer/reference | amount | description):\n${linePrompt}`,
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

        for (const r of results) {
          const l = batch.find((b) => b.id === r.id);
          if (!l) continue;
          if (!r.gl_account_id || !accountIds.has(r.gl_account_id)) {
            suggestions.push({
              id: l.id,
              gl_account_id: null,
              category: null,
              confidence: 0,
              reasoning: "AI returned invalid account id",
              source: "none",
            });
            continue;
          }
          suggestions.push({
            id: l.id,
            gl_account_id: r.gl_account_id,
            category: r.category ?? null,
            confidence: Number(r.confidence ?? 0.6),
            reasoning: r.reasoning,
            source: "ai",
          });

          const argsHash = await hashKey(
            `${body.organization_id}|REV|${(l.party ?? "").toLowerCase()}|${normDesc(l.description ?? "")}`,
          );
          await admin.from("ai_formula_cache").upsert({
            organization_id: body.organization_id,
            formula: "CATEGORIZE_REVENUE",
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

        for (const l of batch) {
          if (!suggestions.find((s) => s.id === l.id)) {
            suggestions.push({
              id: l.id,
              gl_account_id: null,
              category: null,
              confidence: 0,
              source: "none",
            });
          }
        }
      }
    }

    await admin.from("ai_setup_logs").insert({
      organization_id: body.organization_id,
      setup_type: "revenue_categorization",
      detected_value: {
        count: lines.length,
        ai_calls: aiCallCount,
        cache_hits: suggestions.filter((s) => s.source === "cache").length,
        target: body.target,
      },
      confidence_score: null,
      was_overridden: false,
    });

    // Auto-apply
    let autoApplied: string[] = [];
    if (body.auto_apply) {
      const { data: settings } = await admin
        .from("ai_categorization_settings")
        .select("auto_apply_enabled, auto_apply_threshold, auto_apply_scopes")
        .eq("organization_id", body.organization_id)
        .maybeSingle();
      if (
        settings?.auto_apply_enabled &&
        (settings.auto_apply_scopes ?? []).includes(body.target)
      ) {
        const threshold = Number(settings.auto_apply_threshold ?? 95) / 100;
        const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
        const { data: fb } = await admin
          .from("ai_categorization_feedback")
          .select("accepted")
          .eq("organization_id", body.organization_id)
          .eq("context", "revenue")
          .eq("target", body.target)
          .gte("created_at", since30);
        const total = fb?.length ?? 0;
        const accepted = (fb ?? []).filter((r) => r.accepted).length;
        const rate = total >= 20 ? accepted / total : 1;
        if (rate >= 0.8) {
          const table = body.target === "invoice" ? "invoice_lines" : "journal_entry_lines";
          const col = body.target === "invoice" ? "income_account_id" : "account_id";
          for (const s of suggestions) {
            if (
              s.gl_account_id &&
              s.confidence >= threshold &&
              (s.source === "cache" || s.source === "ai")
            ) {
              // Read prior value for undo log
              const { data: prior } = await admin
                .from(table)
                .select(`id, ${col}`)
                .eq("id", s.id)
                .maybeSingle();
              const priorVal = (prior as Record<string, unknown> | null)?.[col] ?? null;

              const { error: upErr } = await admin
                .from(table)
                .update({ [col]: s.gl_account_id })
                .eq("id", s.id);
              if (!upErr) {
                autoApplied.push(s.id);
                await admin.from("ai_categorization_applications").insert({
                  organization_id: body.organization_id,
                  context: "revenue",
                  target: body.target,
                  row_id: s.id,
                  prior_value: { [col]: priorVal },
                  new_value: { [col]: s.gl_account_id },
                  confidence: s.confidence,
                  source: s.source,
                  reasoning: s.reasoning ?? null,
                });
              }
            }
          }
          if (autoApplied.length > 0) {
            const rows = suggestions
              .filter((s) => autoApplied.includes(s.id))
              .map((s) => ({
                organization_id: body.organization_id,
                context: "revenue" as const,
                target: body.target as "invoice" | "journal",
                line_id: s.id,
                suggested_account_id: s.gl_account_id,
                final_account_id: s.gl_account_id,
                source: s.source,
                confidence: s.confidence,
              }));
            await admin.from("ai_categorization_feedback").insert(rows);
          }
        }
      }
    }

    return j({ suggestions, auto_applied: autoApplied });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ai-categorize-revenue-lines error", msg);
    return j({ error: msg }, 500);
  }
});
