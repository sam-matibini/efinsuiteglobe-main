import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConsoleShell, Panel, StatusPill } from "@/components/console/shell";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useSession";
import { fetchAlerts, logAudit } from "@/lib/console";

export const Route = createFileRoute("/_authenticated/console/alerts")({
  head: () => ({
    meta: [
      { title: "Monitoring — eterfaceID console" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const queryClient = useQueryClient();
  const { canWrite } = useRoles();
  const { data, isLoading } = useQuery({ queryKey: ["alerts"], queryFn: fetchAlerts });

  const close = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("monitoring_alerts")
        .update({ status: "closed" })
        .eq("id", id);
      if (error) throw error;
      await logAudit("alert.closed", "monitoring_alert", id, {});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  return (
    <ConsoleShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Ongoing monitoring</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Alerts raised after a case was decided — list updates, registry changes and new adverse
        media on subjects you have already onboarded.
      </p>

      <div className="mt-8">
        <Panel title="Alerts">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading alerts…</p> : null}
          <div className="space-y-4">
            {(data ?? []).map((alert) => {
              const related = alert.cases as { reference: string; subject_name: string } | null;
              return (
                <div
                  key={alert.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--rule)] pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium">{alert.alert_type.replace("_", " ")}</div>
                    <div className="text-sm text-muted-foreground">{alert.detail}</div>
                    {related ? (
                      <Link
                        to="/console/cases/$caseId"
                        params={{ caseId: alert.case_id }}
                        className="mt-1 inline-block font-mono text-xs underline underline-offset-4"
                      >
                        {related.reference} · {related.subject_name}
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill tone={alert.status}>{alert.status}</StatusPill>
                    {canWrite && alert.status === "open" ? (
                      <button
                        type="button"
                        onClick={() => close.mutate(alert.id)}
                        className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--paper-deep)]"
                      >
                        Close alert
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!isLoading && (data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No monitoring alerts right now.</p>
            ) : null}
          </div>
        </Panel>
      </div>
    </ConsoleShell>
  );
}
