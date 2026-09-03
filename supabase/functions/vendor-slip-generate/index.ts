import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  organization_id: string;
  tax_year: number;
  slip_type?: "T4A" | "T5018" | "1099-NEC" | "1099-MISC" | "T5";
  vendor_ids?: string[];
}

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

    const body = (await req.json()) as Body;
    if (!body.organization_id || !body.tax_year) return j({ error: "Missing fields" }, 400);

    // Aggregate posted AP payments for the year by vendor
    const yearStart = `${body.tax_year}-01-01`;
    const yearEnd = `${body.tax_year}-12-31`;

    let vendorQuery = supabase
      .from("vendor_tax_profiles")
      .select("*")
      .eq("organization_id", body.organization_id);
    if (body.vendor_ids?.length) vendorQuery = vendorQuery.in("vendor_id", body.vendor_ids);
    const { data: profiles } = await vendorQuery;

    const generated: any[] = [];
    for (const profile of profiles ?? []) {
      // Pull posted AP payments for this vendor in the year (best-effort across schemas)
      const { data: payments } = await supabase
        .from("ap_payments")
        .select("id, payment_date, amount, bill_id, status")
        .eq("organization_id", body.organization_id)
        .eq("vendor_id", profile.vendor_id)
        .gte("payment_date", yearStart)
        .lte("payment_date", yearEnd)
        .in("status", ["posted", "reversed"]);

      const total = (payments ?? []).reduce((sum: number, p: any) => {
        const sign = p.status === "reversed" ? -1 : 1;
        return sum + sign * Number(p.amount ?? 0);
      }, 0);

      // Determine slip type — explicit body.slip_type wins over profile override.
      let slipType = body.slip_type ?? profile.slip_type_override;
      if (!slipType) {
        if (profile.country === "US") slipType = total >= 600 ? "1099-NEC" : null;
        else slipType = total > 500 ? "T4A" : null;
      }
      if (!slipType) continue;

      const threshold =
        slipType === "T4A" ? 500 : slipType === "T5018" ? 500 : slipType === "T5" ? 50 : 600;
      if (total < threshold) continue;

      // T5: box mapping differs — interest/dividend income uses T5 box codes.
      const boxCode =
        slipType === "T4A" ? "048"
        : slipType === "T5018" ? "022"
        : slipType === "T5" ? "13" // default T5 interest box
        : "1";
      const boxTotals: Record<string, number> = { [boxCode]: Number(total.toFixed(2)) };

      // Upsert slip row
      const { data: slip, error: slipErr } = await supabase
        .from("vendor_tax_slips")
        .upsert(
          {
            organization_id: body.organization_id,
            vendor_id: profile.vendor_id,
            tax_year: body.tax_year,
            slip_type: slipType,
            status: "draft",
            total_amount: Number(total.toFixed(2)),
            box_totals: boxTotals,
            currency: profile.country === "US" ? "USD" : "CAD",
          },
          { onConflict: "organization_id,vendor_id,tax_year,slip_type" }
        )
        .select()
        .single();
      if (slipErr || !slip) continue;

      // Replace lines
      await supabase.from("vendor_tax_slip_lines").delete().eq("slip_id", slip.id);
      const lines = (payments ?? []).map((p: any) => ({
        slip_id: slip.id,
        organization_id: body.organization_id,
        payment_id: p.id,
        bill_id: p.bill_id,
        payment_date: p.payment_date,
        box_code: boxCode,
        amount: p.status === "reversed" ? -Number(p.amount) : Number(p.amount),
      }));
      if (lines.length) await supabase.from("vendor_tax_slip_lines").insert(lines);

      generated.push({ vendor_id: profile.vendor_id, slip_id: slip.id, slip_type: slipType, total });
    }

    return j({ ok: true, generated, count: generated.length });
  } catch (e: any) {
    console.error("vendor-slip-generate", e);
    return j({ error: e?.message ?? "Unknown error" }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
