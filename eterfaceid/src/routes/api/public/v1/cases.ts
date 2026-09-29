import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  authenticateApiRequest,
  corsPreflight,
  dispatchWebhook,
  jsonResponse,
  paging,
  withIdempotency,
} from "@/lib/api-gateway.server";

const createSchema = z.object({
  case_type: z.enum(["person", "business"]),
  subject_name: z.string().trim().min(2).max(200),
  country: z.string().trim().length(2).optional(),
  reference: z.string().trim().max(60).optional(),
});

export const Route = createFileRoute("/api/public/v1/cases")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const { limit, offset, searchParams } = paging(request);
        let query = auth.admin
          .from("cases")
          .select("id, reference, case_type, subject_name, country, status, risk_level, risk_score, created_at")
          .eq("org_id", auth.orgId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);
        const status = searchParams.get("status");
        const caseType = searchParams.get("case_type");
        if (status) query = query.eq("status", status as never);
        if (caseType) query = query.eq("case_type", caseType as never);
        const { data, error } = await query;
        if (error) return jsonResponse({ error: "query_failed", message: error.message }, 500);
        return jsonResponse({ data, paging: { limit, offset, count: data?.length ?? 0 } });
      },
      POST: async ({ request }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const parsed = createSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return jsonResponse({ error: "invalid_request", issues: parsed.error.issues }, 422);
        }
        return withIdempotency(auth, request, "cases", async () => {
        const reference = parsed.data.reference ?? `API-${Date.now().toString(36).toUpperCase()}`;
        const { data, error } = await auth.admin
          .from("cases")
          .insert({
            org_id: auth.orgId,
            reference,
            case_type: parsed.data.case_type,
            subject_name: parsed.data.subject_name,
            country: parsed.data.country?.toUpperCase() ?? null,
          })
          .select("id, reference, case_type, subject_name, country, status, risk_level, risk_score, created_at")
          .single();
        if (error) return jsonResponse({ error: "create_failed", message: error.message }, 500);

        await auth.admin.from("audit_events").insert({
          org_id: auth.orgId,
          action: "case.created.api",
          entity_type: "case",
          entity_id: (data as any).id,
          detail: { environment: auth.environment, reference },
        });
        await dispatchWebhook(auth.admin, auth.orgId, auth.environment, "case.created", data as Record<string, unknown>);
        return jsonResponse({ data }, 201);
        });
      },
    },
  },
});
