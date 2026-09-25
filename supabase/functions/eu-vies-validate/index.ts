/**
 * eu-vies-validate — Phase 13
 *
 * Validates EU VAT numbers via the official EU VIES SOAP service:
 *   https://ec.europa.eu/taxation_customs/vies/services/checkVatService
 *
 * Caches the result in `eu_vat_number_validations` for 24h.
 *
 * Body: { organizationId, countryCode, vatNumber, customerId? }
 * Returns: { isValid, traderName, traderAddress, consultationNumber, cached }
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
const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/services/checkVatService";

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
    const { organizationId, countryCode, vatNumber, customerId } = body ?? {};
    if (!organizationId || !countryCode || !vatNumber) {
      return jsonError(400, "organizationId, countryCode, vatNumber required");
    }
    const cc = String(countryCode).toUpperCase().trim();
    const vn = String(vatNumber).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return jsonError(400, "Invalid countryCode");
    if (vn.length < 4 || vn.length > 14) return jsonError(400, "Invalid vatNumber length");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isMember } = await admin.rpc("is_org_member", {
      p_organization_id: organizationId, p_user_id: userId,
    });
    if (!isMember) return jsonError(403, "Not authorized");

    // Cache check (24h)
    const { data: cached } = await admin
      .from("eu_vat_number_validations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("country_code", cc)
      .eq("vat_number", vn)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached) {
      return jsonOk({
        isValid: cached.is_valid,
        traderName: cached.trader_name,
        traderAddress: cached.trader_address,
        consultationNumber: cached.vies_consultation_number,
        cached: true,
      });
    }

    // SOAP request
    const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:checkVat>
      <urn:countryCode>${cc}</urn:countryCode>
      <urn:vatNumber>${vn}</urn:vatNumber>
    </urn:checkVat>
  </soapenv:Body>
</soapenv:Envelope>`;

    let isValid = false;
    let traderName: string | null = null;
    let traderAddress: string | null = null;
    let raw: string | null = null;
    try {
      const r = await fetch(VIES_URL, {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=utf-8", "SOAPAction": "" },
        body: soap,
      });
      raw = await r.text();
      isValid = /<valid>true<\/valid>/i.test(raw);
      traderName = match(raw, /<name>([\s\S]*?)<\/name>/i);
      traderAddress = match(raw, /<address>([\s\S]*?)<\/address>/i);
    } catch (e) {
      console.error("VIES request failed", e);
      return jsonError(502, "VIES service unavailable");
    }

    await admin.from("eu_vat_number_validations").upsert(
      {
        organization_id: organizationId,
        customer_id: customerId ?? null,
        country_code: cc,
        vat_number: vn,
        is_valid: isValid,
        trader_name: traderName,
        trader_address: traderAddress,
        raw_response: { xml: raw?.slice(0, 8000) },
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      },
      { onConflict: "organization_id,country_code,vat_number" }
    );

    return jsonOk({ isValid, traderName, traderAddress, cached: false });
  } catch (e) {
    console.error("eu-vies-validate error", e);
    return jsonError(500, e instanceof Error ? e.message : "Unknown");
  }
});

function match(s: string, re: RegExp): string | null {
  const m = s.match(re); return m ? m[1].trim() : null;
}
function jsonOk(d: unknown) {
  return new Response(JSON.stringify(d), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
