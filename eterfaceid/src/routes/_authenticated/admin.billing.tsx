import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminShell } from "@/components/admin/shell";
import { Panel, StatusPill } from "@/components/console/shell";
import { fetchInvoices, money } from "@/lib/platform";

export const Route = createFileRoute("/_authenticated/admin/billing")({
  head: () => ({
    meta: [
      { title: "Billing — eterfaceID app admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: fetchInvoices });
  const rows = (invoices.data ?? []) as any[];
  const outstanding = rows
    .filter((r) => r.status === "sent" || r.status === "draft")
    .reduce((s, r) => s + Number(r.total ?? 0), 0);

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Billing</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Invoices are generated from each company&apos;s usage against its plan. Generate them from the company page.
      </p>

      <p className="mt-6 text-sm text-muted-foreground">
        Outstanding: <span className="font-medium text-foreground">{money(outstanding)}</span>
      </p>

      <div className="mt-6">
        <Panel title="All invoices">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 pr-4">Number</th>
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--rule)]/60">
                    <td className="py-3 pr-4">
                      <Link
                        to="/admin/invoices/$invoiceId"
                        params={{ invoiceId: row.id }}
                        className="font-mono text-xs underline-offset-4 hover:underline"
                      >
                        {row.number}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{row.organizations?.name ?? "—"}</td>
                    <td className="py-3 pr-4">{row.period}</td>
                    <td className="py-3 pr-4">{money(row.total, row.currency)}</td>
                    <td className="py-3 pr-4">
                      <StatusPill tone={row.status === "paid" ? "approved" : row.status === "void" ? "closed" : "pending"}>
                        {row.status}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="py-4 text-muted-foreground" colSpan={5}>
                      No invoices yet.
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
