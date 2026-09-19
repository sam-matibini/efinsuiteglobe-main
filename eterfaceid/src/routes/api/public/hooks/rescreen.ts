import { createFileRoute } from "@tanstack/react-router";

import { ENGINE_VERSION, normalizeName, scoreMatch } from "@/lib/name-match";

const TRIGRAM_FLOOR = 0.32;
const CANDIDATE_LIMIT = 300;
const THRESHOLD = 0.72;
const CASE_BATCH = 40;

/**
 * Ongoing rescreening. Re-checks existing customers against the watchlist
 * warehouse, opens a monitoring alert for anything new, and notifies the
 * owning company. Called by the scheduler with the shared secret.
 */
export const Route = createFileRoute("/api/public/hooks/rescreen")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronRequestAllowed } = await import("@/lib/cron-secret.server");
        if (!(await cronRequestAllowed(request))) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? CASE_BATCH) || CASE_BATCH, 200);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { notifyOrg } = await import("@/lib/usage.server");

        // Least-recently-updated open or approved cases first, so every
        // customer gets re-checked over successive runs.
        const { data: cases, error } = await supabaseAdmin
          .from("cases")
          .select("id, org_id, reference, subject_name, case_type, country")
          .in("status", ["pending", "in_review", "approved"])
          .order("updated_at", { ascending: true })
          .limit(limit);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        let scanned = 0;
        let newHits = 0;
        const notify = new Map<string, { org: string; subject: string; reference: string; caseId: string; count: number }>();

        for (const kase of cases ?? []) {
          scanned += 1;
          const query = normalizeName(kase.subject_name);
          if (!query) continue;

          const { data: candidates } = await supabaseAdmin.rpc("match_watchlist_names", {
            _q: query,
            _threshold: TRIGRAM_FLOOR,
            _limit: CANDIDATE_LIMIT,
          });
          const entityIds = [...new Set((candidates ?? []).map((c) => c.entity_id))];
          if (!entityIds.length) continue;

          const { data: entities } = await supabaseAdmin
            .from("watchlist_entities")
            .select("*")
            .in("id", entityIds)
            .is("removed_at", null);
          const entityMap = new Map((entities ?? []).map((e) => [e.id, e]));
          const sourceIds = [...new Set((entities ?? []).map((e) => e.source_id))];
          const { data: sources } = await supabaseAdmin
            .from("watchlist_sources")
            .select("id, title, category")
            .in("id", sourceIds);
          const sourceMap = new Map((sources ?? []).map((s) => [s.id, s]));

          const best = new Map<string, { score: number; reasons: string[]; matchedName: string }>();
          for (const candidate of candidates ?? []) {
            const entity = entityMap.get(candidate.entity_id);
            if (!entity) continue;
            const outcome = scoreMatch({
              query: kase.subject_name,
              candidate: candidate.matched_name,
              kind: kase.case_type === "business" ? "business" : "person",
              candidateBirthDate: entity.birth_date,
              queryCountry: kase.country,
              candidateCountries: entity.countries,
            });
            const prior = best.get(candidate.entity_id);
            if (!prior || outcome.score > prior.score) {
              best.set(candidate.entity_id, {
                score: outcome.score,
                reasons: outcome.reasons,
                matchedName: candidate.matched_name,
              });
            }
          }

          const passing = [...best.entries()]
            .filter(([, v]) => v.score >= THRESHOLD)
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, 25);
          if (!passing.length) continue;

          const { data: priorHits } = await supabaseAdmin
            .from("screening_hits")
            .select("entity_id")
            .eq("case_id", kase.id)
            .not("entity_id", "is", null);
          const seen = new Set((priorHits ?? []).map((h) => h.entity_id));
          const fresh = passing.filter(([entityId]) => !seen.has(entityId));
          if (!fresh.length) continue;

          const { data: run } = await supabaseAdmin
            .from("screening_runs")
            .insert({
              case_id: kase.id,
              org_id: kase.org_id,
              subject_name: kase.subject_name,
              subject_type: kase.case_type,
              country: kase.country,
              engine_version: ENGINE_VERSION,
              candidates_examined: entityIds.length,
              hit_count: fresh.length,
              threshold: THRESHOLD,
            })
            .select("id")
            .single();

          const inserts = fresh.map(([entityId, v]) => {
            const entity = entityMap.get(entityId)!;
            const source = sourceMap.get(entity.source_id);
            return {
              case_id: kase.id,
              org_id: kase.org_id,
              entity_id: entityId,
              run_id: run?.id ?? null,
              list_name: source?.title ?? "Watchlist",
              list_version: entity.last_change?.slice(0, 10) ?? null,
              matched_name: v.matchedName,
              match_score: v.score,
              category: (source?.category ?? "watchlist") as never,
              detail: v.reasons.join(". "),
              reasons: v.reasons as never,
              disposition: "open" as const,
            };
          });
          await supabaseAdmin.from("screening_hits").insert(inserts as never);

          await supabaseAdmin.from("monitoring_alerts").insert({
            case_id: kase.id,
            org_id: kase.org_id,
            alert_type: "screening_change",
            detail: `Ongoing rescreening found ${inserts.length} new possible match(es) for ${kase.subject_name}.`,
            status: "open",
          });

          await supabaseAdmin.from("audit_events").insert({
            org_id: kase.org_id,
            action: "screening.rescreen",
            entity_type: "case",
            entity_id: kase.id,
            detail: { engine: ENGINE_VERSION, new_hits: inserts.length } as never,
          });

          newHits += inserts.length;
          const key = `${kase.org_id}:${kase.id}`;
          notify.set(key, {
            org: kase.org_id as string,
            subject: kase.subject_name,
            reference: kase.reference,
            caseId: kase.id,
            count: inserts.length,
          });
        }

        for (const item of notify.values()) {
          await notifyOrg(item.org, "screening.hit", {
            subject: item.subject,
            reference: item.reference,
            count: String(item.count),
            link: `/console/cases/${item.caseId}`,
          });
        }

        return new Response(JSON.stringify({ ok: true, scanned, newHits }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
