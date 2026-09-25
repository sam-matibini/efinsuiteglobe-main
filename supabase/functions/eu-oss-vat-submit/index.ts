import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function buildOssXml(p: { period_key: string; vat_id: string; lines: { country: string; rate: number; net: number; vat: number }[] }): string {
  const items = p.lines.map((l) =>
    `<MsConsumption code="${l.country}"><VatRate>${l.rate.toFixed(2)}</VatRate><TaxableAmount>${l.net.toFixed(2)}</TaxableAmount><VatAmount>${l.vat.toFixed(2)}</VatAmount></MsConsumption>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<OssVatReturn>
  <Period>${p.period_key}</Period>
  <VatIdentificationNumber>${p.vat_id}</VatIdentificationNumber>
  <Supplies>${items}</Supplies>
</OssVatReturn>`;
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

    const body = await req.json();
    const { organization_id, period_key, vat_id, lines } = body;
    if (!organization_id || !period_key || !vat_id) return j({ error: "Missing fields" }, 400);

    const xml = buildOssXml({ period_key, vat_id, lines: lines ?? [] });
    const apiUrl = Deno.env.get("EU_OSS_ENDPOINT");
    const apiKey = Deno.env.get("EU_OSS_API_KEY");
    const live = !!(apiUrl && apiKey);

    let status = "simulated";
    let providerRef: string | null = null;
    let ack: Record<string, unknown> = { mode: "simulated", reason: "EU_OSS_* secrets not configured", xml_preview: xml.slice(0, 400) };

    if (live) {
      try {
        const resp = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/xml", "Authorization": `Bearer ${apiKey}` },
          body: xml,
        });
        const text = (await resp.text()).slice(0, 4000);
        providerRef = text.match(/<ReferenceNumber>([^<]+)<\/ReferenceNumber>/)?.[1] ?? null;
        status = resp.ok ? "submitted" : "failed";
        ack = { mode: "live", http_status: resp.status, response: text };
      } catch (e) {
        status = "failed";
        ack = { mode: "live", error: e instanceof Error ? e.message : "oss failed" };
      }
    }

    const { data: row, error } = await supabase
      .from("intl_filing_submissions")
      .insert({
        organization_id, jurisdiction: "EU", filing_type: "oss_vat",
        period_key, payload: { vat_id, lines: lines ?? [] },
        status, provider_reference: providerRef, ack,
        submitted_at: new Date().toISOString(), created_by: ud.user.id,
      }).select().single();
    if (error) return j({ error: error.message }, 500);

    return j({ ok: true, id: row.id, status, provider_reference: providerRef, live });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("eu-oss-vat-submit", msg);
    return j({ error: msg }, 500);
  }
});
