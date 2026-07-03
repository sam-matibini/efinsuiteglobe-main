import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { organization_id, severity = "info", category, title, body, payload } = await req.json();
    if (!organization_id || !category || !title) return j({ error: "Missing fields" }, 400);

    const { data: alert, error } = await supabase
      .from("treasury_alerts")
      .insert({ organization_id, severity, category, title, body, payload: payload ?? {} })
      .select()
      .single();
    if (error) return j({ error: error.message }, 500);

    // Slack fanout for high/critical
    const slackUrl = Deno.env.get("SLACK_TREASURY_WEBHOOK_URL");
    if (slackUrl && (severity === "high" || severity === "critical")) {
      try {
        await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `[${severity.toUpperCase()}] ${title}\n${body ?? ""}` }),
        });
      } catch (e) {
        console.warn("slack dispatch failed", e);
      }
    }

    return j({ ok: true, alert_id: alert.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return j({ error: msg }, 500);
  }
});
