import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { ConsoleShell, Panel, StatusPill } from "@/components/console/shell";
import { fetchCases, fetchReports } from "@/lib/console";
import { draftReport, markReportSubmitted } from "@/lib/monitoring.functions";
import { useRoles } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/console/reports")({
  head: () => ({
    meta: [
      { title: "Regulatory reports — eterfaceID console" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

const REPORT_TYPES = [
  { value: "str", label: "Suspicious transaction report (FINTRAC)", jurisdiction: "CA", authority: "FINTRAC" },
  { value: "lctr", label: "Large cash transaction report (FINTRAC)", jurisdiction: "CA", authority: "FINTRAC" },
  { value: "eftr", label: "Electronic funds transfer report (FINTRAC)", jurisdiction: "CA", authority: "FINTRAC" },
  { value: "sar", label: "Suspicious activity report (FinCEN)", jurisdiction: "US", authority: "FinCEN" },
  { value: "ctr", label: "Currency transaction report (FinCEN)", jurisdiction: "US", authority: "FinCEN" },
  { value: "fiu", label: "National FIU report", jurisdiction: "ZA", authority: "National FIU" },
] as const;

function ReportsPage() {
  const queryClient = useQueryClient();
  const { roles } = useRoles();
  const canWrite = roles.includes("admin") || roles.includes("analyst");
  const draft = useServerFn(draftReport);
  const submit = useServerFn(markReportSubmitted);

  const cases = useQuery({ queryKey: ["cases"], queryFn: fetchCases });
  const reports = useQuery({ queryKey: ["reports"], queryFn: fetchReports });

  const [caseId, setCaseId] = useState("");
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]["value"]>("str");
  const [narrative, setNarrative] = useState("");

  const selected = REPORT_TYPES.find((r) => r.value === reportType)!;

  const create = useMutation({
    mutationFn: async () =>
      draft({
        data: {
          caseId,
          reportType,
          jurisdiction: selected.jurisdiction,
          authority: selected.authority,
          narrative: narrative || undefined,
        },
      }),
    onSuccess: () => {
      setNarrative("");
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });

  const mark = useMutation({
    mutationFn: async (vars: { reportId: string; reference: string }) => submit({ data: vars }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["reports"] }),
  });

  return (
    <ConsoleShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Regulatory reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build a complete report package from the case file — subject, screening results, transactions and the
            rules that fired. Filing with the authority stays a deliberate human step.
          </p>
        </div>

        {canWrite ? (
          <Panel title="Draft a report">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Case
                <select
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  className="mt-1 w-full rounded border border-[var(--rule)] bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                >
                  <option value="">Select a case</option>
                  {(cases.data ?? []).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.reference} — {c.subject_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Report type
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as (typeof REPORT_TYPES)[number]["value"])}
                  className="mt-1 w-full rounded border border-[var(--rule)] bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                >
                  {REPORT_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">
              Narrative
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={4}
                placeholder="Describe the grounds for suspicion in plain language."
                className="mt-1 w-full rounded border border-[var(--rule)] bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
              />
            </label>
            <button
              type="button"
              disabled={!caseId || create.isPending}
              onClick={() => create.mutate()}
              className="mt-4 rounded bg-[var(--ink)] px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {create.isPending ? "Building…" : "Build report package"}
            </button>
            {create.error ? (
              <p className="mt-2 text-sm text-[var(--signal)]">{(create.error as Error).message}</p>
            ) : null}
          </Panel>
        ) : null}

        <Panel title="Reports">
          {(reports.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            <ul className="space-y-4">
              {(reports.data ?? []).map((r: any) => (
                <li key={r.id} className="border border-[var(--rule)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {r.report_type.toUpperCase()} · {r.authority} · {r.jurisdiction}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {r.cases?.reference ? `${r.cases.reference} — ${r.cases.subject_name} · ` : ""}
                        {new Date(r.created_at).toLocaleString()}
                        {r.reference ? ` · filing reference ${r.reference}` : ""}
                      </p>
                    </div>
                    <StatusPill tone={r.status === "submitted" ? "approved" : "pending"}>{r.status}</StatusPill>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-muted-foreground">Report contents</summary>
                    <pre className="mt-2 max-h-72 overflow-auto bg-[var(--paper-deep)] p-3 font-mono text-xs">
                      {JSON.stringify(r.payload, null, 2)}
                    </pre>
                  </details>
                  {canWrite && r.status !== "submitted" ? (
                    <button
                      type="button"
                      onClick={() => {
                        const reference = window.prompt("Filing reference from the authority");
                        if (reference) mark.mutate({ reportId: r.id, reference });
                      }}
                      className="mt-3 rounded border border-[var(--rule)] px-3 py-1.5 text-sm"
                    >
                      Mark as filed
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </ConsoleShell>
  );
}
