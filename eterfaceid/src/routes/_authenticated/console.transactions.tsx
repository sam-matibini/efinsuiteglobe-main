import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { ConsoleShell, Panel, StatusPill } from "@/components/console/shell";
import { fetchCases, fetchTransactions } from "@/lib/console";
import { recordTransaction } from "@/lib/monitoring.functions";
import { useRoles } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/console/transactions")({
  head: () => ({
    meta: [
      { title: "Transaction monitoring — eterfaceID console" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TransactionsPage,
});

const METHODS = ["cash", "eft", "wire", "interac", "card", "crypto", "cheque"] as const;

function TransactionsPage() {
  const queryClient = useQueryClient();
  const { roles } = useRoles();
  const canWrite = roles.includes("admin") || roles.includes("analyst");
  const record = useServerFn(recordTransaction);

  const cases = useQuery({ queryKey: ["cases"], queryFn: fetchCases });
  const txs = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });

  const [caseId, setCaseId] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("cash");
  const [amount, setAmount] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [country, setCountry] = useState("CA");

  const submit = useMutation({
    mutationFn: async () =>
      record({
        data: {
          caseId,
          direction,
          method,
          amount: Number(amount),
          currency: "CAD",
          counterpartyName: counterparty || undefined,
          counterpartyCountry: country || undefined,
        },
      }),
    onSuccess: () => {
      setAmount("");
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  return (
    <ConsoleShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Transaction monitoring</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every transaction is scored against reporting thresholds, structuring, pass-through, velocity,
            behavioural deviation, jurisdiction risk and sanctioned counterparties.
          </p>
        </div>

        {canWrite ? (
          <Panel title="Record a transaction">
            <div className="grid gap-4 p-4 sm:grid-cols-3">
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
                Direction
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as "inbound" | "outbound")}
                  className="mt-1 w-full rounded border border-[var(--rule)] bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                >
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                </select>
              </label>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Method
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
                  className="mt-1 w-full rounded border border-[var(--rule)] bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Amount (CAD)
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="9800"
                  className="mt-1 w-full rounded border border-[var(--rule)] bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                />
              </label>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Counterparty
                <input
                  value={counterparty}
                  onChange={(e) => setCounterparty(e.target.value)}
                  placeholder="Name on the other side"
                  className="mt-1 w-full rounded border border-[var(--rule)] bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                />
              </label>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">
                Counterparty country
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="CA"
                  className="mt-1 w-full rounded border border-[var(--rule)] bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
                />
              </label>
            </div>
            <div className="flex items-center gap-3 border-t border-[var(--rule)] p-4">
              <button
                type="button"
                disabled={!caseId || !amount || submit.isPending}
                onClick={() => submit.mutate()}
                className="rounded bg-[var(--ink)] px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {submit.isPending ? "Scoring…" : "Monitor transaction"}
              </button>
              {submit.data ? (
                <span className="text-sm text-muted-foreground">
                  Score {submit.data.score} · {submit.data.status} · {submit.data.alerts.length} rule(s) triggered
                </span>
              ) : null}
              {submit.error ? (
                <span className="text-sm text-[var(--signal)]">{(submit.error as Error).message}</span>
              ) : null}
            </div>
          </Panel>
        ) : null}

        <Panel title="Recent transactions">
          {txs.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : (txs.data ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No transactions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--rule)]">
              {(txs.data ?? []).map((t: any) => (
                <li key={t.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {t.direction === "inbound" ? "In" : "Out"} · {Number(t.amount_cad).toLocaleString()} CAD ·{" "}
                        {t.method}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t.cases?.reference ? `${t.cases.reference} — ${t.cases.subject_name} · ` : ""}
                        {t.counterparty_name ?? "No counterparty"}{" "}
                        {t.counterparty_country ? `(${t.counterparty_country})` : ""} ·{" "}
                        {new Date(t.occurred_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">{t.risk_score}</span>
                      <StatusPill tone={t.status === "review" ? "danger" : t.status === "monitor" ? "warn" : "ok"}>
                        {t.status}
                      </StatusPill>
                    </div>
                  </div>
                  {(t.transaction_alerts ?? []).length ? (
                    <ul className="mt-2 space-y-1">
                      {t.transaction_alerts.map((a: any) => (
                        <li key={a.id} className="text-sm">
                          <span className="font-medium">{a.rule_name}</span>
                          <span className="text-muted-foreground"> — {a.detail}</span>
                          <span className="block text-xs text-muted-foreground">{a.citation}</span>
                        </li>
                      ))}
                    </ul>
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
