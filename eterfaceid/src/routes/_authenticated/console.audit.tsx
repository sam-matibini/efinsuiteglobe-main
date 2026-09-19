import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { ConsoleShell, Panel } from "@/components/console/shell";
import { fetchAuditEvents } from "@/lib/console";

export const Route = createFileRoute("/_authenticated/console/audit")({
  head: () => ({
    meta: [
      { title: "Audit trail — eterfaceID console" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { data, isLoading } = useQuery({ queryKey: ["audit"], queryFn: fetchAuditEvents });

  return (
    <ConsoleShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Audit trail</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Every decision, disposition and key change, in the order it happened. Entries can be added
        but never edited or deleted — including by administrators.
      </p>

      <div className="mt-8">
        <Panel title="Recent activity">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading trail…</p> : null}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="pb-3 font-medium">When</th>
                <th className="pb-3 font-medium">Who</th>
                <th className="pb-3 font-medium">Action</th>
                <th className="pb-3 font-medium">Record</th>
                <th className="pb-3 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((event) => (
                <tr key={event.id} className="border-t border-[var(--rule)] align-top">
                  <td className="py-3 whitespace-nowrap text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </td>
                  <td className="py-3">{event.actor_email ?? "—"}</td>
                  <td className="py-3 font-mono text-xs">{event.action}</td>
                  <td className="py-3 text-muted-foreground">{event.entity_type}</td>
                  <td className="py-3 font-mono text-xs text-muted-foreground">
                    {JSON.stringify(event.detail)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && (data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing recorded yet. Decisions you make in the console appear here.
            </p>
          ) : null}
        </Panel>
      </div>
    </ConsoleShell>
  );
}
