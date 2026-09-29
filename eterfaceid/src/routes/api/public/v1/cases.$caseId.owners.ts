import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  apiAudit,
  authenticateApiRequest,
  corsPreflight,
  jsonResponse,
  loadCase,
  readJson,
  withIdempotency,
} from "@/lib/api-gateway.server";

const schema = z.object({
  name: z.string().trim().min(2).max(200),
  entity_type: z.enum(["person", "business"]).default("person"),
  ownership_pct: z.number().min(0).max(100).optional(),
  parent_owner_id: z.string().uuid().optional(),
  control_role: z.string().trim().max(120).optional(),
  country: z.string().trim().length(2).optional(),
  birth_date: z.string().trim().max(10).optional(),
});

export const Route = createFileRoute("/api/public/v1/cases/$caseId/owners")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const { data, error } = await auth.admin
          .from("business_owners")
          .select(
            "id, name, entity_type, ownership_pct, effective_pct, is_ubo, control_basis, control_role, parent_owner_id, country, birth_date, screening_status",
          )
          .eq("case_id", params.caseId)
          .eq("org_id", auth.orgId)
          .order("ownership_pct", { ascending: false });
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

        return withIdempotency(auth, request, "owners", async () => {
          const { data, error } = await auth.admin
            .from("business_owners")
            .insert({
              case_id: params.caseId,
              org_id: auth.orgId,
              name: body.name,
              entity_type: body.entity_type,
              ownership_pct: body.ownership_pct ?? null,
              parent_owner_id: body.parent_owner_id ?? null,
              control_role: body.control_role ?? null,
              country: body.country?.toUpperCase() ?? null,
              birth_date: body.birth_date ?? null,
            } as never)
            .select("id, name, entity_type, ownership_pct, parent_owner_id, control_role, country, birth_date")
            .single();
          if (error) return jsonResponse({ error: "create_failed", message: error.message }, 500);
          await apiAudit(auth, "owner.added", "case", params.caseId, { owner: body.name });
          return jsonResponse({ data }, 201);
        });
      },
    },
  },
});
