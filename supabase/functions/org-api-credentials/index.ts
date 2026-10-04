import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hint(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!supabaseUrl || !anonKey || !serviceKey || !authHeader.startsWith("Bearer ")) {
      return json({ ok: false, error: "Sign in before saving an API key." }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ ok: false, error: "Sign in before saving an API key." }, 401);
    }

    const body = await req.json();
    const organizationId = String(body.organizationId ?? "");
    const action = String(body.action ?? "");
    const apiKey = String(body.apiKey ?? "").trim();
    const provider = body.provider === "custom" ? "custom" : "elevenlabs";
    const name = String(body.name ?? (provider === "elevenlabs" ? "ElevenLabs" : "Custom API"));
    const secretName = String(body.secretName ?? (provider === "elevenlabs" ? "ELEVENLABS_API_KEY" : "CUSTOM_API_KEY"));

    if (!organizationId) return json({ ok: false, error: "Choose an organization first." }, 400);

    const { data: member } = await userClient
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!member || !["owner", "admin"].includes(String(member.role))) {
      return json({ ok: false, error: "Only an organization owner or admin can save API keys." }, 403);
    }

    if (action === "test") {
      if (!apiKey) return json({ ok: false, error: "Paste an API key first." }, 400);
      if (provider !== "elevenlabs") return json({ ok: true, status: "saved" });
      const probe = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": apiKey },
      });
      if (!probe.ok) {
        return json({ ok: false, error: "ElevenLabs rejected this API key." }, 400);
      }
      return json({ ok: true, status: "tested" });
    }

    if (action !== "save") return json({ ok: false, error: "Unknown API credential action." }, 400);
    if (!apiKey) return json({ ok: false, error: "Paste an API key first." }, 400);

    let status = "saved";
    let lastError: string | null = null;
    if (provider === "elevenlabs") {
      const probe = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": apiKey },
      });
      if (probe.ok) status = "tested";
      else lastError = "ElevenLabs rejected this API key.";
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { error } = await admin.from("organization_api_credentials").upsert(
      {
        organization_id: organizationId,
        provider,
        name,
        secret_name: secretName,
        api_key: apiKey,
        key_hint: hint(apiKey),
        status,
        last_error: lastError,
        last_tested_at: status === "tested" ? new Date().toISOString() : null,
      },
      { onConflict: "organization_id,secret_name" },
    );
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, status, keyHint: hint(apiKey), error: lastError });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the API key.";
    return json({ ok: false, error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
