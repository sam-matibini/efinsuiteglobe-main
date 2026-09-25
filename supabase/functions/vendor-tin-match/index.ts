import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Luhn check for SIN
function luhnValid(num: string): boolean {
  const d = num.replace(/\D/g, "");
  if (d.length !== 9) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = parseInt(d[i], 10);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

function einValid(ein: string): boolean {
  const d = ein.replace(/\D/g, "");
  return d.length === 9;
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

    const { organization_id, profile_ids } = await req.json();
    if (!organization_id) return j({ error: "Missing organization_id" }, 400);

    let q = supabase.from("vendor_tax_profiles").select("*").eq("organization_id", organization_id);
    if (profile_ids?.length) q = q.in("id", profile_ids);
    const { data: profiles } = await q;

    const results: any[] = [];
    for (const p of profiles ?? []) {
      let status = "unverified";
      let notes = "";
      if (p.country === "CA" && p.sin) {
        status = luhnValid(p.sin) ? "format_valid" : "invalid";
        notes = status === "invalid" ? "SIN failed Luhn check" : "SIN format valid (queued for CRA validation)";
      } else if (p.country === "US" && (p.tin || p.ein)) {
        status = einValid(p.tin || p.ein) ? "format_valid" : "invalid";
        notes = status === "invalid" ? "TIN/EIN must be 9 digits" : "TIN format valid (queued for IRS TIN-Match batch)";
      } else {
        notes = "No TIN/SIN/EIN on file";
      }
      await supabase
        .from("vendor_tax_profiles")
        .update({ tin_match_status: status, tin_match_checked_at: new Date().toISOString(), tin_match_notes: notes })
        .eq("id", p.id);
      results.push({ id: p.id, status, notes });
    }

    return j({ ok: true, results, count: results.length });
  } catch (e: any) {
    console.error("vendor-tin-match", e);
    return j({ error: e?.message ?? "Unknown error" }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
