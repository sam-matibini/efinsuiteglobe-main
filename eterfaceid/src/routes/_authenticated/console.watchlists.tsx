import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { ConsoleShell, Panel, StatusPill } from "@/components/console/shell";
import { useRoles } from "@/hooks/useSession";
import { categoryLabel, fetchWatchlistSources, fetchWatchlistVersions } from "@/lib/console";
import { refreshWatchlistSource } from "@/lib/watchlists.functions";
import { screenName } from "@/lib/screening.functions";

export const Route = createFileRoute("/_authenticated/console/watchlists")({
  head: () => ({
    meta: [
      { title: "Watchlists — eterfaceID console" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Watchlists,
});

function Watchlists() {
  const queryClient = useQueryClient();
  const { isAdmin } = useRoles();
  const refresh = useServerFn(refreshWatchlistSource);
  const search = useServerFn(screenName);

  const [progress, setProgress] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const sources = useQuery({ queryKey: ["watchlist-sources"], queryFn: fetchWatchlistSources });
  const versions = useQuery({ queryKey: ["watchlist-versions"], queryFn: fetchWatchlistVersions });

  const runRefresh = useMutation({
    mutationFn: async (code: string) => {
      let offset = 0;
      let versionId: string | null = null;
      for (;;) {
        const result = await refresh({ data: { code, offset, versionId } });
        versionId = result.versionId;
        setProgress((p) => ({
          ...p,
          [code]: `${result.processed.toLocaleString()} of ${result.total.toLocaleString()} records`,
        }));
        if (result.done) {
          setProgress((p) => ({
            ...p,
            [code]: `Done · ${result.total.toLocaleString()} records`,
          }));
          return result;
        }
        offset = result.nextOffset!;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["watchlist-sources"] });
      void queryClient.invalidateQueries({ queryKey: ["watchlist-versions"] });
    },
  });

  const testSearch = useMutation({
    mutationFn: (name: string) =>
      search({ data: { name, birthDate: birthDate || undefined } }),
  });

  return (
    <ConsoleShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Watchlists</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Official lists are downloaded into eterfaceID and matched by our own engine. Every refresh
        is kept as a version so a reviewer can always see which edition of a list produced a hit.
      </p>

      <div className="mt-8 space-y-6">
        <Panel title="Sources">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="py-2 pr-4 font-medium">List</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Records</th>
                <th className="py-2 pr-4 font-medium">Last refreshed</th>
                <th className="py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {(sources.data ?? []).map((source) => (
                <tr key={source.id} className="border-b border-[var(--rule)] last:border-0">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{source.title}</div>
                    <div className="font-mono text-xs text-muted-foreground">{source.code}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusPill tone={source.category === "sanctions" ? "high" : "review"}>
                      {categoryLabel[source.category] ?? source.category}
                    </StatusPill>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">
                    {source.entity_count.toLocaleString()}
                  </td>
                  <td className="py-3 pr-4 text-xs text-muted-foreground">
                    {source.last_refreshed_at
                      ? new Date(source.last_refreshed_at).toLocaleString()
                      : "Never"}
                    {progress[source.code] ? (
                      <div className="mt-1 text-[var(--ink)]">{progress[source.code]}</div>
                    ) : null}
                  </td>
                  <td className="py-3 text-right">
                    {isAdmin ? (
                      <button
                        type="button"
                        disabled={runRefresh.isPending}
                        onClick={() => runRefresh.mutate(source.code)}
                        className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--paper-deep)] disabled:opacity-50"
                      >
                        {runRefresh.isPending && runRefresh.variables === source.code
                          ? "Refreshing…"
                          : "Refresh"}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Admin only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {runRefresh.isError ? (
            <p className="mt-3 text-sm text-[var(--signal)]">
              {(runRefresh.error as Error).message}
            </p>
          ) : null}
        </Panel>

        <Panel title="Search the lists">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) testSearch.mutate(query.trim());
            }}
          >
            <div className="min-w-[16rem] flex-1">
              <label htmlFor="q" className="text-xs uppercase tracking-widest text-muted-foreground">
                Name
              </label>
              <input
                id="q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Person or organisation"
                className="mt-1 w-full rounded-md border border-[var(--rule)] bg-background px-3 py-2 text-sm outline-none focus-visible:border-[var(--signal)]"
              />
            </div>
            <div>
              <label htmlFor="dob" className="text-xs uppercase tracking-widest text-muted-foreground">
                Date of birth
              </label>
              <input
                id="dob"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                placeholder="1975-04-02"
                className="mt-1 rounded-md border border-[var(--rule)] bg-background px-3 py-2 text-sm outline-none focus-visible:border-[var(--signal)]"
              />
            </div>
            <button
              type="submit"
              disabled={testSearch.isPending}
              className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {testSearch.isPending ? "Searching…" : "Search"}
            </button>
          </form>

          {testSearch.data ? (
            <div className="mt-5 space-y-3">
              <p className="text-xs text-muted-foreground">
                {testSearch.data.candidates.toLocaleString()} records examined ·{" "}
                {testSearch.data.results.length} shown
              </p>
              {testSearch.data.results.map((r) => (
                <div key={r.entityId} className="border border-[var(--rule)] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.listTitle}
                        {r.birthDate ? ` · born ${r.birthDate}` : ""}
                        {r.countries?.length ? ` · ${r.countries.join(", ").toUpperCase()}` : ""}
                      </div>
                    </div>
                    <span className="font-mono text-xs">{r.score.toFixed(2)}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.reasons.join(". ")}</p>
                </div>
              ))}
              {testSearch.data.results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No records came close to that name.</p>
              ) : null}
            </div>
          ) : null}
        </Panel>

        <Panel title="Refresh history">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="py-2 pr-4 font-medium">List</th>
                <th className="py-2 pr-4 font-medium">Version</th>
                <th className="py-2 pr-4 font-medium">Records</th>
                <th className="py-2 pr-4 font-medium">Added</th>
                <th className="py-2 pr-4 font-medium">Changed</th>
                <th className="py-2 pr-4 font-medium">Removed</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(versions.data ?? []).map((v) => (
                <tr key={v.id} className="border-b border-[var(--rule)] last:border-0">
                  <td className="py-3 pr-4">{v.watchlist_sources?.title ?? "—"}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{v.version_label}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{v.row_count.toLocaleString()}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{v.added_count}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{v.changed_count}</td>
                  <td className="py-3 pr-4 font-mono text-xs">{v.removed_count}</td>
                  <td className="py-3">
                    <StatusPill tone={v.status === "complete" ? "pass" : v.status === "failed" ? "fail" : "review"}>
                      {v.status}
                    </StatusPill>
                  </td>
                </tr>
              ))}
              {(versions.data ?? []).length === 0 ? (
                <tr>
                  <td className="py-3 text-sm text-muted-foreground">No refreshes yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Panel>
      </div>
    </ConsoleShell>
  );
}
