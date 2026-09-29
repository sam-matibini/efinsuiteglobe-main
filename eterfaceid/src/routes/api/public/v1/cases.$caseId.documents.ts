import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  apiAudit,
  authenticateApiRequest,
  corsPreflight,
  countUsage,
  dispatchWebhook,
  jsonResponse,
  loadCase,
  readJson,
  withIdempotency,
} from "@/lib/api-gateway.server";
import { processDocument } from "@/lib/verification-core.server";

const schema = z.object({
  doc_type: z.string().trim().min(2).max(60),
  mrz: z.string().trim().max(200).optional(),
  issuing_country: z.string().trim().max(3).optional(),
  issuing_region: z.string().trim().max(10).optional(),
  document_number: z.string().trim().max(60).optional(),
  surname: z.string().trim().max(120).optional(),
  given_names: z.string().trim().max(120).optional(),
  birth_date: z.string().trim().max(10).optional(),
  issue_date: z.string().trim().max(10).optional(),
  expiry_date: z.string().trim().max(10).optional(),
});

export const Route = createFileRoute("/api/public/v1/cases/$caseId/documents")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const { data, error } = await auth.admin
          .from("documents")
          .select("id, doc_type, issuing_country, document_number, birth_date, expiry_date, mrz_valid, result, checks, created_at")
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

        return withIdempotency(auth, request, "documents", async () => {
          try {
            const outcome = await processDocument(auth.admin, {
              caseId: params.caseId,
              orgId: auth.orgId,
              input: {
                docType: body.doc_type,
                mrz: body.mrz ?? null,
                issuingCountry: body.issuing_country ?? null,
                issuingRegion: body.issuing_region ?? null,
                documentNumber: body.document_number ?? null,
                surname: body.surname ?? null,
                givenNames: body.given_names ?? null,
                birthDate: body.birth_date ?? null,
                issueDate: body.issue_date ?? null,
                expiryDate: body.expiry_date ?? null,
              },
            });
            await apiAudit(auth, "document.verified", "document", outcome.documentId, {
              case_id: params.caseId,
              result: outcome.result,
            });
            await countUsage(auth, "verifications");
            await dispatchWebhook(auth.admin, auth.orgId, auth.environment, "verification.completed", {
              case_id: params.caseId,
              kind: "document",
              document_id: outcome.documentId,
              result: outcome.result,
            });
            return jsonResponse({ data: outcome }, 201);
          } catch (err) {
            return jsonResponse(
              { error: "document_failed", message: err instanceof Error ? err.message : "document check failed" },
              500,
            );
          }
        });
      },
    },
  },
});
