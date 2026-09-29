import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Panel, StatusPill } from "@/components/console/shell";
import { supabase } from "@/integrations/supabase/client";
import type { TheKybSearchHit } from "@/lib/thekyb";
import {
  attachTheKybCompany,
  screenTheKybAml,
  searchTheKyb,
  thekybStatus,
} from "@/lib/thekyb.functions";

async function fetchProfiles(caseId: string) {
  const { data, error } = await supabase
    .from("thekyb_profiles")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export function TheKybPanel({
  caseId,
  canWrite,
  defaultName,
  defaultCountry,
  caseType,
}: {
  caseId: string;
  canWrite: boolean;
  defaultName?: string;
  defaultCountry?: string | null;
  caseType?: string;
}) {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(thekybStatus);
  const searchFn = useServerFn(searchTheKyb);
  const attachFn = useServerFn(attachTheKybCompany);
  const amlFn = useServerFn(screenTheKybAml);

  const settings = useQuery({ queryKey: ["thekyb-status"], queryFn: () => statusFn({}) });
  const { data: profiles } = useQuery({
    queryKey: ["thekyb", caseId],
    queryFn: () => fetchProfiles(caseId),
  });

  const [name, setName] = useState(defaultName ?? "");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [country, setCountry] = useState(defaultCountry ?? "CA");
  const [hits, setHits] = useState<TheKybSearchHit[]>([]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["thekyb", caseId] });
    void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    void queryClient.invalidateQueries({ queryKey: ["cases"] });
    void queryClient.invalidateQueries({ queryKey: ["audit"] });
  };

  const search = useMutation({
    mutationFn: () =>
      searchFn({
        data: {
          caseId,
          name: name.trim() || undefined,
          registrationNumber: registrationNumber.trim() || undefined,
          country: country.trim() || undefined,
        },
      }),
    onSuccess: (result) => setHits(result.hits),
  });

  const attach = useMutation({
    mutationFn: (hit: TheKybSearchHit) =>
      attachFn({
        data: {
          caseId,
          kybResponseId: hit.kyb_response_id,
          kybRequestId: hit.kyb_request_id,
          name: hit.name,
          registrationNumber: hit.registration_number ?? undefined,
          countryCode: hit.country_code ?? undefined,
          status: hit.status ?? undefined,
          type: hit.type ?? undefined,
          riskLevel: hit.risk_level ?? undefined,
          verificationStatus: hit.verification_status ?? undefined,
        },
      }),
    onSuccess: () => {
      setHits([]);
      refresh();
    },
  });

  const aml = useMutation({
    mutationFn: (profileId?: string) =>
      amlFn({
        data: {
          caseId,
          profileId,
          name: name.trim() || undefined,
          entityType: caseType === "person" ? "Person" : "Company",
        },
      }),
    onSuccess: refresh,
  });

  if (settings.data && !settings.data.enabled) return null;

  return (
    <Panel
      title="Official registry (The KYB)"
      action={
        canWrite ? (
          <button
            type="button"
            disabled={aml.isPending}
            onClick={() => aml.mutate(profiles?.[0]?.id)}
            className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs hover:bg-[var(--paper-deep)] disabled:opacity-50"
          >
            {aml.isPending ? "Screening…" : "Screen with The KYB AML"}
          </button>
        ) : undefined
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        Complements bank-confirmed identity from Plaid. The KYB pulls legal existence, officers and
        beneficial owners from official registries, then screens the entity and its people.
      </p>

      {settings.data && !settings.data.configured ? (
        <p className="mb-4 text-sm text-[var(--signal)]">
          The KYB is switched on but the API secret has not been added yet. Generate it in{" "}
          <a
            href="https://backoffice.thekyb.com/settings"
            className="underline underline-offset-4"
            target="_blank"
            rel="noreferrer"
          >
            The KYB back office
          </a>{" "}
          and store it as THEKYB_API_TOKEN.
        </p>
      ) : null}

      {canWrite ? (
        <form
          className="mb-5 grid gap-3 border-b border-[var(--rule)] pb-5 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            search.mutate();
          }}
        >
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">
              Company name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Legal name as registered"
              className="w-full rounded-md border border-[var(--rule)] bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">
              Registration number
            </span>
            <input
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-md border border-[var(--rule)] bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">
              Country
            </span>
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="CA"
              className="w-full rounded-md border border-[var(--rule)] bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={search.isPending}
              className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm text-background disabled:opacity-50"
            >
              {search.isPending ? "Searching registries…" : "Search official registries"}
            </button>
            {search.isError ? (
              <span className="ml-3 text-sm text-[var(--signal)]">
                {(search.error as Error).message}
              </span>
            ) : null}
            {attach.isError ? (
              <span className="ml-3 text-sm text-[var(--signal)]">
                {(attach.error as Error).message}
              </span>
            ) : null}
            {aml.isError ? (
              <span className="ml-3 text-sm text-[var(--signal)]">
                {(aml.error as Error).message}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}

      {hits.length ? (
        <div className="mb-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Search results</p>
          {hits.map((hit) => (
            <div
              key={hit.kyb_response_id}
              className="flex flex-wrap items-center justify-between gap-3 border border-[var(--rule)] px-4 py-3"
            >
              <div>
                <div className="font-medium">{hit.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[hit.registration_number, hit.country_code, hit.type, hit.status]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              {canWrite ? (
                <button
                  type="button"
                  disabled={attach.isPending}
                  onClick={() => attach.mutate(hit)}
                  className="rounded-md border border-[var(--rule)] px-3 py-1 text-xs hover:bg-[var(--paper-deep)] disabled:opacity-50"
                >
                  {attach.isPending ? "Attaching…" : "Attach to case"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        {profiles?.map((row) => (
          <div key={row.id} className="border border-[var(--rule)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{row.company_name}</div>
                <div className="text-xs text-muted-foreground">
                  {[row.registration_number, row.country_code, row.company_type, row.company_status]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {row.verification_status ? (
                  <StatusPill
                    tone={row.verification_status === "verified" ? "approved" : "pending"}
                  >
                    {row.verification_status}
                  </StatusPill>
                ) : null}
                {canWrite ? (
                  <button
                    type="button"
                    disabled={aml.isPending}
                    onClick={() => aml.mutate(row.id)}
                    className="rounded-md border border-[var(--rule)] px-3 py-1 text-xs hover:bg-[var(--paper-deep)] disabled:opacity-50"
                  >
                    AML this entity
                  </button>
                ) : null}
              </div>
            </div>
            {row.aml_match_status ? (
              <p className="mt-3 text-sm text-muted-foreground">
                AML: {row.aml_match_status}
                {Array.isArray(row.aml_hits) && row.aml_hits.length
                  ? ` · ${row.aml_hits.length} profile(s)`
                  : ""}
              </p>
            ) : null}
          </div>
        ))}
        {profiles && profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No registry profile on this case yet. Search by legal name or number, then attach the
            matching company.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
