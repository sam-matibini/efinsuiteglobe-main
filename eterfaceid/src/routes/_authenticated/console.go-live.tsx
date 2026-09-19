import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { ConsoleShell, Panel, StatusPill } from "@/components/console/shell";
import { useOrganization, useRoles } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { acceptContract, submitLiveApplication } from "@/lib/go-live.functions";

export const Route = createFileRoute("/_authenticated/console/go-live")({
  head: () => ({
    meta: [
      { title: "Go live — eterfaceID console" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GoLivePage,
});

const inputClass =
  "h-10 w-full rounded-md border border-[var(--rule)] bg-background px-3 text-sm outline-none focus-visible:border-[var(--signal)]";
const buttonClass =
  "h-10 rounded-md bg-[var(--ink)] px-4 text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-50";

type OwnerDraft = {
  name: string;
  entity_type: "person" | "business";
  ownership_pct: string;
  control_role: string;
  country: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function GoLivePage() {
  const { isAdmin } = useRoles();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const submit = useServerFn(submitLiveApplication);
  const accept = useServerFn(acceptContract);

  const orgId = organization?.orgId ?? null;

  const status = useQuery({
    queryKey: ["go-live", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const [org, application, contract] = await Promise.all([
        supabase.from("organizations").select("live_access, live_approved_at, name").eq("id", orgId!).maybeSingle(),
        supabase
          .from("org_applications")
          .select("*")
          .eq("org_id", orgId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("org_contracts")
          .select("id, version, method, accepted_at, accepted_name")
          .eq("org_id", orgId!)
          .eq("status", "accepted")
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        org: org.data as { live_access?: string; live_approved_at?: string; name?: string } | null,
        application: application.data as Record<string, unknown> | null,
        contract: contract.data as Record<string, unknown> | null,
      };
    },
  });

  const [form, setForm] = useState({
    legal_name: "",
    registration_number: "",
    country: "CA",
    address_line1: "",
    city: "",
    region: "",
    postal_code: "",
    website: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    use_case: "",
    expected_volume: "",
  });
  const [owners, setOwners] = useState<OwnerDraft[]>([
    { name: "", entity_type: "person", ownership_pct: "", control_role: "", country: "" },
  ]);
  const [signName, setSignName] = useState("");
  const [signEmail, setSignEmail] = useState("");
  const [agreed, setAgreed] = useState(false);

  const applying = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          legal_name: form.legal_name,
          registration_number: form.registration_number || null,
          country: form.country || null,
          address_line1: form.address_line1 || null,
          city: form.city || null,
          region: form.region || null,
          postal_code: form.postal_code || null,
          website: form.website || null,
          contact_name: form.contact_name || null,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          use_case: form.use_case || null,
          expected_volume: form.expected_volume ? Number(form.expected_volume) : null,
          owners: owners
            .filter((o) => o.name.trim().length > 1)
            .map((o) => ({
              name: o.name.trim(),
              entity_type: o.entity_type,
              ownership_pct: o.ownership_pct ? Number(o.ownership_pct) : null,
              control_role: o.control_role || null,
              country: o.country || null,
            })),
        },
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["go-live"] }),
  });

  const signing = useMutation({
    mutationFn: async () => accept({ data: { full_name: signName, email: signEmail } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["go-live"] }),
  });

  const access = status.data?.org?.live_access ?? "locked";
  const application = status.data?.application;
  const contract = status.data?.contract;
  const appStatus = (application?.["status"] as string | undefined) ?? null;
  const verification = application?.["verification"] as
    | { checks?: Array<{ name: string; ok: boolean; severity: string; detail?: string }>; result?: string }
    | undefined;

  return (
    <ConsoleShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Go live</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Sandbox keys work straight away and are free. To issue live keys we verify your business and
        record a signed agreement, then an eterfaceID reviewer confirms.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Panel title="Where you are">
          <ul className="space-y-3 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span>Business verification</span>
              <StatusPill tone={appStatus === "approved" ? "approved" : appStatus ? "pending" : "closed"}>
                {appStatus ?? "not started"}
              </StatusPill>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Commercial agreement</span>
              <StatusPill tone={contract ? "approved" : "closed"}>{contract ? "signed" : "not signed"}</StatusPill>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Live API keys</span>
              <StatusPill tone={access === "approved" ? "approved" : access === "suspended" ? "rejected" : "closed"}>
                {access}
              </StatusPill>
            </li>
          </ul>
          {access === "approved" ? (
            <p className="mt-4 text-sm text-muted-foreground">
              You can now create live keys under Settings.
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Sandbox keys are unlimited and free. Live keys unlock once both steps above are done and
              we have confirmed your application.
            </p>
          )}
        </Panel>

        <Panel title="1. Your business" className="lg:col-span-2">
          {!isAdmin ? (
            <p className="text-sm text-muted-foreground">Only administrators can apply for live access.</p>
          ) : appStatus === "approved" ? (
            <p className="text-sm text-muted-foreground">Your application has been approved.</p>
          ) : (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                applying.mutate();
              }}
            >
              <Field label="Registered business name">
                <input
                  className={inputClass}
                  value={form.legal_name}
                  onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
                  required
                />
              </Field>
              <Field label="Registration number">
                <input
                  className={inputClass}
                  value={form.registration_number}
                  onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                />
              </Field>
              <Field label="Country (2 letters)">
                <input
                  className={inputClass}
                  maxLength={2}
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Street address">
                <input
                  className={inputClass}
                  value={form.address_line1}
                  onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
                />
              </Field>
              <Field label="City">
                <input
                  className={inputClass}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Field>
              <Field label="Province or state">
                <input
                  className={inputClass}
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                />
              </Field>
              <Field label="Postal code">
                <input
                  className={inputClass}
                  value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                />
              </Field>
              <Field label="Website">
                <input
                  className={inputClass}
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </Field>
              <Field label="Contact name">
                <input
                  className={inputClass}
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                />
              </Field>
              <Field label="Contact email">
                <input
                  className={inputClass}
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                />
              </Field>
              <Field label="Contact phone">
                <input
                  className={inputClass}
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                />
              </Field>
              <Field label="Expected checks per month">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={form.expected_volume}
                  onChange={(e) => setForm({ ...form, expected_volume: e.target.value.replace(/\D/g, "") })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="What you will use eterfaceID for">
                  <textarea
                    className="min-h-20 w-full rounded-md border border-[var(--rule)] bg-background p-3 text-sm outline-none focus-visible:border-[var(--signal)]"
                    value={form.use_case}
                    onChange={(e) => setForm({ ...form, use_case: e.target.value })}
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                  Owners and controlling people
                </p>
                <div className="space-y-2">
                  {owners.map((owner, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-5">
                      <input
                        className={inputClass}
                        placeholder="Full name"
                        value={owner.name}
                        onChange={(e) => {
                          const next = [...owners];
                          next[index] = { ...owner, name: e.target.value };
                          setOwners(next);
                        }}
                      />
                      <select
                        className={inputClass}
                        value={owner.entity_type}
                        onChange={(e) => {
                          const next = [...owners];
                          next[index] = { ...owner, entity_type: e.target.value as "person" | "business" };
                          setOwners(next);
                        }}
                      >
                        <option value="person">person</option>
                        <option value="business">business</option>
                      </select>
                      <input
                        className={inputClass}
                        placeholder="% owned"
                        inputMode="decimal"
                        value={owner.ownership_pct}
                        onChange={(e) => {
                          const next = [...owners];
                          next[index] = { ...owner, ownership_pct: e.target.value.replace(/[^\d.]/g, "") };
                          setOwners(next);
                        }}
                      />
                      <input
                        className={inputClass}
                        placeholder="Role, e.g. director"
                        value={owner.control_role}
                        onChange={(e) => {
                          const next = [...owners];
                          next[index] = { ...owner, control_role: e.target.value };
                          setOwners(next);
                        }}
                      />
                      <input
                        className={inputClass}
                        placeholder="Country"
                        maxLength={2}
                        value={owner.country}
                        onChange={(e) => {
                          const next = [...owners];
                          next[index] = { ...owner, country: e.target.value.toUpperCase() };
                          setOwners(next);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 text-sm text-[var(--signal)]"
                  onClick={() =>
                    setOwners([
                      ...owners,
                      { name: "", entity_type: "person", ownership_pct: "", control_role: "", country: "" },
                    ])
                  }
                >
                  Add another owner
                </button>
              </div>

              <div className="sm:col-span-2 flex items-center gap-3">
                <button type="submit" className={buttonClass} disabled={applying.isPending}>
                  {application ? "Resubmit for review" : "Submit for review"}
                </button>
                {applying.isError ? (
                  <span className="text-sm text-[var(--signal)]">{(applying.error as Error).message}</span>
                ) : null}
              </div>
            </form>
          )}

          {verification?.checks?.length ? (
            <div className="mt-6 border-t border-[var(--rule)] pt-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Verification result: {verification.result}
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {verification.checks.map((check, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={check.ok ? "text-emerald-600" : "text-[var(--signal)]"}>
                      {check.ok ? "✓" : "✗"}
                    </span>
                    <span>
                      {check.name}
                      {check.detail ? <span className="text-muted-foreground"> — {check.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        <Panel title="2. Commercial agreement" className="lg:col-span-3">
          {contract ? (
            <p className="text-sm text-muted-foreground">
              Agreement {String(contract["version"])} on file
              {contract["accepted_name"] ? `, accepted by ${String(contract["accepted_name"])}` : ""} (
              {String(contract["method"]) === "click" ? "accepted on screen" : "signed copy recorded"}).
            </p>
          ) : !isAdmin ? (
            <p className="text-sm text-muted-foreground">Only administrators can sign the agreement.</p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                signing.mutate();
              }}
            >
              <div className="max-h-56 overflow-y-auto border border-[var(--rule)] bg-[var(--paper-deep)] p-4 text-sm leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">eterfaceID commercial terms (version 1)</p>
                <p className="mt-2">
                  eterfaceID provides identity, business verification, sanctions screening and transaction
                  monitoring services through its console and API. You agree to use the service only for
                  lawful compliance purposes, to keep your API keys confidential, and to be responsible for
                  every call made with your keys.
                </p>
                <p className="mt-2">
                  Charges are based on the plan assigned to your account and the volume you use in each
                  calendar month. Invoices are issued monthly and are payable on the terms stated on the
                  invoice. Usage above your included volume is refused until your plan is upgraded.
                </p>
                <p className="mt-2">
                  Personal data you submit is processed to deliver the verification and screening services
                  and retained as required by applicable anti-money-laundering law. You confirm you have the
                  right to submit that data. Either party may end this agreement with 30 days' notice;
                  eterfaceID may suspend access immediately for unlawful use or non-payment.
                </p>
                <p className="mt-2">
                  Screening results are decision support, not a decision. You remain responsible for your own
                  regulatory obligations and reporting.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Your full name">
                  <input className={inputClass} value={signName} onChange={(e) => setSignName(e.target.value)} required />
                </Field>
                <Field label="Your email">
                  <input
                    className={inputClass}
                    type="email"
                    value={signEmail}
                    onChange={(e) => setSignEmail(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
                <span>
                  I am authorised to bind {status.data?.org?.name ?? "my company"} and I accept these terms.
                </span>
              </label>
              <div className="flex items-center gap-3">
                <button type="submit" className={buttonClass} disabled={!agreed || signing.isPending}>
                  Accept agreement
                </button>
                {signing.isError ? (
                  <span className="text-sm text-[var(--signal)]">{(signing.error as Error).message}</span>
                ) : null}
                <span className="text-sm text-muted-foreground">
                  Signing outside the app instead? Send the signed copy to us and we will record it here.
                </span>
              </div>
            </form>
          )}
        </Panel>
      </div>
    </ConsoleShell>
  );
}
