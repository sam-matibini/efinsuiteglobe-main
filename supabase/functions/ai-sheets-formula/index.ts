// AI Sheets formula backend (Phase 8).
// Handles =AI, =CLASSIFY, =EXPLAIN, =SUMMARIZE, =PREDICT, =ANALYZE, =GENERATE_JE.
// Routes each formula to a purpose-built Gemini prompt via callGemini.
// Caches results per (org, formula, args_hash) for 24h in ai_formula_cache.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { callGemini, corsHeaders } from "../_shared/gemini.ts";
import { GEMINI_MODELS } from "../_shared/geminiModels.ts";

type Formula =
  | "AI"
  | "CLASSIFY"
  | "EXPLAIN"
  | "SUMMARIZE"
  | "PREDICT"
  | "FORECAST"
  | "ANALYZE"
  | "GENERATE_JE";

interface Body {
  organization_id: string;
  formula: Formula;
  args: unknown[];
  context?: {
    columns?: string[];
    sampleRows?: Array<Record<string, unknown>>;
  };
}

const TTL_HOURS = 24;

async function hashArgs(formula: string, args: unknown[]): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(formula + "::" + JSON.stringify(args ?? []));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function argsToText(args: unknown[]): string {
  return args
    .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a ?? "")))
    .join(" | ");
}

interface FormulaResult {
  value: string | number;
  confidence?: number;
  explanation?: string;
}

async function runFormula(
  formula: Formula,
  args: unknown[],
  context: Body["context"],
): Promise<FormulaResult> {
  const model = GEMINI_MODELS.aliceSheets;
  const argsText = argsToText(args);
  const ctxText = context
    ? `\n\nSheet columns: ${JSON.stringify(context.columns ?? [])}\nSample rows: ${JSON.stringify((context.sampleRows ?? []).slice(0, 5))}`
    : "";

  switch (formula) {
    case "CLASSIFY": {
      const schema = {
        type: "object",
        properties: {
          category: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["category"],
      };
      const res = await callGemini({
        model,
        system:
          "You are Alice, an accounting classifier. Given a transaction description, return the best GL category (e.g. Meals & Entertainment, Office Supplies, Travel, Software Subscriptions, Bank Fees, Payroll, Utilities, Rent, Revenue, Cost of Goods Sold). Reply as JSON.",
        messages: [{ role: "user", text: `Classify: ${argsText}${ctxText}` }],
        jsonSchema: schema,
        temperature: 0,
      });
      const parsed = (res.json ?? {}) as { category?: string; confidence?: number };
      return {
        value: parsed.category ?? res.text,
        confidence: parsed.confidence,
      };
    }

    case "PREDICT":
    case "FORECAST": {
      const schema = {
        type: "object",
        properties: {
          value: { type: "number" },
          confidence: { type: "number" },
          explanation: { type: "string" },
        },
        required: ["value"],
      };
      const res = await callGemini({
        model,
        system:
          "You are Alice, a financial forecaster. Given a numeric series or description, predict the next value. Reply as JSON only.",
        messages: [{ role: "user", text: `Predict next value from: ${argsText}${ctxText}` }],
        jsonSchema: schema,
        temperature: 0.1,
      });
      const parsed = (res.json ?? {}) as { value?: number; confidence?: number; explanation?: string };
      return {
        value: typeof parsed.value === "number" ? parsed.value : Number(res.text) || 0,
        confidence: parsed.confidence,
        explanation: parsed.explanation,
      };
    }

    case "GENERATE_JE": {
      const schema = {
        type: "object",
        properties: {
          summary: { type: "string" },
          lines: {
            type: "array",
            items: {
              type: "object",
              properties: {
                account: { type: "string" },
                debit: { type: "number" },
                credit: { type: "number" },
                description: { type: "string" },
              },
              required: ["account"],
            },
          },
        },
        required: ["lines"],
      };
      const res = await callGemini({
        model,
        system:
          "You are Alice, a bookkeeping assistant. From the input row data, generate a balanced double-entry journal entry. Debits must equal credits. Reply as JSON only.",
        messages: [{ role: "user", text: `Generate journal entry for: ${argsText}${ctxText}` }],
        jsonSchema: schema,
        temperature: 0,
      });
      return {
        value: JSON.stringify(res.json ?? res.text),
      };
    }

    case "EXPLAIN":
    case "ANALYZE":
    case "SUMMARIZE":
    case "AI":
    default: {
      const systemMap: Record<string, string> = {
        EXPLAIN:
          "You are Alice. Explain the given financial figure, formula, or statement clearly in 2-4 sentences.",
        ANALYZE:
          "You are Alice, a financial analyst. Analyze the input data. Identify trends, anomalies, and key drivers. Reply concisely.",
        SUMMARIZE:
          "You are Alice. Summarize the input data in one to three sentences.",
        AI: "You are Alice, an AI accounting assistant embedded in a spreadsheet. Reply helpfully and concisely.",
      };
      const res = await callGemini({
        model,
        system: systemMap[formula] ?? systemMap.AI,
        messages: [{ role: "user", text: `${argsText}${ctxText}` }],
        temperature: 0.3,
        maxOutputTokens: 512,
      });
      return { value: res.text };
    }
  }
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
    if (!body?.organization_id || !body?.formula) {
      return json({ error: "organization_id and formula are required" }, 400);
    }

    const { data: isMember } = await supa.rpc("is_org_member", {
      _user_id: userData.user.id,
      _org_id: body.organization_id,
    });
    if (!isMember) return json({ error: "Forbidden" }, 403);

    const args = Array.isArray(body.args) ? body.args : [body.args];
    const argsHash = await hashArgs(body.formula, args);

    // Cache lookup (service role so we can also insert).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cached } = await admin
      .from("ai_formula_cache")
      .select("value, confidence, created_at")
      .eq("organization_id", body.organization_id)
      .eq("formula", body.formula)
      .eq("args_hash", argsHash)
      .maybeSingle();

    if (cached) {
      const ageHours =
        (Date.now() - new Date(cached.created_at).getTime()) / 3_600_000;
      if (ageHours < TTL_HOURS) {
        return json({ ...(cached.value as object), cached: true });
      }
    }

    const result = await runFormula(body.formula, args, body.context);

    await admin.from("ai_formula_cache").upsert({
      organization_id: body.organization_id,
      formula: body.formula,
      args_hash: argsHash,
      value: result as unknown as Record<string, unknown>,
      confidence: result.confidence ?? null,
      created_at: new Date().toISOString(),
    });

    return json({ ...result, cached: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ai-sheets-formula error", msg);
    return json({ error: msg }, 500);
  }
});
