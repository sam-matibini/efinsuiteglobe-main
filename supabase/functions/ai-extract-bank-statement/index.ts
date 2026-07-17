// Phase 2 — AI-powered bank/credit-card statement extraction.
// Accepts a PDF or image (inline base64) and returns a normalized transaction schema.
// Uses Gemini 2.5 Pro vision via _shared/gemini.ts. Caches raw extraction on
// documents.ai_extraction to avoid re-billing. Enforces a per-org daily cap.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { callGemini, corsHeaders } from "../_shared/gemini.ts";
import { GEMINI_MODELS } from "../_shared/geminiModels.ts";

interface Body {
  organization_id: string;
  documentId?: string;
  fileBase64?: string;
  mimeType?: string;
  filename?: string;
}

const DAILY_CAP = 100;
const MAX_INLINE_BYTES = 20 * 1024 * 1024; // 20MB

const SCHEMA = {
  type: "object",
  properties: {
    account: {
      type: "object",
      properties: {
        bank_name: { type: "string" },
        account_number_masked: { type: "string" },
        currency: { type: "string" },
        statement_period_start: { type: "string" },
        statement_period_end: { type: "string" },
      },
    },
    opening_balance: { type: "number" },
    closing_balance: { type: "number" },
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO 8601 YYYY-MM-DD" },
          description: { type: "string" },
          payer_payee: {
            type: "string",
            description:
              "Cleaned counterparty name extracted from the description. For credits/deposits/payments this is the PAYER; for debits/charges this is the PAYEE. Strip reference numbers, POS/terminal codes, city/state, card-last-4 suffixes, and generic prefixes. Leave empty only for rows like INTEREST/BANK FEE/SERVICE CHARGE.",
          },
          amount: { type: "number", description: "Absolute value" },
          type: { type: "string", enum: ["debit", "credit"] },
          balance: { type: "number" },
          reference: { type: "string" },
        },
        required: ["date", "description", "amount", "type"],
      },
    },
    confidence: { type: "number", description: "0 to 1" },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["transactions", "confidence"],
};

const SYSTEM_PROMPT = `You are a bank statement extraction engine.
Read the attached PDF/image of a bank or credit-card statement and return
STRICT JSON matching the provided schema. Rules:
- Dates must be ISO 8601 (YYYY-MM-DD). Infer year from the statement period if missing.
- Amounts are absolute positive numbers; use "type" ("debit" or "credit") to indicate direction.
- Include every transaction row, in chronological order.
- account_number_masked should include only the last 4 digits when the full number is not visible.
- confidence: your honest 0-1 estimate of extraction fidelity.
- payer_payee: for EVERY transaction, extract the cleaned counterparty name from the description. Payer for credits/deposits/payments; payee for debits/charges. Strip reference numbers, POS ids, city/state, terminal codes, card suffixes, and generic prefixes ("POS PURCHASE", "DEBIT MEMO", "PAYMENT -"). Return just the recognizable merchant/person/institution. Leave empty only when no counterparty exists (INTEREST, BANK FEE, SERVICE CHARGE).
- warnings: notes on unclear rows, missing balance, unreconciled totals, etc.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    if (!body?.organization_id) {
      return json({ error: "organization_id is required" }, 400);
    }
    if (!body.documentId && !body.fileBase64) {
      return json({ error: "documentId or fileBase64 is required" }, 400);
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

    // Reuse cached extraction if we have a documentId.
    if (body.documentId) {
      const { data: doc } = await admin
        .from("documents")
        .select("id, ai_extraction, ai_extraction_confidence, ai_extracted_at, file_path, mime_type, file_name")
        .eq("id", body.documentId)
        .maybeSingle();

      if (doc?.ai_extraction) {
        return json({
          extraction: doc.ai_extraction,
          confidence: doc.ai_extraction_confidence,
          extracted_at: doc.ai_extracted_at,
          cached: true,
        });
      }
    }

    // Daily cap check.
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { count } = await admin
      .from("ai_setup_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", body.organization_id)
      .eq("setup_type", "bank_statement_extraction")
      .gte("created_at", since);


    if ((count ?? 0) >= DAILY_CAP) {
      return json({ error: `Daily extraction cap reached (${DAILY_CAP}/day)` }, 429);
    }

    // Resolve file bytes.
    let fileBase64 = body.fileBase64;
    let mimeType = body.mimeType || "application/pdf";
    let sourceDocId = body.documentId ?? null;

    if (!fileBase64 && body.documentId) {
      const { data: doc } = await admin
        .from("documents")
        .select("file_path, mime_type")
        .eq("id", body.documentId)
        .maybeSingle();
      if (!doc?.file_path) return json({ error: "Document not found" }, 404);
      mimeType = doc.mime_type || mimeType;
      const { data: fileData, error: dlErr } = await admin.storage
        .from("documents")
        .download(doc.file_path);
      if (dlErr || !fileData) {
        return json({ error: `Failed to download document: ${dlErr?.message}` }, 500);
      }
      const buf = new Uint8Array(await fileData.arrayBuffer());
      if (buf.byteLength > MAX_INLINE_BYTES) {
        return json({ error: "File exceeds 20MB inline limit" }, 413);
      }
      // base64
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      fileBase64 = btoa(bin);
    }

    if (!fileBase64) return json({ error: "No file bytes to process" }, 400);

    // Call Gemini vision.
    const res = await callGemini({
      model: GEMINI_MODELS.bankOcr,
      system: SYSTEM_PROMPT,
      temperature: 0.1,
      maxOutputTokens: 8192,
      jsonSchema: SCHEMA,
      messages: [
        {
          role: "user",
          text: "Extract every transaction from this statement into the required JSON schema.",
          images: [{ mimeType, data: fileBase64 }],
        },
      ],
    });

    const extraction = (res.json as Record<string, unknown>) ?? {};
    const confidence =
      typeof extraction.confidence === "number" ? extraction.confidence : null;

    // Persist on document if provided.
    if (sourceDocId) {
      await admin
        .from("documents")
        .update({
          ai_extraction: extraction,
          ai_extraction_confidence: confidence,
          ai_extracted_at: new Date().toISOString(),
        })
        .eq("id", sourceDocId);
    }

    // Log for daily cap.
    await admin.from("ai_setup_logs").insert({
      organization_id: body.organization_id,
      setup_type: "bank_statement_extraction",
      detected_value: {
        filename: body.filename ?? null,
        document_id: sourceDocId,
        transaction_count: Array.isArray(extraction.transactions)
          ? extraction.transactions.length
          : 0,
      },
      confidence_score: confidence,
      was_overridden: false,
    });



    return json({
      extraction,
      confidence,
      cached: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("ai-extract-bank-statement error", msg);
    return json({ error: msg }, 500);
  }
});
