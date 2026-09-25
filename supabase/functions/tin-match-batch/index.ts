import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// IRS TIN-Match SOAP envelope (interactive endpoint). For batch e-Services use the
// upload portal; we model the interactive verify call which IRS exposes for partners.
function buildTinSoap(user: string, pass: string, clientId: string, tin: string, name: string, tinType: "1" | "2") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:tin="https://la.www4.irs.gov/e-services/tinmatch">
  <soap:Header>
    <tin:Credentials>
      <tin:Username>${user}</tin:Username>
      <tin:Password>${pass}</tin:Password>
      <tin:ClientID>${clientId}</tin:ClientID>
    </tin:Credentials>
  </soap:Header>
  <soap:Body>
    <tin:MatchRequest>
      <tin:TIN>${tin}</tin:TIN>
      <tin:TINType>${tinType}</tin:TINType>
      <tin:NameLine1>${name.slice(0, 40)}</tin:NameLine1>
    </tin:MatchRequest>
  </soap:Body>
</soap:Envelope>`;
}

function parseTinResponse(xml: string): { code: string; status: "matched" | "mismatch" | "error"; notes: string } {
  const m = xml.match(/<tin:MatchCode>([^<]+)<\/tin:MatchCode>/);
  const code = m?.[1]?.trim() ?? "9";
  if (code === "0") return { code, status: "matched", notes: "IRS match" };
  if (code === "1" || code === "2" || code === "3") return { code, status: "mismatch", notes: `IRS mismatch code ${code}` };
  return { code, status: "error", notes: `IRS error code ${code}` };
}

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

    const { organization_id, profile_ids } = await req.json();
    if (!organization_id) return j({ error: "Missing organization_id" }, 400);

    let q = supabase.from("vendor_tax_profiles").select("*").eq("organization_id", organization_id);
    if (profile_ids?.length) q = q.in("id", profile_ids);
    const { data: profiles } = await q;
    type Profile = { id: string; country: string; tin?: string; ein?: string; legal_name?: string; vendor_name?: string };
    const eligible = ((profiles ?? []) as Profile[]).filter((p) => p.country === "US" && (p.tin || p.ein));
    if (eligible.length === 0) return j({ error: "No eligible US vendors with TIN/EIN" }, 400);

    const irsUser = Deno.env.get("IRS_TIN_MATCH_USERNAME");
    const irsPass = Deno.env.get("IRS_TIN_MATCH_PASSWORD");
    const irsClient = Deno.env.get("IRS_TIN_MATCH_CLIENT_ID");
    const live = !!(irsUser && irsPass && irsClient);

    const batchRef = `TINB-${Date.now()}`;
    const { data: batch, error: bErr } = await supabase
      .from("tin_match_batches")
      .insert({
        organization_id,
        batch_reference: batchRef,
        status: "submitted",
        vendor_count: eligible.length,
        submitted_at: new Date().toISOString(),
        created_by: ud.user.id,
      })
      .select()
      .single();
    if (bErr || !batch) return j({ error: bErr?.message ?? "batch insert failed" }, 500);

    let matched = 0;
    let mismatched = 0;
    const rows: unknown[] = [];

    for (const p of eligible) {
      const tin = (p.tin || p.ein || "").replace(/\D/g, "");
      const name = p.legal_name || p.vendor_name || "VENDOR";
      const tinType: "1" | "2" = p.ein ? "1" : "2";

      let status: "matched" | "mismatch" | "error" = "error";
      let code = "9";
      let notes = "";
      let raw: string | null = null;

      if (live && tin.length === 9) {
        try {
          const soap = buildTinSoap(irsUser!, irsPass!, irsClient!, tin, name, tinType);
          const resp = await fetch("https://la.www4.irs.gov/e-services/tinmatch/Match", {
            method: "POST",
            headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
            body: soap,
          });
          raw = (await resp.text()).slice(0, 4000);
          const parsed = parseTinResponse(raw);
          status = parsed.status; code = parsed.code; notes = parsed.notes;
        } catch (e) {
          notes = `IRS request failed: ${e instanceof Error ? e.message : "unknown"}`;
        }
      } else {
        const ok = tin.length === 9 && tin !== "000000000";
        status = ok ? "matched" : "mismatch";
        code = ok ? "0" : "1";
        notes = ok ? "Simulated match (no IRS credentials)" : "Invalid TIN format";
      }

      if (status === "matched") matched++; else if (status === "mismatch") mismatched++;
      const persistedStatus = status === "error" ? "invalid" : status;
      rows.push({
        batch_id: batch.id,
        organization_id,
        vendor_profile_id: p.id,
        tin_last4: tin.slice(-4) || null,
        match_status: persistedStatus,
        match_code: code,
        notes: raw ? `${notes} | raw: ${raw.slice(0, 500)}` : notes,
      });
    }

    await supabase.from("tin_match_batch_results").insert(rows);
    await supabase
      .from("tin_match_batches")
      .update({ status: "completed", matched_count: matched, mismatched_count: mismatched, completed_at: new Date().toISOString() })
      .eq("id", batch.id);

    return j({ ok: true, batch_id: batch.id, batch_reference: batchRef, matched, mismatched, total: eligible.length, live });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("tin-match-batch", msg);
    return j({ error: msg }, 500);
  }
});
