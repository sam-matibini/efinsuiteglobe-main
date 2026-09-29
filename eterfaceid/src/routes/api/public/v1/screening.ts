import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticateApiRequest, corsPreflight, dispatchWebhook, jsonResponse } from "@/lib/api-gateway.server";
import { normalizeName, scoreMatch, ENGINE_VERSION } from "@/lib/name-match";

const schema = z.object({
  name: z.string().trim().min(2).max(200),
  birth_date: z.string().trim().optional(),
  country: z.string().trim().length(2).optional(),
  threshold: z.number().min(0.3).max(1).optional(),
  case_id: z.string().uuid().optional(),
  entity_type: z.enum(["person", "business"]).optional(),
});

export const Route = createFileRoute("/api/public/v1/screening")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) => {
        const auth = await authenticateApiRequest(request);
        if (auth instanceof Response) return auth;
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return jsonResponse({ error: "invalid_request", issues: parsed.error.issues }, 422);

        if (auth.sandbox) {
          const { sandboxScreening } = await import("@/lib/sandbox.server");
          const sim = sandboxScreening(parsed.data.name);
          return jsonResponse({
            engine: ENGINE_VERSION,
            threshold: parsed.data.threshold ?? 0.72,
            candidates_examined: sim.candidates,
            sandbox: true,
            data: sim.hits.map((h) => ({
              entity_id: null,
              name: h.matched_name,
              list: h.list_name,
              list_code: "sandbox",
              category: h.category,
              programs: null,
              birth_date: null,
              countries: [],
              score: h.match_score,
              reasons: h.reasons.map((r) => r.label),
            })),
          });
        }

        const threshold = parsed.data.threshold ?? 0.72;

        const { data: candidates, error } = await auth.admin.rpc("match_watchlist_names", {
          _q: normalizeName(parsed.data.name),
          _threshold: 0.45,
          _limit: 250,
        });
        if (error) return jsonResponse({ error: "screening_failed", message: error.message }, 500);

        const ids = Array.from(new Set(((candidates ?? []) as any[]).map((c) => c.entity_id)));
        const { data: entities } = await auth.admin
          .from("watchlist_entities")
          .select("id, name, aliases, birth_date, countries, programs, source_id, watchlist_sources(code, title, category)")
          .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

        const results = ((entities ?? []) as any[])
          .map((e) => {
            const kind = parsed.data.entity_type ?? "person";
            const names: string[] = [e.name, ...((e.aliases ?? []) as string[])];
            let scored = { score: 0, nameScore: 0, reasons: ["No comparable name tokens"] as string[] };
            for (const candidateName of names) {
              const outcome = scoreMatch({
                query: parsed.data.name,
                candidate: candidateName,
                kind,
                queryBirthDate: parsed.data.birth_date ?? null,
                candidateBirthDate: e.birth_date ?? null,
                queryCountry: parsed.data.country ?? null,
                candidateCountries: (e.countries ?? []) as string[],
              });
              if (outcome.score > scored.score) scored = outcome;
            }
            return {
              entity_id: e.id,
              name: e.name,
              list: e.watchlist_sources?.title ?? null,
              list_code: e.watchlist_sources?.code ?? null,
              category: e.watchlist_sources?.category ?? null,
              programs: e.programs,
              birth_date: e.birth_date,
              countries: e.countries,
              score: scored.score,
              reasons: scored.reasons,
            };
          })
          .filter((r) => r.score >= threshold)
          .sort((a, b) => b.score - a.score)
          .slice(0, 50);

        await auth.admin.from("screening_runs").insert({
          org_id: auth.orgId,
          case_id: parsed.data.case_id ?? null,
          subject_name: parsed.data.name,
          subject_type: parsed.data.entity_type ?? "person",
          birth_date: parsed.data.birth_date ?? null,
          country: parsed.data.country?.toUpperCase() ?? null,
          engine_version: ENGINE_VERSION,
          candidates_examined: ids.length,
          hit_count: results.length,
          threshold,
        });

        if (results.length) {
          await dispatchWebhook(auth.admin, auth.orgId, auth.environment, "screening.hits", {
            name: parsed.data.name,
            case_id: parsed.data.case_id ?? null,
            hits: results.length,
          });
        }

        return jsonResponse({ engine: ENGINE_VERSION, threshold, candidates_examined: ids.length, data: results });
      },
    },
  },
});
