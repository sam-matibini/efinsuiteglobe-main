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

    const { organization_id } = await req.json();
    if (!organization_id) return j({ error: "Missing organization_id" }, 400);

    const { data: jurisdictions } = await supabase
      .from("sales_tax_jurisdictions")
      .select("*")
      .eq("organization_id", organization_id);

    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
    const alerts: any[] = [];
    for (const jx of jurisdictions ?? []) {
      // Sum invoice revenue / count to this state
      const { data: invs } = await supabase
        .from("invoices")
        .select("id, total, status, invoice_date, ship_state")
        .eq("organization_id", organization_id)
        .eq("ship_state", jx.state_code)
        .gte("invoice_date", yearStart);

      const revenue = (invs ?? [])
        .filter((i: any) => ["sent", "paid", "partial"].includes(i.status))
        .reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);
      const txCount = (invs ?? []).length;

      let nexus: string = "monitoring";
      if (revenue >= Number(jx.economic_nexus_revenue) || txCount >= jx.economic_nexus_transactions) {
        nexus = jx.registered ? "active" : "triggered";
        if (!jx.registered) alerts.push({ state: jx.state_code, revenue, transactions: txCount });
      }

      await supabase
        .from("sales_tax_jurisdictions")
        .update({
          ytd_revenue: revenue,
          ytd_transactions: txCount,
          nexus_status: nexus,
          last_checked_at: new Date().toISOString(),
        })
        .eq("id", jx.id);
    }

    return j({ ok: true, alerts, scanned: (jurisdictions ?? []).length });
  } catch (e: any) {
    console.error("sales-tax-nexus-check", e);
    return j({ error: e?.message ?? "Unknown error" }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
