import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { AdminShell, Field, buttonClass, ghostButtonClass, inputClass } from "@/components/admin/shell";
import { Panel, StatusPill } from "@/components/console/shell";
import { fetchCompany, fetchPlans, money } from "@/lib/platform";
import { generateInvoice, setInvoiceStatus, setSubscription } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/admin/companies/$orgId")({
  head: () => ({
    meta: [
      { title: "Company — eterfaceID app admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompanyPage,
});

function CompanyPage() {
  const { orgId } = Route.useParams();
  const queryClient = useQueryClient();
  const company = useQuery({ queryKey: ["admin-company", orgId], queryFn: () => fetchCompany(orgId) });
  const plans = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });

  const saveSub = useServerFn(setSubscription);
  const makeInvoice = useServerFn(generateInvoice);
  const invoiceStatus = useServerFn(setInvoiceStatus);

  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState<"trial" | "active" | "suspended" | "cancelled">("trial");
  const [price, setPrice] = useState("");
  const [volume, setVolume] = useState("");
  const [notes, setNotes] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));

  const sub = company.data?.subscription as any;
  useEffect(() => {
    if (!sub) return;
    setPlanId(sub.plan_id ?? "");
    setStatus(sub.status ?? "trial");
    setPrice(sub.price_override != null ? String(sub.price_override) : "");
    setVolume(sub.included_volume_override != null ? String(sub.included_volume_override) : "");
    setNotes(sub.notes ?? "");
  }, [sub]);

  const saving = useMutation({
    mutationFn: async () =>
      saveSub({
        data: {
          orgId,
          planId: planId || null,
          priceOverride: price ? Number(price) : null,
          includedVolumeOverride: volume ? Number(volume) : null,
          status,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-company", orgId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
    },
  });

  const invoicing = useMutation({
    mutationFn: async () => makeInvoice({ data: { orgId, period } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-company", orgId] }),
  });

  const marking = useMutation({
    mutationFn: async (input: { id: string; status: "draft" | "sent" | "paid" | "void" }) =>
      invoiceStatus({ data: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-company", orgId] }),
  });

  return (
    <AdminShell>
      <Link to="/admin" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ← All companies
      </Link>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight">
        {company.data?.organization?.name ?? "Company"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {company.data?.people ?? 0} people · {company.data?.caseCount ?? 0} cases
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Plan and status">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saving.mutate();
            }}
          >
            <Field label="Plan">
              <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
                <option value="">No plan</option>
                {(plans.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className={inputClass}
              >
                <option value="trial">trial</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
                <option value="cancelled">cancelled</option>
              </select>
            </Field>
            <Field label="Price override">
              <input value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} placeholder="e.g. 1.75" />
            </Field>
            <Field label="Included volume override">
              <input value={volume} onChange={(e) => setVolume(e.target.value)} className={inputClass} placeholder="e.g. 500" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Internal notes">
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className={buttonClass} disabled={saving.isPending}>
                Save
              </button>
              {saving.isError ? (
                <span className="ml-3 text-sm text-[var(--signal)]">{(saving.error as Error).message}</span>
              ) : null}
            </div>
          </form>
        </Panel>

        <Panel title="Usage by month">
          <div className="space-y-2 text-sm">
            {(company.data?.usage ?? []).map((u: any) => (
              <div key={u.id} className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs">{u.period}</span>
                <span className="text-muted-foreground">
                  {u.verifications} verifications · {u.screenings} screenings · {u.transactions} transactions
                </span>
              </div>
            ))}
            {(company.data?.usage ?? []).length === 0 ? (
              <p className="text-muted-foreground">No usage recorded yet.</p>
            ) : null}
          </div>
        </Panel>

        <div className="lg:col-span-2">
          <Panel
            title="Invoices"
            action={
              <div className="flex items-center gap-2">
                <input
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="h-8 w-28 rounded-md border border-[var(--rule)] bg-background px-2 text-xs"
                />
                <button
                  type="button"
                  className={ghostButtonClass}
                  disabled={invoicing.isPending}
                  onClick={() => invoicing.mutate()}
                >
                  Generate invoice
                </button>
              </div>
            }
          >
            {invoicing.isError ? (
              <p className="mb-3 text-sm text-[var(--signal)]">{(invoicing.error as Error).message}</p>
            ) : null}
            <div className="space-y-3 text-sm">
              {(company.data?.invoices ?? []).map((inv: any) => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link
                      to="/admin/invoices/$invoiceId"
                      params={{ invoiceId: inv.id }}
                      className="font-mono text-xs underline-offset-4 hover:underline"
                    >
                      {inv.number}
                    </Link>
                    <span className="ml-3 text-muted-foreground">{inv.period}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{money(inv.total, inv.currency)}</span>
                    <StatusPill tone={inv.status === "paid" ? "approved" : inv.status === "void" ? "closed" : "pending"}>
                      {inv.status}
                    </StatusPill>
                    {inv.status !== "paid" ? (
                      <button
                        type="button"
                        className={ghostButtonClass}
                        onClick={() => marking.mutate({ id: inv.id, status: inv.status === "draft" ? "sent" : "paid" })}
                      >
                        {inv.status === "draft" ? "Mark sent" : "Mark paid"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {(company.data?.invoices ?? []).length === 0 ? (
                <p className="text-muted-foreground">No invoices yet.</p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
