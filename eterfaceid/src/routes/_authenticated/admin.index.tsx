import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminShell } from "@/components/admin/shell";
import { Panel, StatusPill } from "@/components/console/shell";
import { fetchCompanies, money } from "@/lib/platform";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "App admin — eterfaceID" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOverview,
});

function AdminOverview() {
  const companies = useQuery({ queryKey: ["admin-companies"], queryFn: fetchCompanies });
  const rows = companies.data ?? [];
  const totalVerifications = rows.reduce((s, r) => s + (r.usage?.verifications ?? 0), 0);

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Customer companies</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Every company using eterfaceID, what they are on and what they have used this month.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Companies" value={String(rows.length)} />
        <Stat label="People" value={String(rows.reduce((s, r) => s + r.people, 0))} />
        <Stat label="Verifications this month" value={String(totalVerifications)} />
      </div>

      <div className="mt-8">
        <Panel title="Companies">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Joined</th>
                  <th className="py-2 pr-4">People</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4">Verifications</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const plan = (row.subscription as any)?.plans ?? null;
                  const price = (row.subscription as any)?.price_override ?? plan?.price_amount ?? null;
                  return (
                    <tr key={row.id} className="border-b border-[var(--rule)]/60">
                      <td className="py-3 pr-4">
                        <Link
                          to="/admin/companies/$orgId"
                          params={{ orgId: row.id }}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4">{row.people}</td>
                      <td className="py-3 pr-4">{plan?.name ?? "—"}</td>
                      <td className="py-3 pr-4">{money(price)}</td>
                      <td className="py-3 pr-4">{row.usage?.verifications ?? 0}</td>
                      <td className="py-3 pr-4">
                        <StatusPill tone={(row.subscription as any)?.status === "active" ? "approved" : "pending"}>
                          {(row.subscription as any)?.status ?? "no plan"}
                        </StatusPill>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td className="py-4 text-muted-foreground" colSpan={7}>
                      No companies yet.
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--rule)] bg-background px-5 py-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}
