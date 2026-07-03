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

    const reqBody = await req.json();
    const { organization_id, period_key, vrn, vat_due_sales, vat_due_acquisitions, total_vat_due, vat_reclaimed_curr_period, net_vat_due, total_value_sales_ex_vat, total_value_purchases_ex_vat, total_value_goods_supplied_ex_vat, total_acquisitions_ex_vat, finalised } = reqBody;
    if (!organization_id || !period_key) return j({ error: "Missing organization_id or period_key" }, 400);

    const payload = {
      periodKey: period_key,
      vatDueSales: Number(vat_due_sales ?? 0),
      vatDueAcquisitions: Number(vat_due_acquisitions ?? 0),
      totalVatDue: Number(total_vat_due ?? 0),
      vatReclaimedCurrPeriod: Number(vat_reclaimed_curr_period ?? 0),
      netVatDue: Number(net_vat_due ?? 0),
      totalValueSalesExVAT: Number(total_value_sales_ex_vat ?? 0),
      totalValuePurchasesExVAT: Number(total_value_purchases_ex_vat ?? 0),
      totalValueGoodsSuppliedExVAT: Number(total_value_goods_supplied_ex_vat ?? 0),
      totalAcquisitionsExVAT: Number(total_acquisitions_ex_vat ?? 0),
      finalised: !!finalised,
    };

    const clientId = Deno.env.get("HMRC_CLIENT_ID");
    const clientSecret = Deno.env.get("HMRC_CLIENT_SECRET");
    const accessToken = Deno.env.get("HMRC_ACCESS_TOKEN");
    const live = !!(clientId && clientSecret && accessToken);

    let status = "simulated";
    let providerRef: string | null = null;
    let ack: Record<string, unknown> = { mode: "simulated", reason: "HMRC_* secrets not configured" };

    if (live) {
      try {
        const vrnStr = String(vrn ?? "");
        const resp = await fetch(`https://api.service.hmrc.gov.uk/organisations/vat/${vrnStr}/returns`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Accept": "application/vnd.hmrc.1.0+json",
          },
          body: JSON.stringify(payload),
        });
        const body = await resp.json().catch(() => ({}));
        providerRef = body?.formBundleNumber ?? body?.processingDate ?? null;
        status = resp.ok ? "submitted" : "failed";
        ack = { mode: "live", http_status: resp.status, body };
      } catch (e) {
        status = "failed";
        ack = { mode: "live", error: e instanceof Error ? e.message : "hmrc failed" };
      }
    }

    const { data: row, error } = await supabase
      .from("intl_filing_submissions")
      .insert({
        organization_id,
        jurisdiction: "UK",
        filing_type: "mtd_vat",
        period_key,
        payload,
        status,
        provider_reference: providerRef,
        ack,
        submitted_at: new Date().toISOString(),
        created_by: ud.user.id,
      })
      .select()
      .single();
    if (error) return j({ error: error.message }, 500);

    return j({ ok: true, id: row.id, status, provider_reference: providerRef, live });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("hmrc-mtd-vat-submit", msg);
    return j({ error: msg }, 500);
  }
});
