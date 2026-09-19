import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AdminShell, Field, buttonClass, ghostButtonClass, inputClass } from "@/components/admin/shell";
import { Panel } from "@/components/console/shell";
import { fetchPlans, money, type Plan } from "@/lib/platform";
import { deletePlan, savePlan } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  head: () => ({
    meta: [
      { title: "Plans and pricing — eterfaceID app admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlansPage,
});

const empty = {
  id: "",
  code: "",
  name: "",
  blurb: "",
  price_amount: "",
  price_unit: "per verification",
  included_volume: "0",
  overage_amount: "",
  features: "",
  featured: false,
  public_visible: true,
  custom_pricing: false,
  sort_order: "0",
};

function PlansPage() {
  const queryClient = useQueryClient();
  const plans = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });
  const save = useServerFn(savePlan);
  const remove = useServerFn(deletePlan);
  const [form, setForm] = useState({ ...empty });

  const saving = useMutation({
    mutationFn: async () =>
      save({
        data: {
          ...(form.id ? { id: form.id } : {}),
          code: form.code.trim(),
          name: form.name.trim(),
          blurb: form.blurb.trim(),
          price_amount: form.price_amount ? Number(form.price_amount) : null,
          price_unit: form.price_unit.trim() || "per verification",
          included_volume: Number(form.included_volume || 0),
          overage_amount: form.overage_amount ? Number(form.overage_amount) : null,
          features: form.features
            .split("\n")
            .map((f) => f.trim())
            .filter(Boolean),
          featured: form.featured,
          public_visible: form.public_visible,
          custom_pricing: form.custom_pricing,
          sort_order: Number(form.sort_order || 0),
        },
      }),
    onSuccess: () => {
      setForm({ ...empty });
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });

  const deleting = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });

  function edit(plan: Plan) {
    setForm({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      blurb: plan.blurb ?? "",
      price_amount: plan.price_amount != null ? String(plan.price_amount) : "",
      price_unit: plan.price_unit,
      included_volume: String(plan.included_volume),
      overage_amount: plan.overage_amount != null ? String(plan.overage_amount) : "",
      features: (plan.features ?? []).join("\n"),
      featured: plan.featured,
      public_visible: plan.public_visible,
      custom_pricing: plan.custom_pricing,
      sort_order: String(plan.sort_order),
    });
  }

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Plans and pricing</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        What you set here is what customers see on the public pricing page and what invoices are calculated from.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title={form.id ? "Edit plan" : "New plan"}>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saving.mutate();
            }}
          >
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} required />
            </Field>
            <Field label="Code">
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} required placeholder="starter" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Short description">
                <input value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <Field label="Price">
              <input value={form.price_amount} onChange={(e) => setForm({ ...form, price_amount: e.target.value })} className={inputClass} placeholder="1.75" />
            </Field>
            <Field label="Price unit">
              <input value={form.price_unit} onChange={(e) => setForm({ ...form, price_unit: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Included volume">
              <input value={form.included_volume} onChange={(e) => setForm({ ...form, included_volume: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Price beyond included">
              <input value={form.overage_amount} onChange={(e) => setForm({ ...form, overage_amount: e.target.value })} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Included features (one per line)">
                <textarea
                  value={form.features}
                  onChange={(e) => setForm({ ...form, features: e.target.value })}
                  rows={6}
                  className="w-full rounded-md border border-[var(--rule)] bg-background p-3 text-sm outline-none focus-visible:border-[var(--signal)]"
                />
              </Field>
            </div>
            <Field label="Display order">
              <input value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className={inputClass} />
            </Field>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
                Most chosen
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.public_visible} onChange={(e) => setForm({ ...form, public_visible: e.target.checked })} />
                Show on the website
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.custom_pricing} onChange={(e) => setForm({ ...form, custom_pricing: e.target.checked })} />
                Custom pricing
              </label>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button type="submit" className={buttonClass} disabled={saving.isPending}>
                {form.id ? "Save plan" : "Create plan"}
              </button>
              {form.id ? (
                <button type="button" className={ghostButtonClass} onClick={() => setForm({ ...empty })}>
                  Cancel
                </button>
              ) : null}
              {saving.isError ? (
                <span className="text-sm text-[var(--signal)]">{(saving.error as Error).message}</span>
              ) : null}
            </div>
          </form>
        </Panel>

        <Panel title="Current plans">
          <div className="space-y-4 text-sm">
            {(plans.data ?? []).map((plan) => (
              <div key={plan.id} className="border-b border-[var(--rule)]/60 pb-4 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {plan.name}
                      {plan.featured ? <span className="ml-2 text-xs text-[var(--signal)]">most chosen</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {plan.custom_pricing ? "Custom" : money(plan.price_amount, plan.price_currency)} {plan.price_unit} ·{" "}
                      {plan.public_visible ? "on the website" : "internal only"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className={ghostButtonClass} onClick={() => edit(plan)}>
                      Edit
                    </button>
                    <button type="button" className={ghostButtonClass} onClick={() => deleting.mutate(plan.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {(plans.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">No plans yet. Add your first one on the left.</p>
            ) : null}
          </div>
        </Panel>
      </div>
    </AdminShell>
  );
}
