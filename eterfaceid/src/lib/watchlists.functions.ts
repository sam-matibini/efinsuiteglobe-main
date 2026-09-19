import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { parseCsv, rowsToObjects } from "./csv";
import { normalizeName } from "./name-match";

const CHUNK = 2500;

interface RefreshInput {
  code: string;
  offset?: number;
  versionId?: string | null;
}

async function sha1(input: string) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function splitList(value: string): string[] {
  return value
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Ingest one official list into our own warehouse.
 *
 * Runs in slices so each invocation stays well inside the request budget; the
 * caller keeps calling with the returned offset until `done` is true.
 */
export const refreshWatchlistSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RefreshInput) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only administrators can refresh watchlists");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: source, error: sourceError } = await supabaseAdmin
      .from("watchlist_sources")
      .select("*")
      .eq("code", data.code)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!source) throw new Error(`Unknown list source: ${data.code}`);

    const offset = data.offset ?? 0;
    let versionId = data.versionId ?? null;

    const response = await fetch(source.feed_url, {
      headers: { "user-agent": "eterfaceID-watchlist-ingest/1.0" },
    });
    if (!response.ok) {
      const body = await response.text();
      if (versionId) {
        await supabaseAdmin
          .from("watchlist_versions")
          .update({ status: "failed", error_detail: `HTTP ${response.status}`, completed_at: new Date().toISOString() })
          .eq("id", versionId);
      }
      throw new Error(`Source fetch failed [${response.status}]: ${body.slice(0, 300)}`);
    }

    const records = rowsToObjects(parseCsv(await response.text()));
    const total = records.length;

    if (!versionId) {
      const latestChange = records.reduce((acc, r) => {
        const v = r["last_change"] ?? "";
        return v > acc ? v : acc;
      }, "");
      const { data: version, error: versionError } = await supabaseAdmin
        .from("watchlist_versions")
        .insert({
          source_id: source.id,
          version_label: (latestChange || new Date().toISOString()).slice(0, 19),
          status: "running",
          row_count: total,
        })
        .select("id")
        .single();
      if (versionError) throw versionError;
      versionId = version.id;
    }

    const slice = records.slice(offset, offset + CHUNK);
    let added = 0;
    let changed = 0;

    // Which of these external ids do we already hold, and at what content hash?
    const externalIds = slice.map((r) => r["id"] ?? "").filter(Boolean);
    const existing = new Map<string, { id: string; content_hash: string }>();
    for (let i = 0; i < externalIds.length; i += 500) {
      const { data: rows, error } = await supabaseAdmin
        .from("watchlist_entities")
        .select("id, external_id, content_hash")
        .eq("source_id", source.id)
        .in("external_id", externalIds.slice(i, i + 500));
      if (error) throw error;
      for (const row of rows ?? []) existing.set(row.external_id, { id: row.id, content_hash: row.content_hash });
    }

    const upserts: Record<string, unknown>[] = [];
    const nameSets: { externalId: string; names: { name: string; kind: string }[] }[] = [];

    for (const record of slice) {
      const externalId = record["id"] ?? "";
      if (!externalId) continue;
      const name = (record["name"] ?? "").trim();
      if (!name) continue;
      const aliases = splitList(record["aliases"] ?? "");
      const hash = await sha1(
        [name, aliases.join("|"), record["birth_date"], record["countries"], record["identifiers"], record["sanctions"], record["last_change"]].join("~"),
      );
      const prior = existing.get(externalId);
      if (prior?.content_hash === hash) {
        // Unchanged: just stamp it with the current version so it is not
        // treated as removed at the end of the run.
        upserts.push({
          source_id: source.id,
          external_id: externalId,
          version_id: versionId,
          entity_schema: record["schema"] || "Person",
          name,
          name_norm: normalizeName(name),
          aliases,
          birth_date: record["birth_date"] || null,
          countries: splitList(record["countries"] ?? ""),
          identifiers: record["identifiers"] || null,
          programs: record["sanctions"] || record["program_ids"] || null,
          content_hash: hash,
          last_change: record["last_change"] || null,
          removed_at: null,
          updated_at: new Date().toISOString(),
        });
        continue;
      }
      if (prior) changed += 1;
      else added += 1;
      upserts.push({
        source_id: source.id,
        external_id: externalId,
        version_id: versionId,
        entity_schema: record["schema"] || "Person",
        name,
        name_norm: normalizeName(name),
        aliases,
        birth_date: record["birth_date"] || null,
        countries: splitList(record["countries"] ?? ""),
        identifiers: record["identifiers"] || null,
        programs: record["sanctions"] || record["program_ids"] || null,
        content_hash: hash,
        last_change: record["last_change"] || null,
        removed_at: null,
        updated_at: new Date().toISOString(),
      });
      nameSets.push({
        externalId,
        names: [
          { name, kind: "primary" },
          ...aliases.map((a) => ({ name: a, kind: "alias" })),
        ],
      });
    }

    for (let i = 0; i < upserts.length; i += 500) {
      const { error } = await supabaseAdmin
        .from("watchlist_entities")
        .upsert(upserts.slice(i, i + 500) as never, { onConflict: "source_id,external_id" });
      if (error) throw error;
    }

    if (nameSets.length) {
      const ids = nameSets.map((n) => n.externalId);
      const idMap = new Map<string, string>();
      for (let i = 0; i < ids.length; i += 500) {
        const { data: rows, error } = await supabaseAdmin
          .from("watchlist_entities")
          .select("id, external_id")
          .eq("source_id", source.id)
          .in("external_id", ids.slice(i, i + 500));
        if (error) throw error;
        for (const row of rows ?? []) idMap.set(row.external_id, row.id);
      }
      const entityIds = [...idMap.values()];
      for (let i = 0; i < entityIds.length; i += 200) {
        const { error } = await supabaseAdmin
          .from("watchlist_names")
          .delete()
          .in("entity_id", entityIds.slice(i, i + 200));
        if (error) throw error;
      }
      const nameRows: Record<string, unknown>[] = [];
      for (const set of nameSets) {
        const entityId = idMap.get(set.externalId);
        if (!entityId) continue;
        const seen = new Set<string>();
        for (const n of set.names) {
          const norm = normalizeName(n.name);
          if (!norm || seen.has(norm)) continue;
          seen.add(norm);
          nameRows.push({
            entity_id: entityId,
            source_id: source.id,
            name: n.name,
            name_norm: norm,
            kind: n.kind,
          });
        }
      }
      for (let i = 0; i < nameRows.length; i += 1000) {
        const { error } = await supabaseAdmin.from("watchlist_names").insert(nameRows.slice(i, i + 1000) as never);
        if (error) throw error;
      }
    }

    const nextOffset = offset + CHUNK;
    const done = nextOffset >= total;

    // Accumulate counters on the version row.
    const { data: versionRow } = await supabaseAdmin
      .from("watchlist_versions")
      .select("added_count, changed_count")
      .eq("id", versionId)
      .maybeSingle();

    let removed = 0;
    if (done) {
      const { data: removedRows, error: removeError } = await supabaseAdmin
        .from("watchlist_entities")
        .update({ removed_at: new Date().toISOString() })
        .eq("source_id", source.id)
        .neq("version_id", versionId)
        .is("removed_at", null)
        .select("id");
      if (removeError) throw removeError;
      removed = removedRows?.length ?? 0;
    }

    await supabaseAdmin
      .from("watchlist_versions")
      .update({
        added_count: (versionRow?.added_count ?? 0) + added,
        changed_count: (versionRow?.changed_count ?? 0) + changed,
        removed_count: removed,
        status: done ? "complete" : "running",
        completed_at: done ? new Date().toISOString() : null,
      })
      .eq("id", versionId);

    if (done) {
      const { count } = await supabaseAdmin
        .from("watchlist_entities")
        .select("id", { count: "exact", head: true })
        .eq("source_id", source.id)
        .is("removed_at", null);
      await supabaseAdmin
        .from("watchlist_sources")
        .update({ entity_count: count ?? 0, last_refreshed_at: new Date().toISOString() })
        .eq("id", source.id);
    }

    return {
      code: source.code,
      versionId,
      total,
      processed: Math.min(nextOffset, total),
      nextOffset: done ? null : nextOffset,
      added,
      changed,
      removed,
      done,
    };
  });
