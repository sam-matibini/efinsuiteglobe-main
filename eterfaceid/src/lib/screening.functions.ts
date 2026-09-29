import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { ENGINE_VERSION, normalizeName, scoreMatch } from "./name-match";

interface ScreenInput {
  caseId: string;
  threshold?: number;
}

const CANDIDATE_LIMIT = 400;
const TRIGRAM_FLOOR = 0.32;

/**
 * Run our own screening engine over a case subject.
 * Candidate selection happens in Postgres (trigram); the decision and the
 * explanation are produced by our matching engine.
 */
export const screenCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ScreenInput) => input)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const threshold = data.threshold ?? 0.72;

    const { data: caseRow, error: caseError } = await supabase
      .from("cases")
      .select("*")
      .eq("id", data.caseId)
      .maybeSingle();
    if (caseError) throw caseError;
    if (!caseRow) throw new Error("Case not found");

    const kind: "person" | "business" = caseRow.case_type === "business" ? "business" : "person";
    const query = normalizeName(caseRow.subject_name);

    const { data: candidates, error: matchError } = await supabase.rpc("match_watchlist_names", {
      _q: query,
      _threshold: TRIGRAM_FLOOR,
      _limit: CANDIDATE_LIMIT,
    });
    if (matchError) throw matchError;

    const entityIds = [...new Set((candidates ?? []).map((c) => c.entity_id))];
    const entityMap = new Map<string, Record<string, unknown>>();
    const sourceMap = new Map<string, { code: string; title: string; category: string }>();

    if (entityIds.length) {
      const { data: entities, error: entityError } = await supabase
        .from("watchlist_entities")
        .select("*")
        .in("id", entityIds);
      if (entityError) throw entityError;
      for (const e of entities ?? []) entityMap.set(e.id, e as unknown as Record<string, unknown>);

      const sourceIds = [...new Set((entities ?? []).map((e) => e.source_id))];
      const { data: sources, error: sourceError } = await supabase
        .from("watchlist_sources")
        .select("id, code, title, category")
        .in("id", sourceIds);
      if (sourceError) throw sourceError;
      for (const s of sources ?? []) sourceMap.set(s.id, s);
    }

    // Best scoring name per entity.
    const best = new Map<string, { score: number; reasons: string[]; matchedName: string }>();
    for (const candidate of candidates ?? []) {
      const entity = entityMap.get(candidate.entity_id);
      if (!entity) continue;
      const outcome = scoreMatch({
        query: caseRow.subject_name,
        candidate: candidate.matched_name,
        kind,
        candidateBirthDate: (entity["birth_date"] as string | null) ?? null,
        queryCountry: caseRow.country,
        candidateCountries: (entity["countries"] as string[] | null) ?? [],
      });
      const prior = best.get(candidate.entity_id);
      if (!prior || outcome.score > prior.score) {
        const reasons = [...outcome.reasons];
        if (candidate.kind === "alias") reasons.unshift(`Matched on a recorded alias: ${candidate.matched_name}`);
        best.set(candidate.entity_id, {
          score: outcome.score,
          reasons,
          matchedName: candidate.matched_name,
        });
      }
    }

    const passing = [...best.entries()]
      .filter(([, v]) => v.score >= threshold)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 50);

    const { data: run, error: runError } = await supabase
      .from("screening_runs")
      .insert({
        case_id: caseRow.id,
        subject_name: caseRow.subject_name,
        subject_type: caseRow.case_type,
        country: caseRow.country,
        engine_version: ENGINE_VERSION,
        candidates_examined: entityIds.length,
        hit_count: passing.length,
        threshold,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (runError) throw runError;

    const { data: priorHits } = await supabase
      .from("screening_hits")
      .select("entity_id")
      .eq("case_id", caseRow.id)
      .not("entity_id", "is", null);
    const seen = new Set((priorHits ?? []).map((h) => h.entity_id));

    const inserts = passing
      .filter(([entityId]) => !seen.has(entityId))
      .map(([entityId, v]) => {
        const entity = entityMap.get(entityId)!;
        const source = sourceMap.get(entity["source_id"] as string);
        return {
          case_id: caseRow.id,
          entity_id: entityId,
          run_id: run.id,
          list_name: source?.title ?? "Watchlist",
          list_version: (entity["last_change"] as string | null)?.slice(0, 10) ?? null,
          matched_name: v.matchedName,
          match_score: v.score,
          category: (source?.category ?? "watchlist") as never,
          detail: v.reasons.join(". "),
          reasons: v.reasons as never,
          disposition: "open" as const,
        };
      });

    if (inserts.length) {
      const { error: hitError } = await supabase.from("screening_hits").insert(inserts as never);
      if (hitError) throw hitError;
    }

    // Risk score from the strongest open hit plus the number of lists touched.
    const topScore = passing.length ? passing[0]![1].score : 0;
    const listCount = new Set(passing.map(([id]) => entityMap.get(id)?.["source_id"])).size;
    const riskScore = Math.min(100, Math.round(topScore * 85 + Math.min(listCount, 3) * 5));
    const riskLevel = riskScore >= 70 ? "high" : riskScore >= 40 ? "medium" : "low";

    await supabase
      .from("cases")
      .update({ risk_score: riskScore, risk_level: riskLevel as never })
      .eq("id", caseRow.id);

    await supabase.from("audit_events").insert({
      actor_id: context.userId,
      actor_email: context.claims?.email ?? null,
      action: "screening.run",
      entity_type: "case",
      entity_id: caseRow.id,
      detail: {
        engine: ENGINE_VERSION,
        candidates: entityIds.length,
        hits: passing.length,
        new_hits: inserts.length,
        threshold,
      } as never,
    });

    const orgId = (caseRow as any).org_id as string | undefined;
    const { recordUsage, notifyOrg } = await import("@/lib/usage.server");
    await recordUsage(supabase as never, orgId, "screenings");
    if (orgId && inserts.length) {
      await notifyOrg(orgId, "screening.hit", {
        subject: caseRow.subject_name,
        reference: (caseRow as any).reference ?? "",
        count: String(inserts.length),
        link: `/console/cases/${caseRow.id}`,
      });
    }

    return {
      runId: run.id,
      candidates: entityIds.length,
      hits: passing.length,
      newHits: inserts.length,
      riskScore,
      riskLevel,
    };
  });

/** Ad-hoc screening from the console, not tied to a case. */
export const screenName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      kind?: "person" | "business" | undefined;
      birthDate?: string | undefined;
      country?: string | undefined;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    const query = normalizeName(data.name);
    if (!query) return { results: [], candidates: 0 };

    const { data: candidates, error } = await supabase.rpc("match_watchlist_names", {
      _q: query,
      _threshold: TRIGRAM_FLOOR,
      _limit: CANDIDATE_LIMIT,
    });
    if (error) throw error;

    const entityIds = [...new Set((candidates ?? []).map((c) => c.entity_id))];
    if (!entityIds.length) return { results: [], candidates: 0 };

    const { data: entities } = await supabase.from("watchlist_entities").select("*").in("id", entityIds);
    const entityMap = new Map((entities ?? []).map((e) => [e.id, e]));
    const sourceIds = [...new Set((entities ?? []).map((e) => e.source_id))];
    const { data: sources } = await supabase
      .from("watchlist_sources")
      .select("id, title, category")
      .in("id", sourceIds);
    const sourceMap = new Map((sources ?? []).map((s) => [s.id, s]));

    const best = new Map<string, { score: number; reasons: string[]; matchedName: string }>();
    for (const candidate of candidates ?? []) {
      const entity = entityMap.get(candidate.entity_id);
      if (!entity) continue;
      const outcome = scoreMatch({
        query: data.name,
        candidate: candidate.matched_name,
        kind: data.kind ?? "person",
        queryBirthDate: data.birthDate ?? null,
        candidateBirthDate: entity.birth_date,
        queryCountry: data.country ?? null,
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

    const results = [...best.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 25)
      .map(([entityId, v]) => {
        const entity = entityMap.get(entityId)!;
        const source = sourceMap.get(entity.source_id);
        return {
          entityId,
          name: entity.name,
          matchedName: v.matchedName,
          score: v.score,
          reasons: v.reasons,
          birthDate: entity.birth_date,
          countries: entity.countries,
          programs: entity.programs,
          listTitle: source?.title ?? "Watchlist",
          category: source?.category ?? "watchlist",
        };
      });

    return { results, candidates: entityIds.length };
  });
