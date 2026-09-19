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
import { addressResult, validateAddress, validateAge } from "@/lib/address-rules";

const schema = z.object({
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  region: z.string().trim().max(60).optional(),
  postal_code: z.string().trim().max(20).optional(),
  country: z.string().trim().length(2).default("CA"),
  birth_date: z.string().trim().max(10).optional(),
});

export const Route = createFileRoute("/api/public/v1/cases/$caseId/addresses")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const { data, error } = await auth.admin
          .from("case_addresses")
          .select("id, line1, line2, city, region, postal_code, country, result, checks, created_at")
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
        const record = await loadCase(auth, params.caseId, "id");
        if (!record) return jsonResponse({ error: "not_found", message: "Unknown case" }, 404);
        const body = parsed.data;

        return withIdempotency(auth, request, "addresses", async () => {
          const checks = validateAddress({
            line1: body.line1,
            line2: body.line2,
            city: body.city,
            region: body.region,
            postalCode: body.postal_code,
            country: body.country.toUpperCase(),
          });
          const result = addressResult(checks);

          const { error } = await auth.admin.from("case_addresses").insert({
            case_id: params.caseId,
            org_id: auth.orgId,
            line1: body.line1,
            line2: body.line2 ?? null,
            city: body.city ?? null,
            region: body.region ?? null,
            postal_code: body.postal_code ?? null,
            country: body.country.toUpperCase(),
            result,
            checks: checks as never,
          } as never);
          if (error) return jsonResponse({ error: "create_failed", message: error.message }, 500);

          await auth.admin.from("case_checks").insert({
            case_id: params.caseId,
            org_id: auth.orgId,
            category: "address",
            name: "Address verification",
            result,
            detail: checks.filter((c) => !c.ok).map((c) => c.name).join("; ") || "All address checks passed",
            source: "eterfaceID address engine",
          } as never);

          let age: ReturnType<typeof validateAge> | null = null;
          if (body.birth_date) {
            age = validateAge(body.birth_date);
            await auth.admin.from("case_checks").insert({
              case_id: params.caseId,
              org_id: auth.orgId,
              category: "identity",
              name: "Age and date of birth",
              result: age.valid ? "pass" : "fail",
              detail: age.detail,
              source: "eterfaceID identity engine",
            } as never);
          }

          await apiAudit(auth, "address.verified", "case", params.caseId, { result });
          return jsonResponse({ data: { result, checks, age } }, 201);
        });
      },
    },
  },
});
