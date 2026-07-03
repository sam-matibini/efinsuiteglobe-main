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
  const started = Date.now();
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Failed jobs in last 24h
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: failed } = await supabase
      .from("treasury_job_runs")
      .select("organization_id, job_name")
      .eq("status", "failed")
      .gte("started_at", since);

    const alerts: Array<{ organization_id: string; severity: string; category: string; title: string; body: string }> = [];
    const seen = new Set<string>();
    for (const r of failed ?? []) {
      const key = `${r.organization_id}:${r.job_name}`;
      if (seen.has(key) || !r.organization_id) continue;
      seen.add(key);
      alerts.push({
        organization_id: r.organization_id,
        severity: "high",
        category: "job_failure",
        title: `Scheduled job failed: ${r.job_name}`,
        body: "One or more runs failed in the last 24 hours. Check the Jobs Log.",
      });
    }

    // Insert alerts
    if (alerts.length > 0) {
      await supabase.from("treasury_alerts").insert(alerts);
    }

    const duration = Date.now() - started;
    await supabase.from("treasury_job_runs").insert({
      job_name: "treasury-health-monitor",
      status: "completed",
      finished_at: new Date().toISOString(),
      duration_ms: duration,
      payload: { alerts_emitted: alerts.length },
    });

    return j({ ok: true, alerts_emitted: alerts.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return j({ error: msg }, 500);
  }
});
