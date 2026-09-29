import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ConsoleShell, Panel, StatusPill } from "@/components/console/shell";
import {
  fetchCases,
  riskLabel,
  statusLabel,
  type CaseStatus,
  type RiskLevel,
} from "@/lib/console";

export const Route = createFileRoute("/_authenticated/console/")({
  head: () => ({
    meta: [
      { title: "Cases — eterfaceID console" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CasesPage,
});

function CasesPage() {
  const [status, setStatus] = useState<"all" | CaseStatus>("all");
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["cases"], queryFn: fetchCases });

  const rows = useMemo(() => {
    const all = data ?? [];
    return all.filter((row) => {
      const statusOk = status === "all" || row.status === status;
      const term = search.trim().toLowerCase();
      const searchOk =
        !term ||
        row.subject_name.toLowerCase().includes(term) ||
        row.reference.toLowerCase().includes(term);
      return statusOk && searchOk;
    });
  }, [data, status, search]);

  const counts = useMemo(() => {
    const all = data ?? [];
    return {
      open: all.filter((c) => c.status === "pending" || c.status === "in_review").length,
      high: all.filter((c) => c.risk_level === "high").length,
      approved: all.filter((c) => c.status === "approved").length,
      total: all.length,
    };
  }, [data]);

  return (
    <ConsoleShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Cases</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Every person and business record under review, with its current status, risk level and
        outstanding screening work.
      </p>

      <div className="mt-8 grid gap-px border border-[var(--rule)] bg-[var(--rule)] sm:grid-cols-4">
        {[
          { label: "Open for review", value: counts.open },
          { label: "High risk", value: counts.high },
          { label: "Approved", value: counts.approved },
          { label: "Total cases", value: counts.total },
        ].map((stat) => (
          <div key={stat.label} className="bg-background px-5 py-4">
            <div className="font-display text-2xl font-bold">{stat.value}</div>
            <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or reference"
          className="h-10 w-64 rounded-md border border-[var(--rule)] bg-background px-3 text-sm outline-none focus-visible:border-[var(--signal)]"
        />
        {(["all", "pending", "in_review", "approved", "rejected"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              status === value
                ? "border-[var(--ink)] text-[var(--ink)]"
                : "border-[var(--rule)] text-muted-foreground hover:text-foreground"
            }`}
          >
            {value === "all" ? "All" : statusLabel[value]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <Panel title="Case queue">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading cases…</p> : null}
          {error ? (
            <p className="text-sm text-[var(--signal)]">
              These cases could not be loaded. Your account may not have a role yet — ask an
              administrator to grant one.
            </p>
          ) : null}
          {!isLoading && !error && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cases match this filter.</p>
          ) : null}
          {rows.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="pb-3 font-medium">Reference</th>
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Risk</th>
                  <th className="pb-3 font-medium">Opened</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--rule)]">
                    <td className="py-3 font-mono text-xs">
                      <Link
                        to="/console/cases/$caseId"
                        params={{ caseId: row.id }}
                        className="underline underline-offset-4 hover:text-[var(--signal)]"
                      >
                        {row.reference}
                      </Link>
                    </td>
                    <td className="py-3">{row.subject_name}</td>
                    <td className="py-3 capitalize text-muted-foreground">{row.case_type}</td>
                    <td className="py-3">
                      <StatusPill tone={row.status}>{statusLabel[row.status as CaseStatus]}</StatusPill>
                    </td>
                    <td className="py-3">
                      <StatusPill tone={row.risk_level}>
                        {riskLabel[row.risk_level as RiskLevel]} · {row.risk_score}
                      </StatusPill>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Panel>
      </div>
    </ConsoleShell>
  );
}
