/**
 * The customer-facing side of a hosted verification link. The link token is
 * the only credential: no API key, no sign-in. Tokens are single use and
 * expire, and they only ever touch the one case they were issued for.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { CORS_HEADERS, corsPreflight, jsonResponse, sha256Hex } from "@/lib/api-gateway.server";
import { processDocument, processSelfie } from "@/lib/verification-core.server";

const schema = z.object({
  document: z
    .object({
      doc_type: z.string().trim().min(2).max(60),
      mrz: z.string().trim().max(200).optional(),
      issuing_country: z.string().trim().max(3).optional(),
      issuing_region: z.string().trim().max(10).optional(),
      document_number: z.string().trim().max(60).optional(),
      surname: z.string().trim().max(120).optional(),
      given_names: z.string().trim().max(120).optional(),
      birth_date: z.string().trim().max(10).optional(),
      issue_date: z.string().trim().max(10).optional(),
      expiry_date: z.string().trim().max(10).optional(),
    })
    .optional(),
  selfie: z
    .object({
      challenge: z.string().trim().min(2).max(80),
      signals: z.object({
        frames_captured: z.number().int().min(0).max(1000),
        challenge_passed: z.boolean(),
        motion_variance: z.number().min(0).max(5),
        brightness_range: z.number().min(0).max(5),
        blur_score: z.number().min(0).max(5),
        face_stable: z.boolean(),
      }),
    })
    .optional(),
});

function admin() {
  return createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveSession(token: string) {
  const client = admin();
  const { data } = await client
    .from("verification_sessions")
    .select("id, case_id, org_id, status, expires_at, used_at, redirect_url")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!data) return { error: jsonResponse({ error: "invalid_link", message: "This link is not valid." }, 404) };
  const row = data as any;
  if (row.used_at) {
    return { error: jsonResponse({ error: "link_used", message: "This link has already been used." }, 409) };
  }
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
    return { error: jsonResponse({ error: "link_expired", message: "This link has expired." }, 410) };
  }
  return { client, session: row };
}

export const Route = createFileRoute("/api/public/v1/hosted/$token")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ params }) => {
        const resolved = await resolveSession(params.token);
        if ("error" in resolved) return resolved.error;
        const { client, session } = resolved;
        const [{ data: kase }, { data: org }] = await Promise.all([
          client.from("cases").select("subject_name, case_type, country").eq("id", session.case_id).maybeSingle(),
          client.from("organizations").select("name").eq("id", session.org_id).maybeSingle(),
        ]);
        return jsonResponse({
          data: {
            status: session.status,
            expires_at: session.expires_at,
            company: (org as any)?.name ?? null,
            subject_name: (kase as any)?.subject_name ?? null,
            case_type: (kase as any)?.case_type ?? "person",
            country: (kase as any)?.country ?? null,
          },
        });
      },
      POST: async ({ request, params }) => {
        const resolved = await resolveSession(params.token);
        if ("error" in resolved) return resolved.error;
        const { client, session } = resolved;

        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "invalid_request", issues: parsed.error.issues }), {
            status: 422,
            headers: { "content-type": "application/json", ...CORS_HEADERS },
          });
        }
        const body = parsed.data;
        if (!body.document && !body.selfie) {
          return jsonResponse({ error: "invalid_request", message: "Send a document, a selfie, or both." }, 422);
        }

        const out: Record<string, unknown> = {};
        try {
          if (body.document) {
            const doc = await processDocument(client, {
              caseId: session.case_id,
              orgId: session.org_id,
              sessionId: session.id,
              input: {
                docType: body.document.doc_type,
                mrz: body.document.mrz ?? null,
                issuingCountry: body.document.issuing_country ?? null,
                issuingRegion: body.document.issuing_region ?? null,
                documentNumber: body.document.document_number ?? null,
                surname: body.document.surname ?? null,
                givenNames: body.document.given_names ?? null,
                birthDate: body.document.birth_date ?? null,
                issueDate: body.document.issue_date ?? null,
                expiryDate: body.document.expiry_date ?? null,
              },
            });
            out["document"] = { result: doc.result, checks: doc.checks };
            out["document_id"] = doc.documentId;
          }
          if (body.selfie) {
            const selfie = await processSelfie(client, {
              caseId: session.case_id,
              orgId: session.org_id,
              sessionId: session.id,
              documentId: (out["document_id"] as string | undefined) ?? null,
              challenge: body.selfie.challenge,
              signals: {
                framesCaptured: body.selfie.signals.frames_captured,
                challengePassed: body.selfie.signals.challenge_passed,
                motionVariance: body.selfie.signals.motion_variance,
                brightnessRange: body.selfie.signals.brightness_range,
                blurScore: body.selfie.signals.blur_score,
                faceStable: body.selfie.signals.face_stable,
              },
            });
            out["selfie"] = { result: selfie.result, liveness: selfie.liveness };
          }
        } catch (err) {
          return jsonResponse(
            { error: "submission_failed", message: err instanceof Error ? err.message : "submission failed" },
            500,
          );
        }

        const now = new Date().toISOString();
        await client
          .from("verification_sessions")
          .update({ status: "completed", used_at: now, completed_at: now } as never)
          .eq("id", session.id);

        await client.from("audit_events").insert({
          org_id: session.org_id,
          action: "verification.hosted_completed",
          entity_type: "case",
          entity_id: session.case_id,
          detail: out as never,
        } as never);

        try {
          const { recordUsage } = await import("@/lib/usage.server");
          await recordUsage(client, session.org_id, "verifications");
        } catch {
          /* usage counting never blocks a submission */
        }

        try {
          const { dispatchWebhook } = await import("@/lib/api-gateway.server");
          const { data: keyRow } = await client
            .from("api_keys")
            .select("environment")
            .eq("org_id", session.org_id)
            .is("revoked_at", null)
            .limit(1)
            .maybeSingle();
          await dispatchWebhook(client, session.org_id, (keyRow as any)?.environment ?? "live", "verification.completed", {
            case_id: session.case_id,
            session_id: session.id,
            kind: "hosted",
            ...out,
          });
        } catch {
          /* webhook delivery is logged, never blocking */
        }

        return jsonResponse({ data: { ...out, redirect_url: session.redirect_url ?? null } });
      },
    },
  },
});
