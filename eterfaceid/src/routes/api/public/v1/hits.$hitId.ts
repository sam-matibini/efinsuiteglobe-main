import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  apiAudit,
  authenticateApiRequest,
  corsPreflight,
  jsonResponse,
  readJson,
} from "@/lib/api-gateway.server";

const schema = z.object({
  disposition: z.enum(["open", "true_positive", "false_positive", "escalated"]),
  note: z.string().trim().max(1000).optional(),
});

export const Route = createFileRoute("/api/public/v1/hits/$hitId")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      PATCH: async ({ request, params }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const parsed = await readJson(request, schema);
        if (!parsed.ok) return parsed.response;

        const { data, error } = await auth.admin
          .from("screening_hits")
          .update({
            disposition: parsed.data.disposition as never,
            decision_note: parsed.data.note ?? null,
            decided_at: new Date().toISOString(),
          } as never)
          .eq("id", params.hitId)
          .eq("org_id", auth.orgId)
          .select("id, case_id, matched_name, disposition, decision_note, decided_at")
          .maybeSingle();
        if (error) return jsonResponse({ error: "update_failed", message: error.message }, 500);
        if (!data) return jsonResponse({ error: "not_found", message: "Unknown match" }, 404);

        await apiAudit(auth, "screening.hit_disposition", "screening_hit", params.hitId, {
          disposition: parsed.data.disposition,
        });
        return jsonResponse({ data });
      },
    },
  },
});
