import { createFileRoute } from "@tanstack/react-router";

import { authenticateApiRequest, corsPreflight, jsonResponse, loadCase, paging } from "@/lib/api-gateway.server";

export const Route = createFileRoute("/api/public/v1/cases/$caseId/hits")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const record = await loadCase(auth, params.caseId, "id");
        if (!record) return jsonResponse({ error: "not_found", message: "Unknown case" }, 404);

        const { limit, offset } = paging(request);
        const { data, error } = await auth.admin
          .from("screening_hits")
          .select(
            "id, matched_name, list_name, list_version, category, match_score, disposition, reasons, detail, created_at",
          )
          .eq("case_id", params.caseId)
          .eq("org_id", auth.orgId)
          .order("match_score", { ascending: false })
          .range(offset, offset + limit - 1);
        if (error) return jsonResponse({ error: "query_failed", message: error.message }, 500);
        return jsonResponse({ data, paging: { limit, offset, count: data?.length ?? 0 } });
      },
    },
  },
});
