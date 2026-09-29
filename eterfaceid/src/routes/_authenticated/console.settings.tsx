import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { ConsoleShell, Panel, StatusPill } from "@/components/console/shell";
import { useRoles } from "@/hooks/useSession";
import { createApiKey, revokeApiKey } from "@/lib/api-keys.functions";
import { fetchApiKeys } from "@/lib/console";
import { TeamPanel } from "@/components/console/team";
import { WebhooksPanel } from "@/components/console/webhooks";
import { NotificationsPanel } from "@/components/console/notifications";


export const Route = createFileRoute("/_authenticated/console/settings")({
  head: () => ({
    meta: [
      { title: "Settings — eterfaceID console" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useRoles();
  const createKey = useServerFn(createApiKey);
  const revokeKey = useServerFn(revokeApiKey);

  const [keyName, setKeyName] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "live">("sandbox");
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const keys = useQuery({ queryKey: ["api-keys"], queryFn: fetchApiKeys });


  const addKey = useMutation({
    mutationFn: async () => createKey({ data: { name: keyName, environment } }),
    onSuccess: (result) => {
      setFreshSecret(result.secret);
      setKeyName("");
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  const killKey = useMutation({
    mutationFn: async (id: string) => revokeKey({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
  });

  return (
    <ConsoleShell>
      <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Who can do what, and which API keys can reach your account. Only administrators can change
        either.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <TeamPanel isAdmin={isAdmin} />


        <Panel title="API keys">
          {isAdmin ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (keyName.trim()) addKey.mutate();
              }}
              className="flex flex-wrap gap-2"
            >
              <input
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="Key name, e.g. Onboarding service"
                maxLength={60}
                className="h-10 flex-1 rounded-md border border-[var(--rule)] bg-background px-3 text-sm outline-none focus-visible:border-[var(--signal)]"
              />
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as "sandbox" | "live")}
                className="h-10 rounded-md border border-[var(--rule)] bg-background px-2 text-sm"
              >
                <option value="sandbox">sandbox</option>
                <option value="live">live</option>
              </select>
              <button
                type="submit"
                disabled={addKey.isPending}
                className="h-10 rounded-md bg-[var(--ink)] px-4 text-sm text-background transition-opacity hover:opacity-90"
              >
                Create key
              </button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only administrators can create or revoke keys.
            </p>
          )}

          {addKey.isError ? (
            <p className="mt-3 text-sm text-[var(--signal)]">
              That key could not be created. {(addKey.error as Error).message}
            </p>
          ) : null}

          {freshSecret ? (
            <div className="mt-4 border border-[var(--signal)] bg-[var(--paper-deep)] p-3">
              <p className="text-xs uppercase tracking-widest text-[var(--signal)]">
                Copy this now — it is not shown again
              </p>
              <code className="mt-2 block break-all font-mono text-xs">{freshSecret}</code>
            </div>
          ) : null}

          <div className="mt-5 space-y-3 text-sm">
            {(keys.data ?? []).map((key) => (
              <div key={key.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{key.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {key.key_prefix}… · {key.environment}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill tone={key.revoked_at ? "rejected" : "approved"}>
                    {key.revoked_at ? "revoked" : "active"}
                  </StatusPill>
                  {isAdmin && !key.revoked_at ? (
                    <button
                      type="button"
                      onClick={() => killKey.mutate(key.id)}
                      className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--paper-deep)]"
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {(keys.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">No API keys yet.</p>
            ) : null}
          </div>
          <p className="mt-5 border-t border-[var(--rule)] pt-4 text-xs text-muted-foreground">
            Only a hash of each key is stored, so keys can be revoked but never re-displayed.
          </p>
        </Panel>

        <WebhooksPanel isAdmin={isAdmin} />

        <NotificationsPanel isAdmin={isAdmin} />
      </div>
    </ConsoleShell>
  );
}
