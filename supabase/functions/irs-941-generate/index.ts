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

    const { organization_id, tax_year, quarter } = await req.json();
    if (!organization_id || !tax_year || !quarter) return j({ error: "Missing fields" }, 400);

    // Aggregate payroll wages for the quarter (best-effort across schemas)
    const monthStart = (quarter - 1) * 3 + 1;
    const start = `${tax_year}-${String(monthStart).padStart(2, "0")}-01`;
    const endMonth = monthStart + 2;
    const lastDay = new Date(tax_year, endMonth, 0).getDate();
    const end = `${tax_year}-${String(endMonth).padStart(2, "0")}-${lastDay}`;

    const { data: runs } = await supabase
      .from("pay_runs")
      .select("id, total_gross, total_taxes, period_end")
      .eq("organization_id", organization_id)
      .gte("period_end", start)
      .lte("period_end", end);

    const totals = (runs ?? []).reduce(
      (acc: any, r: any) => ({
        gross: acc.gross + Number(r.total_gross ?? 0),
        tax: acc.tax + Number(r.total_taxes ?? 0),
      }),
      { gross: 0, tax: 0 }
    );

    // Rates
    const { data: rates } = await supabase
      .from("us_payroll_tax_rates")
      .select("*")
      .eq("tax_year", tax_year)
      .eq("jurisdiction", "Federal");

    const ssRate = rates?.find((r: any) => r.tax_type === "FICA_SS")?.employer_rate ?? 0.062;
    const medRate = rates?.find((r: any) => r.tax_type === "FICA_MEDICARE")?.employer_rate ?? 0.0145;
    const ss = totals.gross * Number(ssRate) * 2;
    const medicare = totals.gross * Number(medRate) * 2;
    const total941 = totals.tax + ss + medicare;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Form941 xmlns="http://www.irs.gov/efile">
  <Header><TaxYear>${tax_year}</TaxYear><Quarter>${quarter}</Quarter><EmployerOrgId>${organization_id}</EmployerOrgId></Header>
  <Line2_Wages>${totals.gross.toFixed(2)}</Line2_Wages>
  <Line3_FederalIncomeTaxWithheld>${totals.tax.toFixed(2)}</Line3_FederalIncomeTaxWithheld>
  <Line5a_TaxableSocialSecurityWages>${totals.gross.toFixed(2)}</Line5a_TaxableSocialSecurityWages>
  <Line5a_SocialSecurityTax>${ss.toFixed(2)}</Line5a_SocialSecurityTax>
  <Line5c_TaxableMedicareWages>${totals.gross.toFixed(2)}</Line5c_TaxableMedicareWages>
  <Line5c_MedicareTax>${medicare.toFixed(2)}</Line5c_MedicareTax>
  <Line12_TotalTaxes>${total941.toFixed(2)}</Line12_TotalTaxes>
</Form941>`;

    const path = `${organization_id}/941-${tax_year}-Q${quarter}-${Date.now()}.xml`;
    const { error: upErr } = await supabase.storage
      .from("irs-filings")
      .upload(path, new Blob([xml], { type: "application/xml" }), { upsert: true });
    if (upErr) return j({ error: upErr.message }, 500);
    const { data: signed } = await supabase.storage.from("irs-filings").createSignedUrl(path, 60 * 60 * 24 * 7);

    const { data: filing } = await supabase
      .from("irs_filings")
      .insert({
        organization_id,
        filing_type: "941",
        tax_year,
        period: `Q${quarter}`,
        status: "generated",
        xml_url: signed?.signedUrl,
        payload: { gross: totals.gross, ss, medicare, total941 },
      })
      .select()
      .single();

    return j({ ok: true, filing, url: signed?.signedUrl });
  } catch (e: any) {
    console.error("irs-941-generate", e);
    return j({ error: e?.message ?? "Unknown error" }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
