import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminShell } from "@/components/admin/shell";
import { Panel, StatusPill } from "@/components/console/shell";
import { fetchEmailLog } from "@/lib/platform";
import { NOTIFICATION_EVENTS } from "@/lib/notification-events";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  head: () => ({
    meta: [
      { title: "Email log — eterfaceID app admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmailLogPage,
});

function EmailLogPage() {
  const log = useQuery({ queryKey: ["email-log"], queryFn: fetchEmailLog });

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Email log</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Every message the platform tried to send, and whether the email provider accepted it.
      </p>

      <div className="mt-8">
        <Panel title="Recent messages">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">To</th>
                  <th className="py-2 pr-4">Subject</th>
                  <th className="py-2 pr-4">Result</th>
                </tr>
              </thead>
              <tbody>
                {(log.data ?? []).map((row: any) => (
                  <tr key={row.id} className="border-b border-[var(--rule)]/60 align-top">
                    <td className="py-3 pr-4 text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">{NOTIFICATION_EVENTS[row.event] ?? row.event}</td>
                    <td className="py-3 pr-4">{row.recipient}</td>
                    <td className="py-3 pr-4">{row.subject}</td>
                    <td className="py-3 pr-4">
                      <StatusPill tone={row.status === "sent" ? "approved" : "fail"}>{row.status}</StatusPill>
                      {row.error_detail ? (
                        <div className="mt-1 max-w-xs text-xs text-[var(--signal)]">{row.error_detail}</div>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {(log.data ?? []).length === 0 ? (
                  <tr>
                    <td className="py-4 text-muted-foreground" colSpan={5}>
                      No emails sent yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AdminShell>
  );
}
