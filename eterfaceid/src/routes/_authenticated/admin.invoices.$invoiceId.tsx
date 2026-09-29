import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminShell } from "@/components/admin/shell";
import { fetchAppSettings, fetchInvoice, money } from "@/lib/platform";

export const Route = createFileRoute("/_authenticated/admin/invoices/$invoiceId")({
  head: () => ({
    meta: [
      { title: "Invoice — eterfaceID app admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvoicePage,
});

function InvoicePage() {
  const { invoiceId } = Route.useParams();
  const data = useQuery({ queryKey: ["invoice", invoiceId], queryFn: () => fetchInvoice(invoiceId) });
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const invoice = data.data?.invoice as any;
  const lines = (data.data?.lines ?? []) as any[];
  const owner = settings.data as any;

  return (
    <AdminShell>
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link to="/admin/billing" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← All invoices
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--paper-deep)]"
        >
          Print or save as PDF
        </button>
      </div>

      {invoice ? (
        <article className="mt-6 border border-[var(--rule)] bg-background p-10">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[var(--rule)] pb-6">
            <div>
              <div className="font-display text-xl font-bold">
                {owner?.legal_name ?? "eterfaceID"}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {[owner?.address_line1, owner?.address_line2, owner?.city, owner?.region, owner?.postal_code, owner?.country]
                  .filter(Boolean)
                  .map((line: string) => (
                    <div key={line}>{line}</div>
                  ))}
                {owner?.billing_email ? <div>{owner.billing_email}</div> : null}
                {owner?.registration_number ? <div>Reg. {owner.registration_number}</div> : null}
                {owner?.tax_number ? <div>Tax {owner.tax_number}</div> : null}
              </div>
            </div>
            <div className="text-right text-sm">
              <div className="font-display text-2xl font-semibold">Invoice</div>
              <div className="mt-2 font-mono text-xs">{invoice.number}</div>
              <div className="text-muted-foreground">Period {invoice.period}</div>
              <div className="text-muted-foreground">
                Issued {new Date(invoice.issued_at ?? invoice.created_at).toLocaleDateString()}
              </div>
            </div>
          </header>

          <div className="mt-6 text-sm">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Billed to</div>
            <div className="mt-1 font-medium">{invoice.organizations?.name}</div>
          </div>

          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--rule)] text-left text-xs uppercase tracking-widest text-muted-foreground">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-[var(--rule)]/60">
                  <td className="py-3">{line.description}</td>
                  <td className="py-3 text-right">{line.quantity}</td>
                  <td className="py-3 text-right">{money(line.unit_amount, invoice.currency)}</td>
                  <td className="py-3 text-right">{money(line.amount, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 ml-auto w-full max-w-xs space-y-2 text-sm">
            <Row label="Subtotal" value={money(invoice.subtotal, invoice.currency)} />
            <Row label={`Tax (${invoice.tax_rate ?? 0}%)`} value={money(invoice.tax_amount, invoice.currency)} />
            <div className="flex justify-between border-t border-[var(--rule)] pt-2 font-medium">
              <span>Total</span>
              <span>{money(invoice.total, invoice.currency)}</span>
            </div>
          </div>

          {owner?.invoice_footer ? (
            <p className="mt-10 border-t border-[var(--rule)] pt-4 text-xs text-muted-foreground">
              {owner.invoice_footer}
            </p>
          ) : null}
        </article>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">Invoice not found.</p>
      )}
    </AdminShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
