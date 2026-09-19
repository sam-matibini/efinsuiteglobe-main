import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AdminShell } from "@/components/admin/shell";
import { Panel, StatusPill } from "@/components/console/shell";
import { supabase } from "@/integrations/supabase/client";
import { decideLiveAccess, recordSignedContract } from "@/lib/go-live.functions";

export const Route = createFileRoute("/_authenticated/admin/applications")({
  head: () => ({
    meta: [
      { title: "Live access — eterfaceID admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApplicationsPage,
});

const buttonClass =
  "h-9 rounded-md bg-[var(--ink)] px-3 text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-50";
const ghostClass = "h-9 rounded-md border border-[var(--rule)] px-3 text-sm transition-colors hover:bg-[var(--paper)]";

async function fetchApplications() {
  const [apps, orgs, contracts] = await Promise.all([
    supabase.from("org_applications").select("*").order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name, live_access, live_approved_at"),
    supabase.from("org_contracts").select("org_id, version, method, accepted_at, accepted_name").eq("status", "accepted"),
  ]);
  const err = apps.error ?? orgs.error ?? contracts.error;
  if (err) throw err;
  return (apps.data ?? []).map((app): Record<string, any> => ({
    ...(app as Record<string, any>),
    org: (orgs.data ?? []).find((o) => o.id === (app as any).org_id) ?? null,
    contract: (contracts.data ?? []).find((c) => c.org_id === (app as any).org_id) ?? null,
  }));
}

function ApplicationsPage() {
  const queryClient = useQueryClient();
  const decide = useServerFn(decideLiveAccess);
  const recordSigned = useServerFn(recordSignedContract);
  const [note, setNote] = useState<Record<string, string>>({});

  const list = useQuery({ queryKey: ["admin-applications"], queryFn: fetchApplications });

  const deciding = useMutation({
    mutationFn: async (input: { org_id: string; decision: "approve" | "decline" | "suspend" | "restore"; note: string | null }) =>
      decide({ data: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-applications"] }),
  });

  const signing = useMutation({
    mutationFn: async (input: { org_id: string; note: string | null }) =>
      recordSigned({ data: { org_id: input.org_id, note: input.note, document_path: null } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-applications"] }),
  });

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Live access</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Companies asking to move from sandbox to live. Our own business verification has already run on
        what they submitted — confirm or decline.
      </p>

      <div className="mt-8 space-y-6">
        {(list.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications yet.</p>
        ) : null}

        {(list.data ?? []).map((app) => {
          const verification = app["verification"] as
            | { checks?: Array<{ name: string; ok: boolean; detail?: string }>; result?: string; rule?: { blocked?: boolean; sanctionedOwnership?: number } }
            | undefined;
          const owners = (app["owners"] as Array<Record<string, unknown>>) ?? [];
          return (
            <Panel
              key={app["id"]}
              title={`${app["legal_name"]} — ${app["org"]?.name ?? "unknown company"}`}
              action={
                <div className="flex items-center gap-2">
                  <StatusPill tone={app["status"] === "approved" ? "approved" : app["status"] === "declined" ? "rejected" : "pending"}>
                    {String(app["status"])}
                  </StatusPill>
                  <StatusPill tone={app["verification_result"] === "pass" ? "approved" : app["verification_result"] === "fail" ? "rejected" : "pending"}>
                    checks {String(app["verification_result"])}
                  </StatusPill>
                </div>
              }
            >
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="text-sm">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Business</p>
                  <p className="mt-1">{String(app["legal_name"])}</p>
                  <p className="text-muted-foreground">
                    {String(app["registration_number"] ?? "no registration number")} · {String(app["country"] ?? "—")}
                  </p>
                  <p className="text-muted-foreground">
                    {[app["address_line1"], app["city"], app["region"], app["postal_code"]].filter(Boolean).join(", ") || "no address"}
                  </p>
                  <p className="mt-2">{String(app["contact_name"] ?? "")}</p>
                  <p className="text-muted-foreground">{String(app["contact_email"] ?? "")}</p>
                  <p className="text-muted-foreground">{String(app["contact_phone"] ?? "")}</p>
                  <p className="mt-2 text-muted-foreground">
                    Expects {String(app["expected_volume"] ?? "—")} checks a month
                  </p>
                  {app["org"] ? (
                    <Link
                      to="/admin/companies/$orgId"
                      params={{ orgId: String(app["org_id"]) }}
                      className="mt-2 inline-block text-[var(--signal)]"
                    >
                      Open company
                    </Link>
                  ) : null}
                </div>

                <div className="text-sm">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Owners</p>
                  <ul className="mt-1 space-y-1">
                    {owners.length === 0 ? <li className="text-muted-foreground">None declared</li> : null}
                    {owners.map((o, i) => (
                      <li key={i}>
                        {String(o["name"])}{" "}
                        <span className="text-muted-foreground">
                          {o["ownership_pct"] ? `${String(o["ownership_pct"])}%` : ""} {String(o["control_role"] ?? "")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {verification?.rule?.blocked ? (
                    <p className="mt-2 text-[var(--signal)]">
                      Sanctioned owners hold {verification.rule.sanctionedOwnership}% — 50 percent rule applies.
                    </p>
                  ) : null}
                </div>

                <div className="text-sm">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Checks</p>
                  <ul className="mt-1 space-y-1">
                    {(verification?.checks ?? []).map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={c.ok ? "text-emerald-600" : "text-[var(--signal)]"}>{c.ok ? "✓" : "✗"}</span>
                        <span>
                          {c.name}
                          {c.detail ? <span className="text-muted-foreground"> — {c.detail}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 border-t border-[var(--rule)] pt-4 text-sm">
                <p>
                  Agreement:{" "}
                  {app["contract"] ? (
                    <span className="text-muted-foreground">
                      {String(app["contract"].version)} ·{" "}
                      {app["contract"].method === "click" ? "accepted on screen" : "signed copy recorded"}
                      {app["contract"].accepted_name ? ` by ${String(app["contract"].accepted_name)}` : ""}
                    </span>
                  ) : (
                    <span className="text-[var(--signal)]">not signed</span>
                  )}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    className="h-9 min-w-56 flex-1 rounded-md border border-[var(--rule)] bg-background px-3 text-sm"
                    placeholder="Note (optional)"
                    value={note[String(app["org_id"])] ?? ""}
                    onChange={(e) => setNote({ ...note, [String(app["org_id"])]: e.target.value })}
                  />
                  <button
                    className={buttonClass}
                    disabled={deciding.isPending}
                    onClick={() =>
                      deciding.mutate({
                        org_id: String(app["org_id"]),
                        decision: "approve",
                        note: note[String(app["org_id"])] ?? null,
                      })
                    }
                  >
                    Approve live access
                  </button>
                  <button
                    className={ghostClass}
                    disabled={deciding.isPending}
                    onClick={() =>
                      deciding.mutate({
                        org_id: String(app["org_id"]),
                        decision: "decline",
                        note: note[String(app["org_id"])] ?? null,
                      })
                    }
                  >
                    Decline
                  </button>
                  {app["org"]?.live_access === "approved" ? (
                    <button
                      className={ghostClass}
                      onClick={() => deciding.mutate({ org_id: String(app["org_id"]), decision: "suspend", note: null })}
                    >
                      Suspend live access
                    </button>
                  ) : app["org"]?.live_access === "suspended" ? (
                    <button
                      className={ghostClass}
                      onClick={() => deciding.mutate({ org_id: String(app["org_id"]), decision: "restore", note: null })}
                    >
                      Restore live access
                    </button>
                  ) : null}
                  {!app["contract"] ? (
                    <button
                      className={ghostClass}
                      disabled={signing.isPending}
                      onClick={() =>
                        signing.mutate({
                          org_id: String(app["org_id"]),
                          note: note[String(app["org_id"])] ?? null,
                        })
                      }
                    >
                      Record signed copy
                    </button>
                  ) : null}
                </div>
                {deciding.isError ? (
                  <p className="mt-2 text-[var(--signal)]">{(deciding.error as Error).message}</p>
                ) : null}
              </div>
            </Panel>
          );
        })}
      </div>
    </AdminShell>
  );
}
