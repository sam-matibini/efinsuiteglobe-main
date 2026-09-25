// Health check for the Google Gemini integration.
// POST -> { ok, model, latencyMs, sample }
import { callGemini, corsHeaders } from "../_shared/gemini.ts";
import { GEMINI_MODELS } from "../_shared/geminiModels.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const model = GEMINI_MODELS.financialReports; // cheapest for a ping
  const started = Date.now();
  try {
    const res = await callGemini({
      model,
      messages: [
        { role: "user", text: "Reply with the single word: OK" },
      ],
      maxOutputTokens: 8,
      temperature: 0,
    });
    return new Response(
      JSON.stringify({
        ok: true,
        model,
        latencyMs: Date.now() - started,
        sample: res.text,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, model, latencyMs: Date.now() - started, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
