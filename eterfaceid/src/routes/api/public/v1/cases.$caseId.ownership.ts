import { createFileRoute } from "@tanstack/react-router";

import {
  apiAudit,
  authenticateApiRequest,
  corsPreflight,
  jsonResponse,
  loadCase,
} from "@/lib/api-gateway.server";
import { computeEffectiveOwnership, fiftyPercentRule, type OwnerRow } from "@/lib/ownership";

export const Route = createFileRoute("/api/public/v1/cases/$caseId/ownership")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const record = await loadCase(auth, params.caseId, "id");
        if (!record) return jsonResponse({ error: "not_found", message: "Unknown case" }, 404);

        const { data: rows, error } = await auth.admin
          .from("business_owners")
          .select("id, name, entity_type, ownership_pct, parent_owner_id, control_role, screening_status")
          .eq("case_id", params.caseId)
          .eq("org_id", auth.orgId);
        if (error) return jsonResponse({ error: "query_failed", message: error.message }, 500);

        const owners = (rows ?? []) as unknown as OwnerRow[];
        const computed = computeEffectiveOwnership(owners);
        const rule = fiftyPercentRule(owners, computed);

        for (const owner of computed) {
          await auth.admin
            .from("business_owners")
            .update({
              effective_pct: owner.effectivePct,
              is_ubo: owner.isUbo,
              control_basis: owner.controlBasis,
            } as never)
            .eq("id", owner.id);
        }

        await auth.admin.from("case_checks").insert({
          case_id: params.caseId,
          org_id: auth.orgId,
          category: "ownership",
          name: "Beneficial ownership",
          result: rule.blocked ? "fail" : computed.some((c) => c.isUbo) ? "pass" : "review",
          detail: rule.blocked
            ? `Blocked persons hold ${rule.sanctionedOwnership}% in aggregate — treat the entity as blocked (${rule.citation}).`
            : `${computed.filter((c) => c.isUbo).length} beneficial owner(s) identified at or above 25%, or through control.`,
          source: "eterfaceID ownership engine",
        } as never);

        await apiAudit(auth, "ownership.computed", "case", params.caseId, {
          blocked: rule.blocked,
          sanctioned_ownership: rule.sanctionedOwnership,
        });

        return jsonResponse({ data: { owners: computed, rule } });
      },
    },
  },
});
