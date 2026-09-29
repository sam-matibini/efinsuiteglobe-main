import { createFileRoute } from "@tanstack/react-router";

import { authenticateApiRequest, corsPreflight, jsonResponse } from "@/lib/api-gateway.server";

export const Route = createFileRoute("/api/public/v1/cases/$caseId")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const caseId = params.caseId;

        const [record, checks, hits, owners, transactions] = await Promise.all([
          auth.admin.from("cases").select("*").eq("id", caseId).eq("org_id", auth.orgId).maybeSingle(),
          auth.admin.from("case_checks").select("category, name, result, detail, checked_at").eq("case_id", caseId),
          auth.admin
            .from("screening_hits")
            .select("matched_name, list_name, list_version, category, match_score, disposition, reasons")
            .eq("case_id", caseId),
          auth.admin
            .from("business_owners")
            .select("name, ownership_pct, effective_pct, is_ubo, control_basis, screening_status")
            .eq("case_id", caseId),
          auth.admin
            .from("transactions")
            .select("occurred_at, direction, method, amount, currency, amount_cad, counterparty_name, counterparty_country, risk_score, status")
            .eq("case_id", caseId)
            .order("occurred_at", { ascending: false })
            .limit(100),
        ]);

        if (!record.data) return jsonResponse({ error: "not_found" }, 404);
        return jsonResponse({
          data: {
            ...(record.data as Record<string, unknown>),
            checks: checks.data ?? [],
            screening_hits: hits.data ?? [],
            beneficial_owners: owners.data ?? [],
            transactions: transactions.data ?? [],
          },
        });
      },
    },
  },
});
