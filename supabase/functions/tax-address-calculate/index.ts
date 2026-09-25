/**
 * tax-address-calculate — Phase 12
 *
 * Provider-agnostic real-time sales tax calculation.
 * Supports Avalara AvaTax REST v2 and TaxJar API v2.
 *
 * Inputs: { origin, destination, lines, documentDate, exemptionCertificateNumber? }
 * Returns normalized AddressTaxResponse with per-line + per-jurisdiction breakdown.
 *
 * Caches results in tax_address_cache for 24h to reduce provider costs.
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

const CACHE_TTL_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError(401, "Missing authorization");

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonError(401, "Invalid token");
    const userId = userData.user.id;

    const body = await req.json();
    if (!body?.organizationId) return jsonError(400, "organizationId required");
    if (!body?.destination?.region || !body?.destination?.postalCode) {
      return jsonError(400, "destination.region and destination.postalCode required");
    }
    if (!Array.isArray(body.lines) || body.lines.length === 0) {
      return jsonError(400, "lines required");
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: isMember } = await admin.rpc("is_org_member", {
      p_organization_id: body.organizationId,
      p_user_id: userId,
    });
    if (!isMember) return jsonError(403, "Not authorized");

    // Load provider settings
    const { data: settings } = await admin
      .from("tax_provider_settings")
      .select("*")
      .eq("organization_id", body.organizationId)
      .maybeSingle();

    const provider = settings?.provider ?? "none";
    if (provider === "none") {
      return jsonError(400, "No tax provider configured. Configure Avalara or TaxJar in tax settings.");
    }

    // Cache check
    const cacheKey = await buildCacheKey(body, provider);
    if (!body.skipCache) {
      const { data: cached } = await admin
        .from("tax_address_cache")
        .select("response_payload, expires_at")
        .eq("organization_id", body.organizationId)
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (cached?.response_payload) {
        return jsonOk({ ...cached.response_payload, cacheHit: true });
      }
    }

    // Provider call
    let response;
    if (provider === "avalara") {
      response = await callAvalara(body, settings);
    } else if (provider === "taxjar") {
      response = await callTaxJar(body, settings);
    } else {
      return jsonError(400, `Unsupported provider: ${provider}`);
    }

    response.cacheHit = false;

    // Cache write
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 3600_000).toISOString();
    await admin.from("tax_address_cache").upsert(
      {
        organization_id: body.organizationId,
        cache_key: cacheKey,
        provider,
        request_payload: body,
        response_payload: response,
        total_rate: response.effectiveRate,
        total_tax_cents: Math.round(response.totalTax * 100),
        jurisdictions: response.jurisdictions,
        expires_at: expiresAt,
      },
      { onConflict: "organization_id,cache_key" }
    );

    return jsonOk(response);
  } catch (e) {
    console.error("tax-address-calculate error", e);
    return jsonError(500, e instanceof Error ? e.message : "Unknown");
  }
});

// ---------- Avalara AvaTax REST v2 ----------
async function callAvalara(req: any, settings: any) {
  const accountId = Deno.env.get("AVALARA_ACCOUNT_ID");
  const licenseKey = Deno.env.get("AVALARA_LICENSE_KEY");
  if (!accountId || !licenseKey) throw new Error("Avalara credentials not configured (AVALARA_ACCOUNT_ID, AVALARA_LICENSE_KEY)");

  const base = settings?.environment === "production"
    ? "https://rest.avatax.com"
    : "https://sandbox-rest.avatax.com";
  const auth = "Basic " + btoa(`${accountId}:${licenseKey}`);

  const payload = {
    type: "SalesOrder",
    companyCode: settings?.company_code ?? "DEFAULT",
    date: req.documentDate ?? new Date().toISOString().slice(0, 10),
    customerCode: req.customerCode ?? "GUEST",
    currencyCode: req.currency ?? "USD",
    addresses: {
      shipFrom: avalaraAddr(req.origin),
      shipTo: avalaraAddr(req.destination),
    },
    lines: req.lines.map((l: any, i: number) => ({
      number: l.id ?? String(i + 1),
      amount: l.amount,
      quantity: l.quantity ?? 1,
      taxCode: l.productTaxCode ?? "P0000000",
      exemptionCode: l.isExempt ? (l.exemptionCertificateNumber ?? req.exemptionCertificateNumber ?? "EXEMPT") : undefined,
    })),
  };

  const r = await fetch(`${base}/api/v2/transactions/create`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Avalara error: ${data?.error?.message ?? r.status}`);

  return normalizeAvalara(data);
}

function avalaraAddr(a: any) {
  return {
    line1: a.line1 ?? "",
    city: a.city ?? "",
    region: a.region,
    country: a.countryCode ?? "US",
    postalCode: a.postalCode,
  };
}

function normalizeAvalara(data: any) {
  const lines = (data.lines ?? []).map((l: any) => ({
    id: l.lineNumber,
    taxableAmount: l.taxableAmount ?? 0,
    taxAmount: l.tax ?? 0,
    effectiveRate: l.taxableAmount ? l.tax / l.taxableAmount : 0,
    jurisdictions: (l.details ?? []).map((d: any) => ({
      jurisdiction: d.jurisName,
      type: (d.jurisdictionType ?? "other").toLowerCase(),
      rate: d.rate ?? 0,
      taxAmount: d.tax ?? 0,
    })),
  }));
  const jurisdictions: Record<string, any> = {};
  lines.forEach((ln: any) => ln.jurisdictions.forEach((j: any) => {
    const k = `${j.type}:${j.jurisdiction}`;
    if (!jurisdictions[k]) jurisdictions[k] = { ...j };
    else jurisdictions[k].taxAmount += j.taxAmount;
  }));
  const totalTax = data.totalTax ?? 0;
  const totalTaxableAmount = data.totalTaxable ?? 0;
  return {
    provider: "avalara",
    totalTax,
    totalTaxableAmount,
    effectiveRate: totalTaxableAmount ? totalTax / totalTaxableAmount : 0,
    currency: data.currencyCode ?? "USD",
    lines,
    jurisdictions: Object.values(jurisdictions),
  };
}

// ---------- TaxJar API v2 ----------
async function callTaxJar(req: any, settings: any) {
  const apiKey = Deno.env.get("TAXJAR_API_KEY");
  if (!apiKey) throw new Error("TaxJar credentials not configured (TAXJAR_API_KEY)");

  const base = settings?.environment === "production"
    ? "https://api.taxjar.com/v2"
    : "https://api.sandbox.taxjar.com/v2";

  const payload = {
    from_country: req.origin.countryCode ?? "US",
    from_zip: req.origin.postalCode,
    from_state: req.origin.region,
    from_city: req.origin.city,
    from_street: req.origin.line1,
    to_country: req.destination.countryCode ?? "US",
    to_zip: req.destination.postalCode,
    to_state: req.destination.region,
    to_city: req.destination.city,
    to_street: req.destination.line1,
    amount: req.lines.reduce((s: number, l: any) => s + (l.amount || 0), 0),
    shipping: 0,
    line_items: req.lines.map((l: any, i: number) => ({
      id: l.id ?? String(i + 1),
      quantity: l.quantity ?? 1,
      product_tax_code: l.productTaxCode,
      unit_price: l.amount,
      discount: 0,
    })),
  };

  const r = await fetch(`${base}/taxes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`TaxJar error: ${data?.error ?? r.status}`);

  return normalizeTaxJar(data);
}

function normalizeTaxJar(data: any) {
  const t = data.tax ?? {};
  const breakdown = t.breakdown ?? {};
  const jurisdictions = [
    breakdown.state_tax_collectable ? { jurisdiction: "State", type: "state", rate: breakdown.state_tax_rate ?? 0, taxAmount: breakdown.state_tax_collectable } : null,
    breakdown.county_tax_collectable ? { jurisdiction: "County", type: "county", rate: breakdown.county_tax_rate ?? 0, taxAmount: breakdown.county_tax_collectable } : null,
    breakdown.city_tax_collectable ? { jurisdiction: "City", type: "city", rate: breakdown.city_tax_rate ?? 0, taxAmount: breakdown.city_tax_collectable } : null,
    breakdown.special_district_tax_collectable ? { jurisdiction: "Special District", type: "special", rate: breakdown.special_tax_rate ?? 0, taxAmount: breakdown.special_district_tax_collectable } : null,
  ].filter(Boolean);

  const lines = (breakdown.line_items ?? []).map((l: any) => ({
    id: l.id,
    taxableAmount: l.taxable_amount ?? 0,
    taxAmount: l.tax_collectable ?? 0,
    effectiveRate: l.combined_tax_rate ?? 0,
    jurisdictions: [
      l.state_amount ? { jurisdiction: "State", type: "state", rate: l.state_sales_tax_rate ?? 0, taxAmount: l.state_amount } : null,
      l.county_amount ? { jurisdiction: "County", type: "county", rate: l.county_tax_rate ?? 0, taxAmount: l.county_amount } : null,
      l.city_amount ? { jurisdiction: "City", type: "city", rate: l.city_tax_rate ?? 0, taxAmount: l.city_amount } : null,
      l.special_district_amount ? { jurisdiction: "Special District", type: "special", rate: l.special_tax_rate ?? 0, taxAmount: l.special_district_amount } : null,
    ].filter(Boolean),
  }));

  return {
    provider: "taxjar",
    totalTax: t.amount_to_collect ?? 0,
    totalTaxableAmount: t.taxable_amount ?? 0,
    effectiveRate: t.rate ?? 0,
    currency: "USD",
    lines,
    jurisdictions,
  };
}

// ---------- helpers ----------
async function buildCacheKey(req: any, provider: string) {
  const norm = (a: any) => `${(a.countryCode ?? "US").toUpperCase()}|${a.region.toUpperCase()}|${(a.postalCode || "").replace(/\s+/g, "").toUpperCase()}|${(a.city ?? "").toLowerCase().trim()}`;
  const linesSig = req.lines.map((l: any) => `${l.id}:${Math.round((l.amount || 0) * 100)}:${l.productTaxCode ?? ""}:${l.isExempt ? "X" : ""}`).join(";");
  const raw = [provider, norm(req.origin), norm(req.destination), linesSig, req.documentDate ?? "", req.exemptionCertificateNumber ?? ""].join("||");
  const buf = new TextEncoder().encode(raw);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
