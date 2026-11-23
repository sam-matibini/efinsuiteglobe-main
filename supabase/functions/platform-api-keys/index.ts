import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: allowed, error: accessError } = await userClient.rpc("can_manage_platform_apis");
    if (accessError || allowed !== true) {
      return new Response(JSON.stringify({ ok: false, error: "Admin access required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json();
    const secretName = String(body.secretName ?? "");
    const provided = String(body.secretValue ?? "").trim();
    const admin = createClient(url, serviceKey);
    const stored = provided
      ? ""
      : String((await admin.from("platform_api_keys").select("secret_value").eq("secret_name", secretName).maybeSingle()).data?.secret_value ?? "");
    const key = provided || stored;
    if (secretName !== "ELEVENLABS_API_KEY") {
      return new Response(JSON.stringify({ ok: true, message: "Saved. This API does not have an automatic connection test." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!key) {
      return new Response(JSON.stringify({ ok: false, error: "Enter the ElevenLabs API key first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const check = await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": key } });
    const message = check.ok ? "ElevenLabs accepted this API key." : "ElevenLabs rejected this API key.";
    return new Response(JSON.stringify({ ok: check.ok, message, error: check.ok ? undefined : message }), {
      status: check.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Could not test the API key." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
