import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  apiAudit,
  authenticateApiRequest,
  corsPreflight,
  countUsage,
  dispatchWebhook,
  jsonResponse,
  loadCase,
  readJson,
  withIdempotency,
} from "@/lib/api-gateway.server";
import { processSelfie } from "@/lib/verification-core.server";

const schema = z.object({
  challenge: z.string().trim().min(2).max(80),
  document_id: z.string().uuid().optional(),
  signals: z.object({
    frames_captured: z.number().int().min(0).max(1000),
    challenge_passed: z.boolean(),
    motion_variance: z.number().min(0).max(5),
    brightness_range: z.number().min(0).max(5),
    blur_score: z.number().min(0).max(5),
    face_stable: z.boolean(),
  }),
});

export const Route = createFileRoute("/api/public/v1/cases/$caseId/selfies")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const { data, error } = await auth.admin
          .from("selfies")
          .select("id, challenge, liveness_score, face_match_status, face_match_score, result, created_at")
          .eq("case_id", params.caseId)
          .eq("org_id", auth.orgId)
          .order("created_at", { ascending: false });
        if (error) return jsonResponse({ error: "query_failed", message: error.message }, 500);
        return jsonResponse({ data });
      },
      POST: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const parsed = await readJson(request, schema);
        if (!parsed.ok) return parsed.response;
        const record = await loadCase(auth, params.caseId, "id");
        if (!record) return jsonResponse({ error: "not_found", message: "Unknown case" }, 404);
        const body = parsed.data;

        return withIdempotency(auth, request, "selfies", async () => {
          try {
            const outcome = await processSelfie(auth.admin, {
              caseId: params.caseId,
              orgId: auth.orgId,
              documentId: body.document_id ?? null,
              challenge: body.challenge,
              signals: {
                framesCaptured: body.signals.frames_captured,
                challengePassed: body.signals.challenge_passed,
                motionVariance: body.signals.motion_variance,
                brightnessRange: body.signals.brightness_range,
                blurScore: body.signals.blur_score,
                faceStable: body.signals.face_stable,
              },
            });
            await apiAudit(auth, "selfie.captured", "selfie", outcome.selfieId, {
              case_id: params.caseId,
              result: outcome.result,
            });
            await countUsage(auth, "verifications");
            await dispatchWebhook(auth.admin, auth.orgId, auth.environment, "verification.completed", {
              case_id: params.caseId,
              kind: "selfie",
              selfie_id: outcome.selfieId,
              result: outcome.result,
              liveness: outcome.liveness,
            });
            return jsonResponse({ data: outcome }, 201);
          } catch (err) {
            return jsonResponse(
              { error: "selfie_failed", message: err instanceof Error ? err.message : "liveness check failed" },
              500,
            );
          }
        });
      },
    },
  },
});
