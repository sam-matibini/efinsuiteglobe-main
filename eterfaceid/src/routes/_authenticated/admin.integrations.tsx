import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AdminShell, buttonClass, ghostButtonClass, inputClass } from "@/components/admin/shell";
import { Panel, StatusPill } from "@/components/console/shell";
import { fetchApiNotepad, fetchIntegrations, type ApiNotepadEntry } from "@/lib/platform";
import {
  deleteApiNotepadEntry,
  saveApiNotepadEntry,
  sendTestEmail,
  setIntegrationEnabled,
} from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — eterfaceID app admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const queryClient = useQueryClient();
  const integrations = useQuery({ queryKey: ["integrations"], queryFn: fetchIntegrations });
  const notepad = useQuery({ queryKey: ["api-notepad"], queryFn: fetchApiNotepad });
  const toggle = useServerFn(setIntegrationEnabled);
  const test = useServerFn(sendTestEmail);
  const saveEntry = useServerFn(saveApiNotepadEntry);
  const removeEntry = useServerFn(deleteApiNotepadEntry);
  const [testTo, setTestTo] = useState("");
  const [editing, setEditing] = useState<ApiNotepadEntry | null>(null);
  const [form, setForm] = useState({ title: "", purpose: "", status: "idea" as ApiNotepadEntry["status"], notes: "" });

  const switching = useMutation({
    mutationFn: async (input: { provider: string; enabled: boolean }) => toggle({ data: input }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const testing = useMutation({
    mutationFn: async () => test({ data: { to: testTo.trim() } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
      void queryClient.invalidateQueries({ queryKey: ["email-log"] });
    },
  });

  const savingEntry = useMutation({
    mutationFn: async (input: {
      id?: string;
      title: string;
      purpose: string | null;
      status: string;
      notes: string | null;
    }) => saveEntry({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-notepad"] });
      setEditing(null);
      setForm({ title: "", purpose: "", status: "idea", notes: "" });
    },
  });

  const deletingEntry = useMutation({
    mutationFn: async (id: string) => removeEntry({ data: { id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["api-notepad"] }),
  });

  function startEdit(entry: ApiNotepadEntry) {
    setEditing(entry);
    setForm({
      title: entry.title,
      purpose: entry.purpose ?? "",
      status: entry.status,
      notes: entry.notes ?? "",
    });
  }

  return (
    <AdminShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Integrations</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Outside services the platform can use. Keys are held in the secure store and never shown here.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="Connected services">
          <div className="space-y-4 text-sm">
            {(integrations.data ?? []).map((row: any) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)]/60 pb-4 last:border-0">
                <div>
                  <div className="font-medium">{row.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.category}
                    {row.last_checked_at ? ` · last used ${new Date(row.last_checked_at).toLocaleString()}` : ""}
                  </div>
                  {row.provider === "thekyb" ? (
                    <div className="mt-1 max-w-sm text-xs text-muted-foreground">
                      Official registry KYB and AML — complements Plaid bank identity. Create the API
                      secret under API integration at{" "}
                      <a
                        href="https://backoffice.thekyb.com/settings"
                        className="underline underline-offset-4"
                        target="_blank"
                        rel="noreferrer"
                      >
                        backoffice.thekyb.com/settings
                      </a>{" "}
                      and store it as THEKYB_API_TOKEN.
                    </div>
                  ) : null}
                  {row.provider === "plaid" ? (
                    <div className="mt-1 max-w-sm text-xs text-muted-foreground">
                      Bank-confirmed identity and imported transactions. Does not replace registry KYB.
                    </div>
                  ) : null}
                  {row.last_error ? (
                    <div className="mt-1 text-xs text-[var(--signal)]">{row.last_error}</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill tone={row.enabled ? "approved" : "pending"}>
                    {row.enabled ? "on" : "off"}
                  </StatusPill>
                  <button
                    type="button"
                    className={ghostButtonClass}
                    onClick={() => switching.mutate({ provider: row.provider, enabled: !row.enabled })}
                  >
                    {row.enabled ? "Turn off" : "Turn on"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Send a test email">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (testTo.trim()) testing.mutate();
            }}
          >
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
              className={`${inputClass} flex-1`}
            />
            <button type="submit" className={buttonClass} disabled={testing.isPending}>
              Send test
            </button>
          </form>
          {testing.data ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {testing.data.sent ? "Test email sent." : `Not sent: ${testing.data.reason ?? "unknown reason"}`}
            </p>
          ) : null}
          {testing.isError ? (
            <p className="mt-3 text-sm text-[var(--signal)]">{(testing.error as Error).message}</p>
          ) : null}
          <p className="mt-5 border-t border-[var(--rule)] pt-4 text-xs text-muted-foreground">
            Emails come from the sender name and address set under Company details. Until your own domain is
            verified with the email provider, delivery is limited to your own address.
          </p>
        </Panel>
      </div>

      <div className="mt-8">
        <Panel title="API wish list">
          <p className="text-sm text-muted-foreground">
            APIs you want to add to the platform. Record them here; connecting one needs its keys, which always go
            into the secure store and are never shown.
          </p>

          <form
            className="mt-4 grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.title.trim()) return;
              savingEntry.mutate({
                ...(editing?.id ? { id: editing.id } : {}),
                title: form.title.trim(),
                purpose: form.purpose.trim() || null,
                status: form.status,
                notes: form.notes.trim() || null,
              });
            }}
          >
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="API name (e.g. Interac verification)"
              className={inputClass}
            />
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ApiNotepadEntry["status"] })}
              className={inputClass}
            >
              <option value="idea">Idea</option>
              <option value="keys_needed">Waiting on keys</option>
              <option value="connecting">Connecting</option>
              <option value="live">Live</option>
            </select>
            <input
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="What it is for"
              className={`${inputClass} md:col-span-2`}
            />
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes — where the key comes from, monthly cost, anything else"
              rows={2}
              className={`${inputClass} md:col-span-2`}
            />
            <div className="flex items-center gap-2 md:col-span-2">
              <button type="submit" className={buttonClass} disabled={savingEntry.isPending}>
                {editing ? "Save changes" : "Add to wish list"}
              </button>
              {editing ? (
                <button
                  type="button"
                  className={ghostButtonClass}
                  onClick={() => {
                    setEditing(null);
                    setForm({ title: "", purpose: "", status: "idea", notes: "" });
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {savingEntry.isError ? (
            <p className="mt-2 text-sm text-[var(--signal)]">{(savingEntry.error as Error).message}</p>
          ) : null}

          <div className="mt-6 space-y-4 text-sm">
            {(notepad.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">Nothing recorded yet.</p>
            ) : null}
            {(notepad.data ?? []).map((entry: ApiNotepadEntry) => (
              <div key={entry.id} className="border-b border-[var(--rule)]/60 pb-4 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{entry.title}</div>
                    {entry.purpose ? <div className="text-xs text-muted-foreground">{entry.purpose}</div> : null}
                    {entry.notes ? <div className="mt-1 text-xs text-muted-foreground">{entry.notes}</div> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill tone={entry.status === "live" ? "approved" : "pending"}>{entry.status}</StatusPill>
                    <button type="button" className={ghostButtonClass} onClick={() => startEdit(entry)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={ghostButtonClass}
                      onClick={() => deletingEntry.mutate(entry.id)}
                      disabled={deletingEntry.isPending}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AdminShell>
  );
}
