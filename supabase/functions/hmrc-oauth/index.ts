/**
 * hmrc-oauth — Phase 11a
 *
 * Implements the HMRC Making Tax Digital OAuth 2.0 flow.
 * - GET ?action=authorize&authorityId=...&orgId=... → redirects to HMRC consent page
 * - GET ?action=callback&code=...&state=... → exchanges code for tokens, stores them
 *
 * Required secrets: HMRC_CLIENT_ID, HMRC_CLIENT_SECRET, optional HMRC_ENV=prod
 */
// @ts-nocheck — Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const HMRC_BASE =
  Deno.env.get("HMRC_ENV") === "prod"
    ? "https://api.service.hmrc.gov.uk"
    : "https://test-api.service.hmrc.gov.uk";
const HMRC_AUTH_BASE =
  Deno.env.get("HMRC_ENV") === "prod"
    ? "https://www.tax.service.gov.uk"
    : "https://test-www.tax.service.gov.uk";

const SCOPES = "read:vat write:vat";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const clientId = Deno.env.get("HMRC_CLIENT_ID");
  const clientSecret = Deno.env.get("HMRC_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return jsonError(500, "HMRC_CLIENT_ID / HMRC_CLIENT_SECRET not configured");
  }

  const callbackUrl = `${SUPABASE_URL}/functions/v1/hmrc-oauth?action=callback`;

  if (action === "authorize") {
    const authorityId = url.searchParams.get("authorityId");
    const orgId = url.searchParams.get("orgId");
    const returnTo = url.searchParams.get("returnTo") ?? "/tax/e-file";
    if (!authorityId || !orgId) return jsonError(400, "authorityId and orgId required");

    const state = btoa(JSON.stringify({ authorityId, orgId, returnTo, n: crypto.randomUUID() }));
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: SCOPES,
      state,
      redirect_uri: callbackUrl,
    });
    return Response.redirect(`${HMRC_AUTH_BASE}/oauth/authorize?${params.toString()}`, 302);
  }

  if (action === "callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return jsonError(400, "Missing code/state");

    let parsed;
    try {
      parsed = JSON.parse(atob(state));
    } catch {
      return jsonError(400, "Invalid state");
    }

    const tokenRes = await fetch(`${HMRC_BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return jsonError(tokenRes.status, `HMRC token exchange failed: ${err}`);
    }
    const tokens = await tokenRes.json();

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    await admin.from("tax_authority_credentials").upsert(
      [{
        organization_id: parsed.orgId,
        authority_id: parsed.authorityId,
        credential_type: "hmrc_oauth",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 14400) * 1000).toISOString(),
        payload: { scope: tokens.scope, token_type: tokens.token_type },
        is_active: true,
      }],
      { onConflict: "organization_id,authority_id,credential_type" },
    );

    // Redirect back to the app
    const appOrigin = req.headers.get("origin") ?? req.headers.get("referer") ?? "/";
    return Response.redirect(`${appOrigin}${parsed.returnTo}?hmrc=connected`, 302);
  }

  return jsonError(400, "Unknown action");
});

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
