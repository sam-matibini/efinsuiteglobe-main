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
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: ud } = await supabase.auth.getUser();
    if (!ud?.user) return j({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action, request_id, organization_id } = body;
    if (!action || !organization_id) return j({ error: "Missing fields" }, 400);

    if (action === "initiate") {
      const { filing_type, filing_reference, period_end, signer_name, signer_email, signer_title, filing_payload } = body;
      const { data, error } = await supabase
        .from("signed_filing_requests")
        .insert({
          organization_id,
          filing_type,
          filing_reference,
          period_end,
          signer_name,
          signer_email,
          signer_title,
          filing_payload,
          status: "pending",
          created_by: ud.user.id,
        })
        .select()
        .single();
      if (error) return j({ error: error.message }, 500);
      return j({ ok: true, request: data });
    }

    if (action === "sign") {
      const { signature_data, signer_name } = body;
      const { data: reqRow } = await supabase
        .from("signed_filing_requests").select("*").eq("id", request_id).eq("organization_id", organization_id).maybeSingle();
      if (!reqRow) return j({ error: "Request not found" }, 404);
      if (reqRow.status !== "pending") return j({ error: `Cannot sign in status ${reqRow.status}` }, 400);

      const ip = req.headers.get("x-forwarded-for") ?? "";
      const ua = req.headers.get("user-agent") ?? "";
      await supabase.from("signed_filing_signatures").insert({
        request_id,
        organization_id,
        signer_name: signer_name ?? reqRow.signer_name,
        signature_data,
        ip_address: ip,
        user_agent: ua,
      });
      await supabase
        .from("signed_filing_requests")
        .update({ status: "signed" })
        .eq("id", request_id);
      return j({ ok: true, status: "signed" });
    }

    if (action === "file") {
      const { data: reqRow } = await supabase
        .from("signed_filing_requests").select("*").eq("id", request_id).eq("organization_id", organization_id).maybeSingle();
      if (!reqRow) return j({ error: "Request not found" }, 404);
      if (reqRow.status !== "signed") return j({ error: "Request must be signed before filing" }, 400);
      const ref = `FILED-${Date.now()}`;
      await supabase
        .from("signed_filing_requests")
        .update({ status: "filed", filed_at: new Date().toISOString(), filed_reference: ref })
        .eq("id", request_id);
      return j({ ok: true, status: "filed", filed_reference: ref });
    }

    if (action === "cancel") {
      await supabase
        .from("signed_filing_requests")
        .update({ status: "cancelled" })
        .eq("id", request_id)
        .eq("organization_id", organization_id);
      return j({ ok: true, status: "cancelled" });
    }

    return j({ error: "Unknown action" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("signed-filing-workflow", msg);
    return j({ error: msg }, 500);
  }
});
