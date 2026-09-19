import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { screenCase } from "@/lib/screening.functions";
import { decideCase } from "@/lib/verification.functions";

import { ConsoleShell, Panel, StatusPill } from "@/components/console/shell";
import { VerificationPanels } from "@/components/console/verification";
import { AddressPanel } from "@/components/console/address";
import { computeOwnership } from "@/lib/monitoring.functions";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/useSession";
import {
  categoryLabel,
  fetchCase,
  logAudit,
  riskLabel,
  statusLabel,
  type CaseStatus,
  type RiskLevel,
} from "@/lib/console";

export const Route = createFileRoute("/_authenticated/console/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Case detail — eterfaceID console" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CaseDetail,
});

function CaseDetail() {
  const { caseId } = useParams({ from: "/_authenticated/console/cases/$caseId" });
  const queryClient = useQueryClient();
  const { canWrite } = useRoles();
  const screen = useServerFn(screenCase);
  const ownership = useServerFn(computeOwnership);
  const [note, setNote] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => fetchCase(caseId),
  });

  const decide = useServerFn(decideCase);
  const decideCaseMutation = useMutation({
    mutationFn: async (status: CaseStatus) => decide({ data: { caseId, status, note } }),
    onSuccess: () => {
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["cases"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  const runScreening = useMutation({
    mutationFn: () => screen({ data: { caseId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["cases"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  const runOwnership = useMutation({
    mutationFn: () => ownership({ data: { caseId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  const decideHit = useMutation({
    mutationFn: async ({
      id,
      disposition,
    }: {
      id: string;
      disposition: "true_positive" | "false_positive";
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from("screening_hits")
        .update({
          disposition,
          decided_by: userData.user?.id ?? null,
          decided_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (updateError) throw updateError;
      await logAudit("screening_hit.disposition", "screening_hit", id, { disposition, caseId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  if (isLoading) {
    return (
      <ConsoleShell>
        <p className="text-sm text-muted-foreground">Loading case…</p>
      </ConsoleShell>
    );
  }

  if (error || !data?.record) {
    return (
      <ConsoleShell>
        <p className="text-sm text-[var(--signal)]">This case could not be loaded.</p>
        <Link to="/console" className="mt-4 inline-block text-sm underline underline-offset-4">
          Back to cases
        </Link>
      </ConsoleShell>
    );
  }

  const record = data.record;

  return (
    <ConsoleShell>
      <Link to="/console" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Cases
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{record.reference}</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            {record.subject_name}
          </h1>
          <p className="mt-2 text-sm capitalize text-muted-foreground">
            {record.case_type} · {record.country ?? "country not recorded"}
          </p>
        </div>
        <div className="flex gap-2">
          <StatusPill tone={record.status}>{statusLabel[record.status as CaseStatus]}</StatusPill>
          <StatusPill tone={record.risk_level}>
            {riskLabel[record.risk_level as RiskLevel]} risk · {record.risk_score}
          </StatusPill>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Checks">
            <table className="w-full text-sm">
              <tbody>
                {data.checks.map((check) => (
                  <tr key={check.id} className="border-b border-[var(--rule)] last:border-0">
                    <td className="py-3 pr-4 align-top">
                      <div className="font-medium">{check.name}</div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">
                        {check.category}
                      </div>
                    </td>
                    <td className="py-3 pr-4 align-top text-muted-foreground">
                      {check.detail}
                      {check.source ? (
                        <div className="mt-1 text-xs">Source: {check.source}</div>
                      ) : null}
                    </td>
                    <td className="py-3 text-right align-top">
                      <StatusPill tone={check.result}>{check.result.replace("_", " ")}</StatusPill>
                    </td>
                  </tr>
                ))}
                {data.checks.length === 0 ? (
                  <tr>
                    <td className="py-3 text-sm text-muted-foreground">No checks recorded yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Panel>

          {record.case_type === "business" ? (
            <Panel
              title="Ownership and control"
              action={
                canWrite ? (
                  <button
                    type="button"
                    disabled={runOwnership.isPending}
                    onClick={() => runOwnership.mutate()}
                    className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--paper-deep)] disabled:opacity-50"
                  >
                    {runOwnership.isPending ? "Calculating…" : "Compute beneficial owners"}
                  </button>
                ) : undefined
              }
            >
              <table className="w-full text-sm">
                <tbody>
                  {data.owners.map((owner) => (
                    <tr key={owner.id} className="border-b border-[var(--rule)] last:border-0">
                      <td className="py-3 font-medium">{owner.name}</td>
                      <td className="py-3 text-muted-foreground">{owner.control_role}</td>
                      <td className="py-3 text-right font-mono text-xs">
                        {owner.ownership_pct ?? "—"}%
                        {(owner as any).effective_pct != null ? (
                          <span className="block text-muted-foreground">
                            effective {Number((owner as any).effective_pct).toFixed(1)}%
                            {(owner as any).is_ubo ? " · UBO" : ""}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <StatusPill tone={owner.screening_status}>
                          {owner.screening_status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ) : null}

          <Panel
            title="Screening hits"
            action={
              canWrite ? (
                <button
                  type="button"
                  disabled={runScreening.isPending}
                  onClick={() => runScreening.mutate()}
                  className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--paper-deep)] disabled:opacity-50"
                >
                  {runScreening.isPending ? "Screening…" : "Run screening"}
                </button>
              ) : undefined
            }
          >
            <div className="space-y-4">
              {data.hits.map((hit) => (
                <div key={hit.id} className="border border-[var(--rule)] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{hit.matched_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {categoryLabel[hit.category] ?? hit.category} · {hit.list_name}
                        {hit.list_version ? ` · version ${hit.list_version}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{hit.match_score ?? "—"}</span>
                      <StatusPill tone={hit.disposition}>
                        {hit.disposition.replace("_", " ")}
                      </StatusPill>
                    </div>
                  </div>
                  {hit.detail ? (
                    <p className="mt-2 text-sm text-muted-foreground">{hit.detail}</p>
                  ) : null}
                  {Array.isArray(hit.reasons) && hit.reasons.length ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {(hit.reasons as string[]).map((reason, i) => (
                        <li
                          key={i}
                          className="rounded-full border border-[var(--rule)] px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {reason}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {canWrite && hit.disposition === "open" ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          decideHit.mutate({ id: hit.id, disposition: "true_positive" })
                        }
                        className="rounded-md border border-[var(--signal)] px-3 py-1.5 text-xs text-[var(--signal)] transition-colors hover:bg-[var(--paper-deep)]"
                      >
                        True positive
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          decideHit.mutate({ id: hit.id, disposition: "false_positive" })
                        }
                        className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--paper-deep)]"
                      >
                        False positive
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {data.hits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No screening hits on this case.</p>
              ) : null}
            </div>
          </Panel>

          <VerificationPanels
            caseId={caseId}
            canWrite={canWrite}
            subjectName={record.subject_name}
            country={record.country}
            caseType={record.case_type}
          />

          <AddressPanel caseId={caseId} canWrite={canWrite} />
        </div>

        <div className="space-y-6">
          <Panel title="Decision">
            {canWrite ? (
              <>
                <label htmlFor="note" className="text-sm font-medium">
                  Reviewer note
                </label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="mt-1 w-full rounded-md border border-[var(--rule)] bg-background p-3 text-sm outline-none focus-visible:border-[var(--signal)]"
                  placeholder="Why this case is being approved or rejected"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={decideCaseMutation.isPending}
                    onClick={() => decideCaseMutation.mutate("approved")}
                    className="flex-1 rounded-md bg-[var(--ink)] px-3 py-2 text-sm text-background transition-opacity hover:opacity-90"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={decideCaseMutation.isPending}
                    onClick={() => decideCaseMutation.mutate("rejected")}
                    className="flex-1 rounded-md border border-[var(--signal)] px-3 py-2 text-sm text-[var(--signal)] transition-colors hover:bg-[var(--paper-deep)]"
                  >
                    Reject
                  </button>
                </div>
                {decideCaseMutation.isError ? (
                  <p className="mt-2 text-sm text-[var(--signal)]">
                    That decision could not be saved.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your account has view-only access, so decisions are disabled.
              </p>
            )}
            {record.decision_note ? (
              <p className="mt-4 border-t border-[var(--rule)] pt-4 text-sm text-muted-foreground">
                Last note: {record.decision_note}
              </p>
            ) : null}
          </Panel>

          <Panel title="Monitoring">
            <div className="space-y-3 text-sm">
              {data.alerts.map((alert) => (
                <div key={alert.id} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{alert.alert_type.replace("_", " ")}</div>
                    <div className="text-muted-foreground">{alert.detail}</div>
                  </div>
                  <StatusPill tone={alert.status}>{alert.status}</StatusPill>
                </div>
              ))}
              {data.alerts.length === 0 ? (
                <p className="text-muted-foreground">No monitoring alerts on this case.</p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </ConsoleShell>
  );
}
