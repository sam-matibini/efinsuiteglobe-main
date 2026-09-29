import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  apiAudit,
  authenticateApiRequest,
  corsPreflight,
  dispatchWebhook,
  jsonResponse,
  readJson,
} from "@/lib/api-gateway.server";

const schema = z.object({
  status: z.enum(["draft", "submitted"]),
  reference: z.string().trim().max(80).optional(),
});

export const Route = createFileRoute("/api/public/v1/reports/$reportId")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const { data } = await auth.admin
          .from("regulatory_reports")
          .select("*")
          .eq("id", params.reportId)
          .eq("org_id", auth.orgId)
          .maybeSingle();
        if (!data) return jsonResponse({ error: "not_found", message: "Unknown report" }, 404);
        return jsonResponse({ data });
      },
      PATCH: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const parsed = await readJson(request, schema);
        if (!parsed.ok) return parsed.response;

        const update: Record<string, unknown> = { status: parsed.data.status };
        if (parsed.data.status === "submitted") {
          update["submitted_at"] = new Date().toISOString();
          update["reference"] = parsed.data.reference ?? null;
        }

        const { data, error } = await auth.admin
          .from("regulatory_reports")
          .update(update as never)
          .eq("id", params.reportId)
          .eq("org_id", auth.orgId)
          .select("id, case_id, report_type, authority, jurisdiction, status, reference, submitted_at")
          .maybeSingle();
        if (error) return jsonResponse({ error: "update_failed", message: error.message }, 500);
        if (!data) return jsonResponse({ error: "not_found", message: "Unknown report" }, 404);

        await apiAudit(auth, "report.submitted", "report", params.reportId, { status: parsed.data.status });
        if (parsed.data.status === "submitted") {
          await dispatchWebhook(
            auth.admin,
            auth.orgId,
            auth.environment,
            "report.filed",
            data as Record<string, unknown>,
          );
          try {
            const { notifyOrg } = await import("@/lib/usage.server");
            await notifyOrg(auth.orgId, "report.filed", {
              report: String((data as any).report_type ?? "report").toUpperCase(),
              authority: String((data as any).authority ?? ""),
              reference: String((data as any).reference ?? ""),
              link: "/console/reports",
            });
          } catch {
            /* notifications never block filing */
          }
        }
        return jsonResponse({ data });
      },
    },
  },
});
