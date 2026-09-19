import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Panel, StatusPill } from "@/components/console/shell";
import { supabase } from "@/integrations/supabase/client";
import { fetchWebhookDeliveries, fetchWebhookEndpoints, logAudit } from "@/lib/console";

const EVENTS = ["case.created", "screening.hits", "transaction.flagged"];

export function WebhooksPanel({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const endpoints = useQuery({ queryKey: ["webhook-endpoints"], queryFn: fetchWebhookEndpoints });
  const deliveries = useQuery({ queryKey: ["webhook-deliveries"], queryFn: fetchWebhookDeliveries });

  const [url, setUrl] = useState("");
  const [environment, setEnvironment] = useState("sandbox");
  const [secret, setSecret] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const raw = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const signing = `whsec_${raw}`;
      const { data, error } = await supabase
        .from("webhook_endpoints")
        .insert({ url, environment, secret: signing, events: EVENTS })
        .select("id")
        .single();
      if (error) throw error;
      await logAudit("webhook.created", "webhook_endpoint", data.id, { url, environment });
      return signing;
    },
    onSuccess: (signing) => {
      setSecret(signing);
      setUrl("");
      void queryClient.invalidateQueries({ queryKey: ["webhook-endpoints"] });
    },
  });

  const toggle = useMutation({
    mutationFn: async (vars: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("webhook_endpoints")
        .update({ enabled: vars.enabled })
        .eq("id", vars.id);
      if (error) throw error;
      await logAudit("webhook.updated", "webhook_endpoint", vars.id, { enabled: vars.enabled });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["webhook-endpoints"] }),
  });

  return (
    <Panel title="Webhooks">
      <p className="text-sm text-muted-foreground">
        We post events to your URL and sign every request with your signing secret in the
        <span className="font-mono"> eterfaceid-signature </span>
        header so you can confirm it came from us. Events: {EVENTS.join(", ")}.
      </p>

      {isAdmin ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">
            Endpoint URL
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.example.com/hooks/eterfaceid"
              className="mt-1 w-80 rounded border border-[var(--rule)] bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
            />
          </label>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">
            Environment
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="mt-1 rounded border border-[var(--rule)] bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
            >
              <option value="sandbox">Sandbox</option>
              <option value="live">Live</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!url || create.isPending}
            onClick={() => create.mutate()}
            className="rounded bg-[var(--ink)] px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            Add endpoint
          </button>
        </div>
      ) : null}

      {secret ? (
        <p className="mt-3 break-all border border-[var(--signal)] p-3 font-mono text-xs">
          Signing secret (shown once): {secret}
        </p>
      ) : null}

      <ul className="mt-4 divide-y divide-[var(--rule)]">
        {(endpoints.data ?? []).map((e: any) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="break-all font-mono text-sm">{e.url}</p>
              <p className="text-xs text-muted-foreground">{e.environment}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill tone={e.enabled ? "approved" : "closed"}>{e.enabled ? "enabled" : "paused"}</StatusPill>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => toggle.mutate({ id: e.id, enabled: !e.enabled })}
                  className="rounded border border-[var(--rule)] px-3 py-1.5 text-sm"
                >
                  {e.enabled ? "Pause" : "Enable"}
                </button>
              ) : null}
            </div>
          </li>
        ))}
        {(endpoints.data ?? []).length === 0 ? (
          <li className="py-3 text-sm text-muted-foreground">No endpoints yet.</li>
        ) : null}
      </ul>

      {(deliveries.data ?? []).length ? (
        <div className="mt-6">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Recent deliveries</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {(deliveries.data ?? []).map((d: any) => (
              <li key={d.id} className="text-muted-foreground">
                {new Date(d.created_at).toLocaleString()} · {d.event} · {d.status}
                {d.response_code ? ` (${d.response_code})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
