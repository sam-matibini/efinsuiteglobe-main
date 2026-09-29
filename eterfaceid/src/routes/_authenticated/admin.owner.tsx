import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { AdminShell, Field, buttonClass, inputClass } from "@/components/admin/shell";
import { Panel } from "@/components/console/shell";
import { fetchAppSettings } from "@/lib/platform";
import { saveAppSettings } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/admin/owner")({
  head: () => ({
    meta: [
      { title: "Company details — eterfaceID app admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerPage,
});

const fields = [
  ["legal_name", "Registered company name"],
  ["trading_name", "Trading name"],
  ["address_line1", "Address line 1"],
  ["address_line2", "Address line 2"],
  ["city", "City"],
  ["region", "Province or state"],
  ["postal_code", "Postal code"],
  ["country", "Country"],
  ["contact_email", "Contact email"],
  ["support_email", "Support email"],
  ["billing_email", "Billing email"],
  ["phone", "Phone"],
  ["registration_number", "Registration number"],
  ["tax_number", "Tax number"],
  ["email_from_name", "Email sender name"],
  ["email_from_address", "Email sender address"],
] as const;

function OwnerPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["app-settings"], queryFn: fetchAppSettings });
  const save = useServerFn(saveAppSettings);
  const [form, setForm] = useState<Record<string, string>>({});
  const [taxRate, setTaxRate] = useState("0");
  const [footer, setFooter] = useState("");

  useEffect(() => {
    const data = settings.data as Record<string, unknown> | null | undefined;
    if (!data) return;
    const next: Record<string, string> = {};
    for (const [key] of fields) next[key] = (data[key] as string) ?? "";
    setForm(next);
    setTaxRate(String(data["tax_rate"] ?? 0));
    setFooter((data["invoice_footer"] as string) ?? "");
  }, [settings.data]);

  const saving = useMutation({
    mutationFn: async () =>
      save({
        data: {
          ...(Object.fromEntries(fields.map(([k]) => [k, form[k] ?? ""])) as Record<string, string>),
          tax_rate: Number(taxRate || 0),
          invoice_footer: footer,
        } as never,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
  });

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Company details</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        These details appear on your invoices and fill in the contact information on the public website.
      </p>

      <div className="mt-8">
        <Panel title="Owner and company information">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saving.mutate();
            }}
          >
            {fields.map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  value={form[key] ?? ""}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={inputClass}
                />
              </Field>
            ))}
            <Field label="Tax rate (%)">
              <input value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Invoice footer">
                <textarea
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-[var(--rule)] bg-background p-3 text-sm outline-none focus-visible:border-[var(--signal)]"
                />
              </Field>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button type="submit" className={buttonClass} disabled={saving.isPending}>
                Save details
              </button>
              {saving.isSuccess ? <span className="text-sm text-muted-foreground">Saved.</span> : null}
              {saving.isError ? (
                <span className="text-sm text-[var(--signal)]">{(saving.error as Error).message}</span>
              ) : null}
            </div>
          </form>
        </Panel>
      </div>
    </AdminShell>
  );
}
