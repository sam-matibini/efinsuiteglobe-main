import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Panel, StatusPill } from "@/components/console/shell";
import { supabase } from "@/integrations/supabase/client";
import {
  createLinkToken,
  exchangePublicToken,
  plaidStatus,
  runIdentityCheck,
  syncTransactions,
} from "@/lib/plaid.functions";

type Comparison = { field: string; claimed: string; bank: string; status: "match" | "close" | "different" };

declare global {
  interface Window {
    Plaid?: {
      create(config: {
        token: string;
        onSuccess: (publicToken: string) => void;
        onExit: () => void;
      }): { open: () => void };
    };
  }
}

const PLAID_SCRIPT = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";

/** Loads Plaid Link in the browser only, on first use. */
async function loadPlaid() {
  if (window.Plaid) return window.Plaid;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PLAID_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Plaid could not be loaded")));
      return;
    }
    const script = document.createElement("script");
    script.src = PLAID_SCRIPT;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Plaid could not be loaded"));
    document.head.appendChild(script);
  });
  if (!window.Plaid) throw new Error("Plaid could not be loaded");
  return window.Plaid;
}

async function fetchBank(caseId: string) {
  const [items, results] = await Promise.all([
    supabase.from("plaid_items").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase
      .from("plaid_identity_results")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false }),
  ]);
  return { items: items.data ?? [], results: results.data ?? [] };
}

export function BankPanel({
  caseId,
  canWrite,
  claimedEmail,
  claimedPhone,
}: {
  caseId: string;
  canWrite: boolean;
  claimedEmail?: string;
  claimedPhone?: string;
}) {
  const queryClient = useQueryClient();
  const status = useServerFn(plaidStatus);
  const makeToken = useServerFn(createLinkToken);
  const exchange = useServerFn(exchangePublicToken);
  const identity = useServerFn(runIdentityCheck);
  const sync = useServerFn(syncTransactions);

  const settings = useQuery({ queryKey: ["plaid-status"], queryFn: () => status({}) });
  const { data } = useQuery({ queryKey: ["bank", caseId], queryFn: () => fetchBank(caseId) });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["bank", caseId] });
    void queryClient.invalidateQueries({ queryKey: ["verification", caseId] });
    void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const link = useMutation({
    mutationFn: async () => {
      const Plaid = await loadPlaid();
      const { linkToken } = await makeToken({ data: { caseId } });
      await new Promise<void>((resolve, reject) => {
        const handler = Plaid.create({
          token: linkToken,
          onSuccess: (publicToken) => {
            exchange({ data: { caseId, publicToken } })
              .then(() => resolve())
              .catch(reject);
          },
          onExit: () => resolve(),
        });
        handler.open();
      });
    },
    onSuccess: refresh,
  });

  const check = useMutation({
    mutationFn: (itemId: string) =>
      identity({
        data: {
          caseId,
          itemId,
          claimedEmail: claimedEmail?.trim() || undefined,
          claimedPhone: claimedPhone?.trim() || undefined,
        },
      }),
    onSuccess: refresh,
  });

  const pull = useMutation({
    mutationFn: (itemId: string) => sync({ data: { itemId } }),
    onSuccess: refresh,
  });

  if (settings.data && !settings.data.enabled) return null;

  return (
    <Panel
      title="Bank-confirmed identity"
      action={
        canWrite ? (
          <button
            type="button"
            disabled={link.isPending}
            onClick={() => link.mutate()}
            className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs hover:bg-[var(--paper-deep)] disabled:opacity-50"
          >
            {link.isPending ? "Opening…" : "Connect bank"}
          </button>
        ) : undefined
      }
    >
      {settings.data && !settings.data.configured ? (
        <p className="mb-4 text-sm text-[var(--signal)]">
          Bank connections are switched on but the credentials have not been added yet.
        </p>
      ) : null}
      {link.isError ? (
        <p className="mb-4 text-sm text-[var(--signal)]">{(link.error as Error).message}</p>
      ) : null}

      <div className="space-y-4">
        {data?.items.map((item) => (
          <div key={item.id} className="border border-[var(--rule)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{item.institution_name ?? "Linked bank"}</div>
                <div className="text-xs text-muted-foreground">
                  {item.environment} ·{" "}
                  {item.last_synced_at
                    ? `last activity pulled ${new Date(item.last_synced_at).toLocaleString()}`
                    : "no activity pulled yet"}
                </div>
                {item.last_error ? (
                  <div className="mt-1 text-xs text-[var(--signal)]">{item.last_error}</div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <StatusPill tone={item.status === "active" ? "approved" : "rejected"}>{item.status}</StatusPill>
                {canWrite ? (
                  <>
                    <button
                      type="button"
                      disabled={check.isPending}
                      onClick={() => check.mutate(item.id)}
                      className="rounded-md border border-[var(--rule)] px-3 py-1 text-xs hover:bg-[var(--paper-deep)] disabled:opacity-50"
                    >
                      Check identity
                    </button>
                    <button
                      type="button"
                      disabled={pull.isPending}
                      onClick={() => pull.mutate(item.id)}
                      className="rounded-md border border-[var(--rule)] px-3 py-1 text-xs hover:bg-[var(--paper-deep)] disabled:opacity-50"
                    >
                      Pull transactions
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {data && data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No bank linked on this case. The customer must be present to sign in to their bank.
          </p>
        ) : null}

        {data?.results.map((row) => (
          <div key={row.id} className="border border-[var(--rule)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">
                What {row.institution_name ?? "the bank"} holds · {new Date(row.created_at).toLocaleDateString()}
              </div>
              <StatusPill tone={row.result}>{String(row.result).replace("_", " ")}</StatusPill>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {((row.comparisons ?? []) as unknown as Comparison[]).map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    className={
                      c.status === "match"
                        ? "text-[var(--verify)]"
                        : c.status === "close"
                          ? "text-muted-foreground"
                          : "text-[var(--signal)]"
                    }
                  >
                    {c.status === "match" ? "✓" : c.status === "close" ? "~" : "✗"}
                  </span>
                  <span>
                    {c.field} — claimed “{c.claimed}”, bank holds “{c.bank}”
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-5 border-t border-[var(--rule)] pt-4 text-xs text-muted-foreground">
        The customer signs in to their own bank; eterfaceID never sees their banking password. Imported
        transactions run through the same monitoring rules as everything else.
      </p>
    </Panel>
  );
}
