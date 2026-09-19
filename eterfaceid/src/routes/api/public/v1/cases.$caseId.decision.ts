import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  apiAudit,
  authenticateApiRequest,
  corsPreflight,
  dispatchWebhook,
  jsonResponse,
  loadCase,
  readJson,
} from "@/lib/api-gateway.server";

const schema = z.object({
  status: z.enum(["pending", "in_review", "approved", "rejected"]),
  note: z.string().trim().max(1000).optional(),
});

export const Route = createFileRoute("/api/public/v1/cases/$caseId/decision")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const parsed = await readJson(request, schema);
        if (!parsed.ok) return parsed.response;

        const record = await loadCase(auth, params.caseId, "id, reference, subject_name, assigned_to, created_by");
        if (!record) return jsonResponse({ error: "not_found", message: "Unknown case" }, 404);

        const note = parsed.data.note ?? null;
        const { data: updated, error } = await auth.admin
          .from("cases")
          .update({
            status: parsed.data.status as never,
            decision_note: note,
          } as never)
          .eq("id", params.caseId)
          .eq("org_id", auth.orgId)
          .select("id, reference, subject_name, status, risk_level, risk_score, decision_note")
          .single();
        if (error) return jsonResponse({ error: "update_failed", message: error.message }, 500);

        await apiAudit(auth, "case.decision", "case", params.caseId, { status: parsed.data.status, note });
        await dispatchWebhook(
          auth.admin,
          auth.orgId,
          auth.environment,
          "case.decision",
          updated as Record<string, unknown>,
        );

        if (parsed.data.status === "approved" || parsed.data.status === "rejected") {
          try {
            const { notifyOrg } = await import("@/lib/usage.server");
            await notifyOrg(auth.orgId, "case.decision", {
              subject: String((record as any).subject_name ?? ""),
              reference: String((record as any).reference ?? ""),
              decision: parsed.data.status,
              note: note ?? "",
              link: `/console/cases/${params.caseId}`,
            });
          } catch {
            /* notifications never block the decision */
          }
        }

        return jsonResponse({ data: updated });
      },
    },
  },
});
