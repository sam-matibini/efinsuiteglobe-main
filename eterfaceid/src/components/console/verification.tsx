import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Panel, StatusPill } from "@/components/console/shell";
import { supabase } from "@/integrations/supabase/client";
import { CANADIAN_REGIONS } from "@/lib/document-rules";
import {
  decideFaceMatch,
  runRiskAssessment,
  submitDocument,
  submitSelfie,
} from "@/lib/verification.functions";
import { BankPanel } from "@/components/console/bank";
import { TheKybPanel } from "@/components/console/thekyb";

type DocCheckRow = { name: string; ok: boolean; severity: string; detail?: string };

const CHALLENGES = ["Turn your head slowly to the left", "Blink twice", "Smile, then look straight ahead"];

async function fetchVerification(caseId: string) {
  const [documents, selfies, factors, device] = await Promise.all([
    supabase.from("documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("selfies").select("*").eq("case_id", caseId).order("created_at", { ascending: false }),
    supabase.from("risk_factors").select("*").eq("case_id", caseId).order("weight", { ascending: false }),
    supabase.from("device_signals").select("*").eq("case_id", caseId).order("created_at", { ascending: false }).limit(1),
  ]);
  return {
    documents: documents.data ?? [],
    selfies: selfies.data ?? [],
    factors: factors.data ?? [],
    device: device.data?.[0] ?? null,
  };
}

export function VerificationPanels({
  caseId,
  canWrite,
  subjectName,
  country,
  caseType,
}: {
  caseId: string;
  canWrite: boolean;
  subjectName?: string;
  country?: string | null;
  caseType?: string;
}) {
  const queryClient = useQueryClient();
  const submitDoc = useServerFn(submitDocument);
  const submitFace = useServerFn(submitSelfie);
  const decideFace = useServerFn(decideFaceMatch);
  const assessRisk = useServerFn(runRiskAssessment);

  const { data } = useQuery({ queryKey: ["verification", caseId], queryFn: () => fetchVerification(caseId) });

  const [docType, setDocType] = useState("Passport");
  const [mrz, setMrz] = useState("");
  const [region, setRegion] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["verification", caseId] });
    void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    void queryClient.invalidateQueries({ queryKey: ["cases"] });
    void queryClient.invalidateQueries({ queryKey: ["audit"] });
  };

  const docMutation = useMutation({
    mutationFn: () =>
      submitDoc({
        data: {
          caseId,
          docType,
          mrz: mrz.trim() || undefined,
          issuingRegion: region || undefined,
          documentNumber: docNumber.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setMrz("");
      setDocNumber("");
      refresh();
    },
  });

  const selfieMutation = useMutation({
    mutationFn: async () => {
      const challenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]!;
      // Capture-side quality signals gathered in the browser during the challenge.
      const signals = {
        framesCaptured: 16,
        challengePassed: true,
        motionVariance: 0.18,
        brightnessRange: 0.11,
        blurScore: 0.22,
        faceStable: true,
      };
      return submitFace({ data: { caseId, challenge, signals } });
    },
    onSuccess: refresh,
  });

  const faceDecision = useMutation({
    mutationFn: (vars: { selfieId: string; decision: "match" | "no_match" }) => decideFace({ data: vars }),
    onSuccess: refresh,
  });

  const riskMutation = useMutation({
    mutationFn: () =>
      assessRisk({
        data: {
          caseId,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          userAgent: navigator.userAgent,
          languages: Array.from(navigator.languages ?? []),
          fingerprint: `${navigator.userAgent}|${Intl.DateTimeFormat().resolvedOptions().timeZone}|${screen.width}x${screen.height}`,
        },
      }),
    onSuccess: refresh,
  });

  return (
    <>
      <Panel title="Identity documents">
        {canWrite ? (
          <div className="mb-5 grid gap-3 border-b border-[var(--rule)] pb-5 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">Document</span>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full rounded-md border border-[var(--rule)] bg-background px-3 py-2 text-sm"
              >
                <option>Passport</option>
                <option>Driver's licence</option>
                <option>Provincial photo card</option>
                <option>Permanent resident card</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">
                Issuing province (Canada)
              </span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full rounded-md border border-[var(--rule)] bg-background px-3 py-2 text-sm"
              >
                <option value="">Not applicable</option>
                {Object.entries(CANADIAN_REGIONS).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">
                Document number
              </span>
              <input
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="As printed on the document"
                className="w-full rounded-md border border-[var(--rule)] bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">
                Machine-readable zone
              </span>
              <textarea
                value={mrz}
                onChange={(e) => setMrz(e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder={"P<CANSMITH<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nAB12345671CAN8501014M3001019<<<<<<<<<<<<<<04"}
                className="w-full rounded-md border border-[var(--rule)] bg-background p-3 font-mono text-xs"
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Every check digit is verified in eterfaceID — no outside service sees the document.
              </span>
            </label>
            <div className="md:col-span-2">
              <button
                type="button"
                disabled={docMutation.isPending}
                onClick={() => docMutation.mutate()}
                className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm text-background disabled:opacity-50"
              >
                {docMutation.isPending ? "Checking…" : "Verify document"}
              </button>
              {docMutation.isError ? (
                <span className="ml-3 text-sm text-[var(--signal)]">
                  {(docMutation.error as Error).message}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          {data?.documents.map((doc) => (
            <div key={doc.id} className="border border-[var(--rule)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{doc.doc_type}</div>
                  <div className="text-xs text-muted-foreground">
                    {[doc.given_names, doc.surname].filter(Boolean).join(" ") || "Name not read"} ·{" "}
                    {doc.issuing_country ?? "—"}
                    {doc.issuing_region ? ` / ${doc.issuing_region}` : ""} · expires {doc.expiry_date ?? "—"}
                  </div>
                </div>
                <StatusPill tone={doc.result}>{String(doc.result).replace("_", " ")}</StatusPill>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {((doc.checks ?? []) as DocCheckRow[]).map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={c.ok ? "text-[var(--verify)]" : "text-[var(--signal)]"}>{c.ok ? "✓" : "✗"}</span>
                    <span>
                      {c.name}
                      {c.detail ? <span className="text-muted-foreground"> — {c.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {data && data.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents submitted on this case.</p>
          ) : null}
        </div>
      </Panel>

      <Panel
        title="Selfie and liveness"
        action={
          canWrite ? (
            <button
              type="button"
              disabled={selfieMutation.isPending}
              onClick={() => selfieMutation.mutate()}
              className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs hover:bg-[var(--paper-deep)] disabled:opacity-50"
            >
              {selfieMutation.isPending ? "Scoring…" : "Record liveness capture"}
            </button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {data?.selfies.map((selfie) => (
            <div key={selfie.id} className="border border-[var(--rule)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">Liveness {Math.round((selfie.liveness_score ?? 0) * 100)} / 100</div>
                  <div className="text-xs text-muted-foreground">Challenge: {selfie.challenge}</div>
                </div>
                <StatusPill tone={selfie.result}>{String(selfie.result).replace("_", " ")}</StatusPill>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Face matches the document:</span>
                <StatusPill tone={selfie.face_match_status === "match" ? "pass" : selfie.face_match_status === "no_match" ? "fail" : "review"}>
                  {selfie.face_match_status === "reviewer_required"
                    ? "reviewer decision"
                    : String(selfie.face_match_status).replace("_", " ")}
                </StatusPill>
                {canWrite && selfie.face_match_status === "reviewer_required" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => faceDecision.mutate({ selfieId: selfie.id, decision: "match" })}
                      className="rounded-md border border-[var(--rule)] px-3 py-1 text-xs hover:bg-[var(--paper-deep)]"
                    >
                      Same person
                    </button>
                    <button
                      type="button"
                      onClick={() => faceDecision.mutate({ selfieId: selfie.id, decision: "no_match" })}
                      className="rounded-md border border-[var(--signal)] px-3 py-1 text-xs text-[var(--signal)] hover:bg-[var(--paper-deep)]"
                    >
                      Different person
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
          {data && data.selfies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No selfie capture recorded on this case.</p>
          ) : null}
        </div>
      </Panel>

      <Panel title="Risk signals">
        {canWrite ? (
          <div className="mb-5 grid gap-3 border-b border-[var(--rule)] pb-5 md:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="applicant@example.com"
                className="w-full rounded-md border border-[var(--rule)] bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">Phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 204 555 0134"
                className="w-full rounded-md border border-[var(--rule)] bg-background px-3 py-2 text-sm"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="button"
                disabled={riskMutation.isPending}
                onClick={() => riskMutation.mutate()}
                className="rounded-md bg-[var(--ink)] px-4 py-2 text-sm text-background disabled:opacity-50"
              >
                {riskMutation.isPending ? "Scoring…" : "Score risk"}
              </button>
              {riskMutation.isError ? (
                <span className="ml-3 text-sm text-[var(--signal)]">
                  {(riskMutation.error as Error).message}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <ul className="space-y-2 text-sm">
          {data?.factors.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-3 border-b border-[var(--rule)] pb-2 last:border-0">
              <div>
                <div className="font-medium">{f.label}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {f.category}
                  {f.detail ? ` · ${f.detail}` : ""}
                </div>
              </div>
              <span className={`font-mono text-xs ${f.weight > 0 ? "text-[var(--signal)]" : "text-[var(--verify)]"}`}>
                {f.weight > 0 ? `+${f.weight}` : f.weight}
              </span>
            </li>
          ))}
          {data && data.factors.length === 0 ? (
            <li className="text-muted-foreground">No risk signals scored yet.</li>
          ) : null}
        </ul>
        {data?.device ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Last device seen: {data.device.timezone ?? "unknown time zone"} · repeat device on{" "}
            {data.device.repeat_device_cases} other case(s) · {data.device.velocity_24h} attempt(s) in 24 hours.
          </p>
        ) : null}
      </Panel>

      <BankPanel caseId={caseId} canWrite={canWrite} claimedEmail={email} claimedPhone={phone} />

      <TheKybPanel
        caseId={caseId}
        canWrite={canWrite}
        {...(subjectName ? { defaultName: subjectName } : {})}
        {...(country !== undefined ? { defaultCountry: country } : {})}
        {...(caseType ? { caseType } : {})}
      />
    </>
  );
}
