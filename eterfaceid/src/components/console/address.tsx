import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Panel, StatusPill } from "@/components/console/shell";
import { supabase } from "@/integrations/supabase/client";
import { verifyAddress } from "@/lib/monitoring.functions";

async function fetchAddresses(caseId: string) {
  const { data, error } = await supabase
    .from("case_addresses")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export function AddressPanel({ caseId, canWrite }: { caseId: string; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const verify = useServerFn(verifyAddress);
  const addresses = useQuery({ queryKey: ["addresses", caseId], queryFn: () => fetchAddresses(caseId) });

  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("CA");

  const run = useMutation({
    mutationFn: async () =>
      verify({ data: { caseId, line1, city, region, postalCode, country } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["addresses", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    },
  });

  const field = "w-full rounded border border-[var(--rule)] bg-background px-3 py-2 text-sm text-foreground";

  return (
    <Panel title="Address and age verification">
      {canWrite ? (
        <div className="grid gap-3 sm:grid-cols-5">
          <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street address" className={`${field} sm:col-span-2`} />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={field} />
          <input value={region} onChange={(e) => setRegion(e.target.value.toUpperCase().slice(0, 2))} placeholder="ON" className={field} />
          <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="M5V 2T6" className={field} />
          <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))} placeholder="CA" className={field} />
          <button
            type="button"
            disabled={!line1 || !city || run.isPending}
            onClick={() => run.mutate()}
            className="rounded bg-[var(--ink)] px-4 py-2 text-sm font-medium text-background disabled:opacity-50 sm:col-span-2"
          >
            {run.isPending ? "Checking…" : "Verify address"}
          </button>
        </div>
      ) : null}
      {run.error ? <p className="mt-2 text-sm text-[var(--signal)]">{(run.error as Error).message}</p> : null}

      <ul className="mt-4 space-y-3">
        {(addresses.data ?? []).map((a: any) => (
          <li key={a.id} className="border border-[var(--rule)] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">
                {[a.line1, a.city, a.region, a.postal_code, a.country].filter(Boolean).join(", ")}
              </p>
              <StatusPill tone={a.result}>{a.result}</StatusPill>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {((a.checks ?? []) as any[]).map((c, i) => (
                <li key={i}>
                  {c.severity === "fail" ? "✗" : c.severity === "warn" ? "!" : "✓"} {c.label}
                  {c.detail ? ` — ${c.detail}` : ""}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {(addresses.data ?? []).length === 0 ? (
          <li className="text-sm text-muted-foreground">No address checked yet.</li>
        ) : null}
      </ul>
    </Panel>
  );
}
