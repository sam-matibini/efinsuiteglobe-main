import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { apiAudit, authenticateApiRequest, corsPreflight, jsonResponse, readJson } from "@/lib/api-gateway.server";

const schema = z.object({
  status: z.enum(["open", "acknowledged", "closed"]),
  detail: z.string().trim().max(1000).optional(),
});

export const Route = createFileRoute("/api/public/v1/alerts/$alertId")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      PATCH: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const parsed = await readJson(request, schema);
        if (!parsed.ok) return parsed.response;

        const update: Record<string, unknown> = { status: parsed.data.status };
        if (parsed.data.detail !== undefined) update["detail"] = parsed.data.detail;

        const { data, error } = await auth.admin
          .from("monitoring_alerts")
          .update(update as never)
          .eq("id", params.alertId)
          .eq("org_id", auth.orgId)
          .select("id, case_id, alert_type, detail, status, created_at")
          .maybeSingle();
        if (error) return jsonResponse({ error: "update_failed", message: error.message }, 500);
        if (!data) return jsonResponse({ error: "not_found", message: "Unknown alert" }, 404);

        await apiAudit(auth, "alert.updated", "alert", params.alertId, { status: parsed.data.status });
        return jsonResponse({ data });
      },
    },
  },
});
