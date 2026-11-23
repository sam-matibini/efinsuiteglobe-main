import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleReceptionVoice } from "../../../src/lib/receptionist/api.ts";
import { emptyReceptionOrg } from "../../../src/lib/receptionist/engine.ts";
import type { ReceptionOrg } from "../../../src/lib/receptionist/types.ts";
import { resolvePlatformSecret } from "../_shared/platformApiKey.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = String(body.action ?? "");
    const organizationId = String(body.organizationId ?? "");
    if (!organizationId || (action !== "sync" && action !== "session")) {
      return new Response(JSON.stringify({ ok: false, error: "organizationId and a voice action are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const existing = await supabase.from("ai_receptionist_state").select("state").eq("organization_id", organizationId).maybeSingle();
    const org = { ...emptyReceptionOrg(organizationId), ...(existing.data?.state ?? {}), organizationId } as ReceptionOrg;
    const toolBaseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-receptionist?organizationId=${organizationId}`;
    const voice = await handleReceptionVoice(action, org, {
      apiKey: await resolvePlatformSecret("ELEVENLABS_API_KEY"),
      toolBaseUrl,
    });
    if (voice.org !== org) {
      await supabase.from("ai_receptionist_state").upsert({
        organization_id: organizationId,
        state: voice.org,
        updated_at: new Date().toISOString(),
      });
    }
    return new Response(JSON.stringify(voice.body), {
      status: voice.body.ok === false ? 400 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Receptionist voice failed." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
