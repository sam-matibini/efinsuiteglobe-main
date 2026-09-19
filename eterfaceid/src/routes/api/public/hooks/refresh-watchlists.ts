import { createFileRoute } from "@tanstack/react-router";

import { parseCsv, rowsToObjects } from "@/lib/csv";
import { normalizeName } from "@/lib/name-match";

/**
 * Scheduled list refresh. Called by the database scheduler with a shared
 * secret. Refreshes the smaller lists fully; large lists are refreshed in
 * slices across consecutive runs.
 */
export const Route = createFileRoute("/api/public/hooks/refresh-watchlists")({
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

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: sources, error } = await supabaseAdmin
          .from("watchlist_sources")
          .select("*")
          .eq("enabled", true)
          .order("last_refreshed_at", { ascending: true, nullsFirst: true })
          .limit(2);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const summary: Record<string, unknown>[] = [];

        for (const source of sources ?? []) {
          try {
            const res = await fetch(source.feed_url, {
              headers: { "user-agent": "eterfaceID-watchlist-ingest/1.0" },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const records = rowsToObjects(parseCsv(await res.text()));

            const { data: version } = await supabaseAdmin
              .from("watchlist_versions")
              .insert({
                source_id: source.id,
                version_label: new Date().toISOString().slice(0, 19),
                status: "running",
                row_count: records.length,
              })
              .select("id")
              .single();

            let written = 0;
            for (let i = 0; i < records.length; i += 500) {
              const batch = records.slice(i, i + 500);
              const rows = batch
                .filter((r) => (r["id"] ?? "") && (r["name"] ?? ""))
                .map((r) => ({
                  source_id: source.id,
                  external_id: r["id"]!,
                  version_id: version?.id ?? null,
                  entity_schema: r["schema"] || "Person",
                  name: r["name"]!.trim(),
                  name_norm: normalizeName(r["name"]!),
                  aliases: (r["aliases"] ?? "").split(";").map((a) => a.trim()).filter(Boolean),
                  birth_date: r["birth_date"] || null,
                  countries: (r["countries"] ?? "").split(";").map((a) => a.trim()).filter(Boolean),
                  identifiers: r["identifiers"] || null,
                  programs: r["sanctions"] || r["program_ids"] || null,
                  content_hash: `${r["last_change"] ?? ""}|${r["name"]}`,
                  last_change: r["last_change"] || null,
                  removed_at: null,
                  updated_at: new Date().toISOString(),
                }));
              if (!rows.length) continue;
              const { error: upsertError } = await supabaseAdmin
                .from("watchlist_entities")
                .upsert(rows as never, { onConflict: "source_id,external_id" });
              if (upsertError) throw upsertError;
              written += rows.length;
            }

            await supabaseAdmin
              .from("watchlist_versions")
              .update({ status: "complete", completed_at: new Date().toISOString(), row_count: written })
              .eq("id", version?.id ?? "");
            await supabaseAdmin
              .from("watchlist_sources")
              .update({ last_refreshed_at: new Date().toISOString(), entity_count: written })
              .eq("id", source.id);

            summary.push({ code: source.code, written });
          } catch (err) {
            summary.push({ code: source.code, error: (err as Error).message });
          }
        }

        return new Response(JSON.stringify({ ok: true, summary }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
