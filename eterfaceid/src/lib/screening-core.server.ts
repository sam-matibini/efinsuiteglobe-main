/**
 * Runs the eterfaceID screening engine against a case on behalf of an API
 * caller. Same candidate selection, scoring and hit rules as the console.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { ENGINE_VERSION, normalizeName, scoreMatch } from "@/lib/name-match";

type Client = SupabaseClient<Database>;

const CANDIDATE_LIMIT = 400;
const TRIGRAM_FLOOR = 0.32;

export async function screenCaseWithAdmin(
  admin: Client,
  args: { caseId: string; orgId: string; threshold?: number },
) {
  const threshold = args.threshold ?? 0.72;
  const { data: caseRow } = await admin.from("cases").select("*").eq("id", args.caseId).maybeSingle();
  if (!caseRow) throw new Error("Case not found");
  const record = caseRow as any;

  const kind: "person" | "business" = record.case_type === "business" ? "business" : "person";
  const { data: candidates, error: matchError } = await admin.rpc("match_watchlist_names", {
    _q: normalizeName(record.subject_name),
    _threshold: TRIGRAM_FLOOR,
    _limit: CANDIDATE_LIMIT,
  });
  if (matchError) throw new Error(matchError.message);

  const rows = (candidates ?? []) as any[];
  const entityIds = [...new Set(rows.map((c) => c.entity_id))];
  const entityMap = new Map<string, any>();
  const sourceMap = new Map<string, { code: string; title: string; category: string }>();

  if (entityIds.length) {
    const { data: entities } = await admin.from("watchlist_entities").select("*").in("id", entityIds);
    for (const e of (entities ?? []) as any[]) entityMap.set(e.id, e);
    const sourceIds = [...new Set(((entities ?? []) as any[]).map((e) => e.source_id))];
    const { data: sources } = await admin
      .from("watchlist_sources")
      .select("id, code, title, category")
      .in("id", sourceIds);
    for (const s of (sources ?? []) as any[]) sourceMap.set(s.id, s);
  }

  const best = new Map<string, { score: number; reasons: string[]; matchedName: string }>();
  for (const candidate of rows) {
    const entity = entityMap.get(candidate.entity_id);
    if (!entity) continue;
    const outcome = scoreMatch({
      query: record.subject_name,
      candidate: candidate.matched_name,
      kind,
      candidateBirthDate: entity.birth_date ?? null,
      queryCountry: record.country,
      candidateCountries: entity.countries ?? [],
    });
    const prior = best.get(candidate.entity_id);
    if (!prior || outcome.score > prior.score) {
      const reasons = [...outcome.reasons];
      if (candidate.kind === "alias") reasons.unshift(`Matched on a recorded alias: ${candidate.matched_name}`);
      best.set(candidate.entity_id, { score: outcome.score, reasons, matchedName: candidate.matched_name });
    }
  }

  const passing = [...best.entries()]
    .filter(([, v]) => v.score >= threshold)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 50);

  const { data: run, error: runError } = await admin
    .from("screening_runs")
    .insert({
      case_id: record.id,
      org_id: args.orgId,
      subject_name: record.subject_name,
      subject_type: record.case_type,
      country: record.country,
      engine_version: ENGINE_VERSION,
      candidates_examined: entityIds.length,
      hit_count: passing.length,
      threshold,
    } as never)
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);

  const { data: priorHits } = await admin
    .from("screening_hits")
    .select("entity_id")
    .eq("case_id", record.id)
    .not("entity_id", "is", null);
  const seen = new Set(((priorHits ?? []) as any[]).map((h) => h.entity_id));

  const inserts = passing
    .filter(([entityId]) => !seen.has(entityId))
    .map(([entityId, v]) => {
      const entity = entityMap.get(entityId)!;
      const source = sourceMap.get(entity.source_id);
      return {
        case_id: record.id,
        org_id: args.orgId,
        entity_id: entityId,
        run_id: (run as any).id,
        list_name: source?.title ?? "Watchlist",
        list_version: (entity.last_change as string | null)?.slice(0, 10) ?? null,
        matched_name: v.matchedName,
        match_score: v.score,
        category: source?.category ?? "watchlist",
        detail: v.reasons.join(". "),
        reasons: v.reasons,
        disposition: "open",
      };
    });

  if (inserts.length) {
    const { error: hitError } = await admin.from("screening_hits").insert(inserts as never);
    if (hitError) throw new Error(hitError.message);
  }

  const topScore = passing.length ? passing[0]![1].score : 0;
  const listCount = new Set(passing.map(([id]) => entityMap.get(id)?.source_id)).size;
  const riskScore = Math.min(100, Math.round(topScore * 85 + Math.min(listCount, 3) * 5));
  const riskLevel = riskScore >= 70 ? "high" : riskScore >= 40 ? "medium" : "low";

  await admin.from("cases").update({ risk_score: riskScore, risk_level: riskLevel as never }).eq("id", record.id);

  return {
    run_id: (run as any).id as string,
    candidates: entityIds.length,
    hits: passing.length,
    new_hits: inserts.length,
    risk_score: riskScore,
    risk_level: riskLevel,
    engine_version: ENGINE_VERSION,
  };
}
