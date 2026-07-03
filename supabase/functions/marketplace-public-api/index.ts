import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = req.headers.get("x-api-key") ?? req.headers.get("X-API-Key");
    if (!apiKey || !apiKey.includes(".")) return j({ error: "Missing or malformed API key" }, 401);
    const [prefix, secret] = apiKey.split(".");
    const hash = await sha256(secret);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: keyRow } = await supabase
      .from("integration_api_keys")
      .select("id, organization_id, installation_id, key_hash, revoked_at")
      .eq("key_prefix", prefix).maybeSingle();
    if (!keyRow || keyRow.revoked_at || keyRow.key_hash !== hash) return j({ error: "Invalid API key" }, 401);

    await supabase.from("integration_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

    const url = new URL(req.url);
    const path = url.pathname.replace(/^.*marketplace-public-api/, "").replace(/^\//, "");
    const org = keyRow.organization_id;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    let result: unknown = null;
    if (path === "" || path === "ping") {
      result = { ok: true, organization_id: org, ts: new Date().toISOString() };
    } else if (path === "alerts") {
      const { data } = await supabase.from("treasury_alerts").select("*").eq("organization_id", org).order("created_at", { ascending: false }).limit(limit);
      result = data ?? [];
    } else if (path === "filings") {
      const { data } = await supabase.from("intl_filing_submissions").select("*").eq("organization_id", org).order("created_at", { ascending: false }).limit(limit);
      result = data ?? [];
    } else if (path === "consolidation/latest") {
      const { data } = await supabase.from("consolidation_runs").select("*").eq("organization_id", org).order("created_at", { ascending: false }).limit(1).maybeSingle();
      result = data ?? null;
    } else {
      return j({ error: "Unknown endpoint", path }, 404);
    }

    await supabase.from("integration_event_log").insert({
      organization_id: org, installation_id: keyRow.installation_id,
      direction: "inbound", event_type: `api.${path || "ping"}`,
      status: "ok", http_status: 200, payload: { path }, response: {},
    });

    return j({ ok: true, data: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("marketplace-public-api", msg);
    return j({ error: msg }, 500);
  }
});
