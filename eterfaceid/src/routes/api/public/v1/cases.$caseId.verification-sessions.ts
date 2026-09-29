import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  apiAudit,
  authenticateApiRequest,
  corsPreflight,
  jsonResponse,
  loadCase,
  readJson,
  sha256Hex,
  withIdempotency,
} from "@/lib/api-gateway.server";

const schema = z
  .object({
    expires_in_minutes: z.number().int().min(5).max(10080).optional(),
    redirect_url: z.string().url().max(500).optional(),
  })
  .default({});

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const Route = createFileRoute("/api/public/v1/cases/$caseId/verification-sessions")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const { data, error } = await auth.admin
          .from("verification_sessions")
          .select("id, status, channel, expires_at, used_at, completed_at, created_at")
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
        const record = await loadCase(auth, params.caseId, "id, subject_name");
        if (!record) return jsonResponse({ error: "not_found", message: "Unknown case" }, 404);

        return withIdempotency(auth, request, "verification-sessions", async () => {
          const token = randomToken();
          const expiresAt = new Date(
            Date.now() + (parsed.data.expires_in_minutes ?? 1440) * 60_000,
          ).toISOString();

          const { data, error } = await auth.admin
            .from("verification_sessions")
            .insert({
              case_id: params.caseId,
              org_id: auth.orgId,
              channel: "hosted_link",
              status: "open",
              expires_at: expiresAt,
              token_hash: await sha256Hex(token),
              redirect_url: parsed.data.redirect_url ?? null,
            } as never)
            .select("id, status, channel, expires_at, created_at")
            .single();
          if (error) return jsonResponse({ error: "create_failed", message: error.message }, 500);

          const origin = new URL(request.url).origin;
          await apiAudit(auth, "verification.link_created", "verification_session", (data as any).id, {
            case_id: params.caseId,
          });

          return jsonResponse(
            { data: { ...(data as Record<string, unknown>), url: `${origin}/verify/${token}`, token } },
            201,
          );
        });
      },
    },
  },
});
