import { createFileRoute } from "@tanstack/react-router";

import { authenticateApiRequest, corsPreflight, jsonResponse, paging } from "@/lib/api-gateway.server";

export const Route = createFileRoute("/api/public/v1/alerts")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const { limit, offset, searchParams } = paging(request);
        const status = searchParams.get("status");
        const caseId = searchParams.get("case_id");

        let query = auth.admin
          .from("monitoring_alerts")
          .select("id, case_id, alert_type, detail, status, created_at")
          .eq("org_id", auth.orgId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        if (status) query = query.eq("status", status);
        if (caseId) query = query.eq("case_id", caseId);

        const { data, error } = await query;
        if (error) return jsonResponse({ error: "query_failed", message: error.message }, 500);
        return jsonResponse({ data, paging: { limit, offset, count: data?.length ?? 0 } });
      },
    },
  },
});
