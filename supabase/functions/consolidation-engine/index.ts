import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Account-type classifier (matches existing CoA conventions)
function classify(type: string | null): "asset" | "liability" | "equity" | "revenue" | "expense" | null {
  const t = (type ?? "").toLowerCase();
  if (t.includes("asset")) return "asset";
  if (t.includes("liab")) return "liability";
  if (t.includes("equity")) return "equity";
  if (t.includes("rev") || t.includes("income")) return "revenue";
  if (t.includes("exp") || t.includes("cogs")) return "expense";
  return null;
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

    const { group_id, period_start, period_end, base_currency } = await req.json();
    if (!group_id || !period_start || !period_end) return j({ error: "Missing fields" }, 400);

    const { data: group } = await supabase
      .from("consolidation_groups").select("*").eq("id", group_id).maybeSingle();
    if (!group) return j({ error: "Group not found" }, 404);
    const baseCcy = base_currency ?? group.base_currency ?? "USD";

    const { data: members } = await supabase
      .from("consolidation_group_members")
      .select("*, organization:organizations(id,name,currency)")
      .eq("group_id", group_id);

    const orgIds = (members ?? []).map((m) => m.organization_id);
    if (orgIds.length === 0) return j({ error: "Group has no members" }, 400);

    // Create run row
    const { data: run, error: rErr } = await supabase
      .from("consolidation_runs")
      .insert({
        group_id,
        organization_id: group.parent_organization_id ?? orgIds[0],
        period_start,
        period_end,
        base_currency: baseCcy,
        status: "running",
        created_by: ud.user.id,
      })
      .select()
      .single();
    if (rErr || !run) return j({ error: rErr?.message ?? "run insert failed" }, 500);

    // FX rates for translation
    const { data: fxRates } = await supabase
      .from("consolidation_exchange_rates")
      .select("*")
      .eq("group_id", group_id)
      .lte("rate_date", period_end);
    const fxMap = new Map<string, number>();
    for (const r of fxRates ?? []) {
      if (r.to_currency === baseCcy) fxMap.set(r.from_currency, Number(r.average_rate ?? r.spot_rate ?? 1));
    }
    fxMap.set(baseCcy, 1);

    // Sum balances by account type per org from journal_entry_lines via journal_entries
    let totalAssets = 0, totalLiab = 0, totalEquity = 0, totalRev = 0, totalExp = 0;
    const fxSummary: Record<string, number> = {};
    const memberSummaries: Array<Record<string, unknown>> = [];

    for (const m of members ?? []) {
      const ccy = m.functional_currency ?? m.organization?.currency ?? baseCcy;
      const rate = fxMap.get(ccy) ?? 1;
      const ownership = Number(m.ownership_percentage ?? 100) / 100;
      fxSummary[ccy] = rate;

      // Pull GL balances per account type
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("debit,credit,account:chart_of_accounts(account_type),journal_entry:journal_entries!inner(entry_date,organization_id,status)")
        .eq("journal_entry.organization_id", m.organization_id)
        .gte("journal_entry.entry_date", period_start)
        .lte("journal_entry.entry_date", period_end)
        .in("journal_entry.status", ["posted", "reversed"]);

      let a = 0, l = 0, eq = 0, rv = 0, ex = 0;
      for (const ln of (lines ?? []) as Array<{ debit: number; credit: number; account?: { account_type?: string }; journal_entry?: { status: string } }>) {
        const sign = ln.journal_entry?.status === "reversed" ? -1 : 1;
        const debit = Number(ln.debit ?? 0) * sign;
        const credit = Number(ln.credit ?? 0) * sign;
        const cat = classify(ln.account?.account_type ?? null);
        if (cat === "asset") a += debit - credit;
        else if (cat === "liability") l += credit - debit;
        else if (cat === "equity") eq += credit - debit;
        else if (cat === "revenue") rv += credit - debit;
        else if (cat === "expense") ex += debit - credit;
      }
      const factor = rate * ownership;
      const aBase = a * factor, lBase = l * factor, eqBase = eq * factor, rvBase = rv * factor, exBase = ex * factor;
      totalAssets += aBase; totalLiab += lBase; totalEquity += eqBase; totalRev += rvBase; totalExp += exBase;
      memberSummaries.push({
        organization_id: m.organization_id, name: m.organization?.name, currency: ccy, rate, ownership,
        assets: aBase, liabilities: lBase, equity: eqBase, revenue: rvBase, expenses: exBase,
      });
    }

    const netIncome = totalRev - totalExp;
    await supabase.from("consolidation_runs").update({
      status: "completed",
      total_assets: totalAssets.toFixed(2),
      total_liabilities: totalLiab.toFixed(2),
      total_equity: totalEquity.toFixed(2),
      total_revenue: totalRev.toFixed(2),
      total_expenses: totalExp.toFixed(2),
      net_income: netIncome.toFixed(2),
      elimination_summary: { members: memberSummaries },
      fx_summary: fxSummary,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    return j({
      ok: true,
      run_id: run.id,
      totals: { assets: totalAssets, liabilities: totalLiab, equity: totalEquity, revenue: totalRev, expenses: totalExp, net_income: netIncome },
      members: memberSummaries,
      fx_summary: fxSummary,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("consolidation-engine", msg);
    return j({ error: msg }, 500);
  }
});
