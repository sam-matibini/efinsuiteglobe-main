/**
 * tax-efile-submit — Phase 11a
 *
 * Submits a `tax_submissions` row to the appropriate authority.
 * - HMRC MTD VAT: posts directly to /organisations/vat/{vrn}/returns
 * - CRA / US state: marks as transmitted (manual portal upload)
 *
 * The function performs manual JWT verification per project standard.
 */
// @ts-nocheck — Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubmitBody {
  submissionId: string;
  channel: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// HMRC environment — sandbox by default, production once `HMRC_ENV=prod` is set
const HMRC_BASE =
  Deno.env.get("HMRC_ENV") === "prod"
    ? "https://api.service.hmrc.gov.uk"
    : "https://test-api.service.hmrc.gov.uk";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Manual JWT verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError(401, "Missing authorization");
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonError(401, "Invalid token");
    const userId = userData.user.id;

    const body = (await req.json()) as SubmitBody;
    if (!body.submissionId) return jsonError(400, "submissionId required");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load submission
    const { data: sub, error: subErr } = await admin
      .from("tax_submissions")
      .select("*")
      .eq("id", body.submissionId)
      .single();
    if (subErr || !sub) return jsonError(404, "Submission not found");

    // Verify membership
    const { data: isMember } = await admin.rpc("is_org_member", {
      p_organization_id: sub.organization_id,
      p_user_id: userId,
    });
    if (!isMember) return jsonError(403, "Not authorized");

    if (sub.channel === "hmrc_mtd") {
      return await submitHmrc(admin, sub);
    }

    // For CRA / US — just mark as transmitted (manual portal flow)
    await admin
      .from("tax_submissions")
      .update({
        status: "transmitted",
        transmitted_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    return jsonOk({
      message: "Marked as transmitted. Complete the upload in the authority portal and record the confirmation number when received.",
    });
  } catch (e) {
    console.error("tax-efile-submit error", e);
    return jsonError(500, e instanceof Error ? e.message : "Unknown error");
  }
});

async function submitHmrc(admin: ReturnType<typeof createClient>, sub: any) {
  // Load credentials
  const { data: cred } = await admin
    .from("tax_authority_credentials")
    .select("*")
    .eq("organization_id", sub.organization_id)
    .eq("authority_id", sub.authority_id)
    .eq("credential_type", "hmrc_oauth")
    .maybeSingle();

  if (!cred?.vrn || !cred?.access_token) {
    return jsonError(400, "HMRC credentials not configured. Connect HMRC first.");
  }

  // Token refresh if expired
  let accessToken = cred.access_token as string;
  if (cred.token_expires_at && new Date(cred.token_expires_at).getTime() < Date.now() + 60_000) {
    const refreshed = await refreshHmrcToken(cred.refresh_token);
    if (!refreshed) return jsonError(401, "HMRC token refresh failed. Reconnect HMRC.");
    accessToken = refreshed.access_token;
    await admin
      .from("tax_authority_credentials")
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq("id", cred.id);
  }

  const payload = sub.payload?.contents ? JSON.parse(sub.payload.contents) : null;
  if (!payload) return jsonError(400, "Submission payload invalid");

  const url = `${HMRC_BASE}/organisations/vat/${cred.vrn}/returns`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/vnd.hmrc.1.0+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const responseBody = await res.json().catch(() => ({}));

  if (!res.ok) {
    await admin
      .from("tax_submissions")
      .update({
        status: "rejected",
        error_message: responseBody?.message ?? `HTTP ${res.status}`,
        authority_response: responseBody,
        retry_count: (sub.retry_count ?? 0) + 1,
      })
      .eq("id", sub.id);
    return jsonError(res.status, responseBody?.message ?? "HMRC rejected the submission", responseBody);
  }

  // Success
  await admin
    .from("tax_submissions")
    .update({
      status: "acknowledged",
      transmitted_at: new Date().toISOString(),
      acknowledged_at: new Date().toISOString(),
      confirmation_number: responseBody?.formBundleNumber ?? null,
      authority_response: responseBody,
    })
    .eq("id", sub.id);

  await admin
    .from("tax_authority_credentials")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", cred.id);

  return jsonOk({
    message: "HMRC accepted the submission",
    confirmation: responseBody?.formBundleNumber,
    response: responseBody,
  });
}

async function refreshHmrcToken(refreshToken: string | null) {
  const clientId = Deno.env.get("HMRC_CLIENT_ID");
  const clientSecret = Deno.env.get("HMRC_CLIENT_SECRET");
  if (!refreshToken || !clientId || !clientSecret) return null;
  const res = await fetch(`${HMRC_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) return null;
  return await res.json();
}

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function jsonError(status: number, message: string, extra?: unknown) {
  return new Response(JSON.stringify({ error: message, details: extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
