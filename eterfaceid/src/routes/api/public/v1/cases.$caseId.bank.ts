import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  apiAudit,
  authenticateApiRequest,
  corsPreflight,
  jsonResponse,
  loadCase,
  readJson,
} from "@/lib/api-gateway.server";

const schema = z
  .object({ public_token: z.string().min(10).max(400).optional() })
  .default({});

async function plaidEnabled(auth: { admin: any }) {
  const { data } = await auth.admin
    .from("integration_settings")
    .select("enabled")
    .eq("provider", "plaid")
    .maybeSingle();
  return Boolean(data?.enabled);
}

export const Route = createFileRoute("/api/public/v1/cases/$caseId/bank")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      GET: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const [{ data: items }, { data: results }] = await Promise.all([
          auth.admin
            .from("plaid_items")
            .select("id, item_id, institution_name, environment, status, last_synced_at")
            .eq("case_id", params.caseId)
            .eq("org_id", auth.orgId),
          auth.admin
            .from("plaid_identity_results")
            .select("id, institution_name, comparisons, result, created_at")
            .eq("case_id", params.caseId)
            .eq("org_id", auth.orgId)
            .order("created_at", { ascending: false }),
        ]);
        return jsonResponse({ data: { items: items ?? [], identity_results: results ?? [] } });
      },
      POST: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const parsed = await readJson(request, schema);
        if (!parsed.ok) return parsed.response;
        const record = await loadCase(auth, params.caseId, "id, subject_name");
        if (!record) return jsonResponse({ error: "not_found", message: "Unknown case" }, 404);

        if (auth.sandbox) {
          const { sandboxLinkToken, sandboxBankIdentity } = await import("@/lib/sandbox.server");
          if (!parsed.data.public_token) {
            return jsonResponse({ data: { ...sandboxLinkToken(), environment: "sandbox" } });
          }
          const identity = sandboxBankIdentity(String((record as any).subject_name ?? ""));
          await apiAudit(auth, "bank.linked", "case", params.caseId, { sandbox: true });
          return jsonResponse({ data: { sandbox: true, item_id: `sandbox-item-${params.caseId}`, identity } });
        }


        if (!(await plaidEnabled(auth))) {
          return jsonResponse(
            { error: "integration_disabled", message: "Bank connections are switched off for this platform." },
            409,
          );
        }

        const { plaid, plaidConfigured, plaidEnvironment } = await import("@/lib/plaid.server");
        if (!plaidConfigured()) {
          return jsonResponse(
            { error: "integration_not_configured", message: "Bank connections are not configured yet." },
            409,
          );
        }

        try {
          if (!parsed.data.public_token) {
            const token = await plaid.createLinkToken(`case-${params.caseId}`, ["identity", "transactions"]);
            return jsonResponse({
              data: { link_token: token.link_token, expiration: token.expiration, environment: plaidEnvironment() },
            });
          }

          const exchanged = await plaid.exchangePublicToken(parsed.data.public_token);
          let institutionId: string | null = null;
          let institutionName: string | null = null;
          try {
            const identity = await plaid.identity(exchanged.access_token);
            institutionId = identity.item.institution_id ?? null;
            if (institutionId) institutionName = (await plaid.institution(institutionId)).institution.name;
          } catch {
            /* institution naming is cosmetic */
          }

          const { data: row, error } = await auth.admin
            .from("plaid_items")
            .insert({
              org_id: auth.orgId,
              case_id: params.caseId,
              item_id: exchanged.item_id,
              access_token: exchanged.access_token,
              institution_id: institutionId,
              institution_name: institutionName,
              environment: plaidEnvironment(),
            } as never)
            .select("id")
            .single();
          if (error) return jsonResponse({ error: "create_failed", message: error.message }, 500);

          await apiAudit(auth, "bank.linked", "case", params.caseId, { institution: institutionName });
          return jsonResponse({ data: { item_id: (row as any).id, institution: institutionName } }, 201);
        } catch (err) {
          return jsonResponse(
            { error: "bank_failed", message: err instanceof Error ? err.message : "bank request failed" },
            502,
          );
        }
      },
    },
  },
});
