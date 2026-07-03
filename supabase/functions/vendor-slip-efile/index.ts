import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return j({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return j({ error: "Unauthorized" }, 401);

    const { organization_id, tax_year, slip_type } = await req.json();
    if (!organization_id || !tax_year || !slip_type) return j({ error: "Missing fields" }, 400);

    const { data: slips } = await supabase
      .from("vendor_tax_slips")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("tax_year", tax_year)
      .eq("slip_type", slip_type)
      .in("status", ["draft", "issued"]);

    if (!slips?.length) return j({ error: "No slips to e-file" }, 400);

    const isCRA = slip_type === "T4A" || slip_type === "T5018";
    const isIRS = slip_type === "1099-NEC" || slip_type === "1099-MISC";

    let envelope = "";
    if (isCRA) {
      // CRA T619 transmitter envelope (simplified)
      envelope = `<?xml version="1.0" encoding="UTF-8"?>\n<T619 xmlns="http://www.cra-arc.gc.ca/xmlns/return">\n  <TransmitterNumber>MM000000</TransmitterNumber>\n  <SummaryType>${slip_type}</SummaryType>\n  <TaxYear>${tax_year}</TaxYear>\n  <SlipCount>${slips.length}</SlipCount>\n  <TotalAmount>${slips.reduce((s: number, x: any) => s + Number(x.total_amount), 0).toFixed(2)}</TotalAmount>\n  <Slips>\n${slips
        .map(
          (s: any) =>
            `    <Slip><VendorId>${s.vendor_id}</VendorId><Total>${Number(s.total_amount).toFixed(2)}</Total><Boxes>${JSON.stringify(s.box_totals)}</Boxes></Slip>`
        )
        .join("\n")}\n  </Slips>\n</T619>`;
    } else if (isIRS) {
      // IRS FIRE-style fixed-width is complex; emit a compact JSON+XML hybrid wrapper
      envelope = `<?xml version="1.0" encoding="UTF-8"?>\n<IRS-FIRE>\n  <FormType>${slip_type}</FormType>\n  <TaxYear>${tax_year}</TaxYear>\n  <PayerOrgId>${organization_id}</PayerOrgId>\n  <Recipients>\n${slips
        .map(
          (s: any) =>
            `    <Recipient><Tin>masked</Tin><PaymentAmount>${Number(s.total_amount).toFixed(2)}</PaymentAmount><Boxes>${JSON.stringify(s.box_totals)}</Boxes></Recipient>`
        )
        .join("\n")}\n  </Recipients>\n</IRS-FIRE>`;
    }

    const bucket = isCRA ? "cra-filings" : "irs-filings";
    const path = `${organization_id}/${slip_type}-${tax_year}-${Date.now()}.xml`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, new Blob([envelope], { type: "application/xml" }), { upsert: true });
    if (upErr) return j({ error: upErr.message }, 500);

    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);

    // Mark slips issued
    await supabase
      .from("vendor_tax_slips")
      .update({ status: "issued", issued_at: new Date().toISOString(), xml_url: signed?.signedUrl })
      .in(
        "id",
        slips.map((s: any) => s.id)
      );

    // Track filing record
    if (isIRS) {
      await supabase.from("irs_filings").insert({
        organization_id,
        filing_type: slip_type,
        tax_year,
        status: "generated",
        xml_url: signed?.signedUrl,
        payload: { slip_count: slips.length },
      });
    } else {
      await supabase.from("cra_filings").insert({
        organization_id,
        filing_type: slip_type,
        tax_year,
        status: "generated",
        xml_url: signed?.signedUrl,
        payload: { slip_count: slips.length },
      });
    }

    return j({ ok: true, path, url: signed?.signedUrl, count: slips.length });
  } catch (e: any) {
    console.error("vendor-slip-efile", e);
    return j({ error: e?.message ?? "Unknown error" }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
