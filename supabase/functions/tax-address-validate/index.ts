/**
 * tax-address-validate — Phase 12
 *
 * Address normalization/validation via the configured tax provider.
 * Avalara: /api/v2/addresses/resolve
 * TaxJar: /v2/addresses/validate
 */
// @ts-nocheck — Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j(401, { error: "Missing auth" });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return j(401, { error: "Invalid token" });

    const body = await req.json();
    if (!body?.organizationId || !body?.address) return j(400, { error: "organizationId and address required" });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isMember } = await admin.rpc("is_org_member", {
      p_organization_id: body.organizationId, p_user_id: userData.user.id,
    });
    if (!isMember) return j(403, { error: "Not authorized" });

    const { data: settings } = await admin
      .from("tax_provider_settings")
      .select("*").eq("organization_id", body.organizationId).maybeSingle();
    const provider = settings?.provider ?? "none";
    if (provider === "none") return j(400, { error: "No tax provider configured" });

    const a = body.address;
    if (provider === "avalara") {
      const accountId = Deno.env.get("AVALARA_ACCOUNT_ID");
      const licenseKey = Deno.env.get("AVALARA_LICENSE_KEY");
      if (!accountId || !licenseKey) return j(400, { error: "Avalara credentials not configured" });
      const base = settings?.environment === "production" ? "https://rest.avatax.com" : "https://sandbox-rest.avatax.com";
      const params = new URLSearchParams({
        line1: a.line1 ?? "", city: a.city ?? "", region: a.region, postalCode: a.postalCode, country: a.countryCode ?? "US",
      });
      const r = await fetch(`${base}/api/v2/addresses/resolve?${params}`, {
        headers: { Authorization: "Basic " + btoa(`${accountId}:${licenseKey}`) },
      });
      const d = await r.json();
      if (!r.ok) return j(r.status, { error: d?.error?.message ?? "Avalara error", details: d });
      const v = d.validatedAddresses?.[0] ?? d.address;
      return j(200, {
        valid: !!v,
        normalized: v ? { line1: v.line1, city: v.city, region: v.region, postalCode: v.postalCode, countryCode: v.country } : null,
        messages: d.messages ?? [],
      });
    }

    if (provider === "taxjar") {
      const apiKey = Deno.env.get("TAXJAR_API_KEY");
      if (!apiKey) return j(400, { error: "TaxJar credentials not configured" });
      const base = settings?.environment === "production" ? "https://api.taxjar.com/v2" : "https://api.sandbox.taxjar.com/v2";
      const r = await fetch(`${base}/addresses/validate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          country: a.countryCode ?? "US", state: a.region, zip: a.postalCode, city: a.city, street: a.line1,
        }),
      });
      const d = await r.json();
      if (!r.ok) return j(r.status, { error: d?.error ?? "TaxJar error", details: d });
      const v = d.addresses?.[0];
      return j(200, {
        valid: !!v,
        normalized: v ? { line1: v.street, city: v.city, region: v.state, postalCode: v.zip, countryCode: v.country } : null,
        messages: [],
      });
    }

    return j(400, { error: `Unsupported provider: ${provider}` });
  } catch (e) {
    return j(500, { error: e instanceof Error ? e.message : "Unknown" });
  }
});

function j(status: number, data: unknown) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
