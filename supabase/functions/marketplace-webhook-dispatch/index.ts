import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: events } = await supabase
      .from("marketplace_event_queue")
      .select("*").eq("status", "pending").order("created_at").limit(100);

    if (!events?.length) return j({ ok: true, dispatched: 0 });

    let dispatched = 0; let failed = 0;
    for (const evt of events as Array<Record<string, unknown>>) {
      const { data: installs } = await supabase
        .from("org_integration_installations")
        .select("id, webhook_url, webhook_secret, status, integration_id, marketplace_integrations(slug, scopes)")
        .eq("organization_id", evt.organization_id as string)
        .eq("status", "active");

      const targets = (installs ?? []).filter((i: Record<string, unknown>) => {
        const scopes = (i as { marketplace_integrations?: { scopes?: string[] } }).marketplace_integrations?.scopes ?? [];
        return !!i.webhook_url && scopes.includes(evt.event_type as string);
      });

      let allOk = true; const responses: unknown[] = [];
      for (const t of targets) {
        const body = JSON.stringify({ event: evt.event_type, organization_id: evt.organization_id, payload: evt.payload, created_at: evt.created_at });
        const sig = t.webhook_secret ? await hmacSha256(t.webhook_secret as string, body) : "";
        try {
          const resp = await fetch(t.webhook_url as string, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Efinsuite-Event": String(evt.event_type), "X-Efinsuite-Signature": sig },
            body,
          });
          await supabase.from("integration_event_log").insert({
            organization_id: evt.organization_id, installation_id: t.id,
            direction: "outbound", event_type: String(evt.event_type),
            status: resp.ok ? "ok" : "error", http_status: resp.status,
            payload: { event_id: evt.id }, response: { ok: resp.ok },
          });
          if (!resp.ok) allOk = false;
          responses.push({ id: t.id, status: resp.status });
        } catch (e) {
          allOk = false;
          await supabase.from("integration_event_log").insert({
            organization_id: evt.organization_id, installation_id: t.id,
            direction: "outbound", event_type: String(evt.event_type),
            status: "error", payload: { event_id: evt.id },
            response: { error: e instanceof Error ? e.message : "fetch failed" },
          });
        }
      }

      await supabase.from("marketplace_event_queue").update({
        status: allOk ? "dispatched" : "failed",
        attempts: ((evt.attempts as number) ?? 0) + 1,
        dispatched_at: new Date().toISOString(),
        last_error: allOk ? null : "one or more targets failed",
      }).eq("id", evt.id as string);

      if (allOk) dispatched++; else failed++;
    }

    return j({ ok: true, dispatched, failed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("marketplace-webhook-dispatch", msg);
    return j({ error: msg }, 500);
  }
});
