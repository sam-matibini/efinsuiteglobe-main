import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  apiAudit,
  authenticateApiRequest,
  corsPreflight,
  jsonResponse,
  loadCase,
  paging,
  readJson,
  withIdempotency,
} from "@/lib/api-gateway.server";

const schema = z.object({
  case_id: z.string().uuid(),
  report_type: z.enum(["str", "lctr", "eftr", "sar", "ctr", "fiu"]),
  jurisdiction: z.string().trim().max(2).default("CA"),
  authority: z.string().trim().max(60).default("FINTRAC"),
  narrative: z.string().trim().max(4000).optional(),
});

export const Route = createFileRoute("/api/public/v1/reports")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const { limit, offset, searchParams } = paging(request);
        let query = auth.admin
          .from("regulatory_reports")
          .select("id, case_id, report_type, jurisdiction, authority, status, reference, submitted_at, created_at")
          .eq("org_id", auth.orgId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        const status = searchParams.get("status");
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        if (error) return jsonResponse({ error: "query_failed", message: error.message }, 500);
        return jsonResponse({ data, paging: { limit, offset, count: data?.length ?? 0 } });
      },
      POST: async ({ request }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const parsed = await readJson(request, schema);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;
        const record = await loadCase(auth, body.case_id);
        if (!record) return jsonResponse({ error: "not_found", message: "Unknown case" }, 404);

        return withIdempotency(auth, request, "reports", async () => {
          const [{ data: hits }, { data: txs }, { data: txAlerts }] = await Promise.all([
            auth.admin.from("screening_hits").select("*").eq("case_id", body.case_id),
            auth.admin
              .from("transactions")
              .select("*")
              .eq("case_id", body.case_id)
              .order("occurred_at", { ascending: false })
              .limit(50),
            auth.admin.from("transaction_alerts").select("*").eq("case_id", body.case_id),
          ]);

          const r = record as any;
          const payload = {
            subject: {
              reference: r.reference,
              name: r.subject_name,
              type: r.case_type,
              country: r.country,
              riskLevel: r.risk_level,
              riskScore: r.risk_score,
            },
            screening: ((hits ?? []) as any[]).map((h) => ({
              name: h.matched_name,
              list: h.list_name,
              version: h.list_version,
              category: h.category,
              score: h.match_score,
              disposition: h.disposition,
            })),
            transactions: ((txs ?? []) as any[]).map((t) => ({
              date: t.occurred_at,
              direction: t.direction,
              method: t.method,
              amount: t.amount,
              currency: t.currency,
              amountCad: t.amount_cad,
              counterparty: t.counterparty_name,
              counterpartyCountry: t.counterparty_country,
            })),
            rulesTriggered: ((txAlerts ?? []) as any[]).map((a) => ({
              code: a.rule_code,
              name: a.rule_name,
              citation: a.citation,
            })),
            narrative: body.narrative ?? "",
            preparedAt: new Date().toISOString(),
          };

          const { data, error } = await auth.admin
            .from("regulatory_reports")
            .insert({
              case_id: body.case_id,
              org_id: auth.orgId,
              report_type: body.report_type,
              jurisdiction: body.jurisdiction.toUpperCase(),
              authority: body.authority,
              payload: payload as never,
            } as never)
            .select("id, case_id, report_type, jurisdiction, authority, status, created_at")
            .single();
          if (error) return jsonResponse({ error: "create_failed", message: error.message }, 500);

          await apiAudit(auth, "report.drafted", "report", (data as any).id, {
            report_type: body.report_type,
            jurisdiction: body.jurisdiction,
          });
          return jsonResponse({ data: { ...(data as Record<string, unknown>), payload } }, 201);
        });
      },
    },
  },
});
