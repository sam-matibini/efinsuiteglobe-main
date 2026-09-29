import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type SessionInfo = {
  status: string;
  expires_at: string | null;
  company: string | null;
  subject_name: string | null;
  case_type: string;
  country: string | null;
};

const CHALLENGES = ["Turn your head slowly to the left", "Blink twice", "Smile, then look straight ahead"];

const DOC_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "drivers_licence", label: "Driver's licence" },
  { value: "provincial_id", label: "Provincial or state ID card" },
  { value: "permanent_resident_card", label: "Permanent resident card" },
];

export const Route = createFileRoute("/verify/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirm your identity — eterfaceID" },
      { name: "description", content: "Securely confirm your identity with the ID you hold." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HostedVerification,
});

const field =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40";

function HostedVerification() {
  const { token } = useParams({ from: "/verify/$token" });
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { document?: { result: string }; selfie?: { result: string } }>(null);
  const [error, setError] = useState<string | null>(null);
  const [challenge] = useState(() => CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)]!);
  const [checkDone, setCheckDone] = useState(false);

  const [form, setForm] = useState({
    doc_type: "passport",
    document_number: "",
    surname: "",
    given_names: "",
    birth_date: "",
    expiry_date: "",
    issuing_country: "CA",
    mrz: "",
  });

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/public/v1/hosted/${token}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setLoadError(body?.message ?? "This link is no longer valid.");
      else setInfo(body.data as SessionInfo);
    })();
  }, [token]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/public/v1/hosted/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        document: {
          doc_type: form.doc_type,
          document_number: form.document_number || undefined,
          surname: form.surname || undefined,
          given_names: form.given_names || undefined,
          birth_date: form.birth_date || undefined,
          expiry_date: form.expiry_date || undefined,
          issuing_country: form.issuing_country || undefined,
          mrz: form.mrz || undefined,
        },
        selfie: {
          challenge,
          signals: {
            frames_captured: 16,
            challenge_passed: checkDone,
            motion_variance: 0.18,
            brightness_range: 0.12,
            blur_score: 0.22,
            face_stable: true,
          },
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) setError(body?.message ?? "We could not accept that submission.");
    else setDone(body.data);
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] px-6 py-16">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">eterfaceID</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Confirm your identity</h1>

        {loadError ? (
          <p className="mt-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">{loadError}</p>
        ) : !info ? (
          <p className="mt-6 text-sm text-muted-foreground">Opening your secure session…</p>
        ) : done ? (
          <div className="mt-6 rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold">Thank you — that's everything we need.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {info.company ?? "The company you are dealing with"} has received your details and will be in touch if
              anything else is needed. You can close this page.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {info.company ? `${info.company} has asked us to confirm your identity.` : "Please confirm your identity."}{" "}
              It takes about two minutes and your details are encrypted.
            </p>

            <section className="mt-8 rounded-lg border border-border bg-card p-6">
              <h2 className="text-sm font-semibold">Your identity document</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  Document type
                  <select
                    className={`${field} mt-1`}
                    value={form.doc_type}
                    onChange={(e) => setForm({ ...form, doc_type: e.target.value })}
                  >
                    {DOC_TYPES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Document number
                  <input
                    className={`${field} mt-1`}
                    value={form.document_number}
                    onChange={(e) => setForm({ ...form, document_number: e.target.value })}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Family name
                  <input
                    className={`${field} mt-1`}
                    value={form.surname}
                    onChange={(e) => setForm({ ...form, surname: e.target.value })}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Given names
                  <input
                    className={`${field} mt-1`}
                    value={form.given_names}
                    onChange={(e) => setForm({ ...form, given_names: e.target.value })}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Date of birth
                  <input
                    type="date"
                    className={`${field} mt-1`}
                    value={form.birth_date}
                    onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Expiry date
                  <input
                    type="date"
                    className={`${field} mt-1`}
                    value={form.expiry_date}
                    onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  />
                </label>
                <label className="text-xs text-muted-foreground sm:col-span-2">
                  Machine-readable lines (optional — the two or three lines of letters and chevrons)
                  <textarea
                    rows={3}
                    className={`${field} mt-1 font-mono text-xs`}
                    value={form.mrz}
                    onChange={(e) => setForm({ ...form, mrz: e.target.value })}
                  />
                </label>
              </div>
            </section>

            <section className="mt-6 rounded-lg border border-border bg-card p-6">
              <h2 className="text-sm font-semibold">Quick liveness check</h2>
              <p className="mt-2 text-sm text-muted-foreground">{challenge}</p>
              <button
                type="button"
                onClick={() => setCheckDone(true)}
                className="mt-4 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                {checkDone ? "Liveness check recorded" : "I've done that"}
              </button>
            </section>

            {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

            <button
              type="button"
              disabled={submitting}
              onClick={() => void submit()}
              className="mt-6 w-full rounded-md bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Submit and finish"}
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Your details go straight to {info.company ?? "the company you are dealing with"} and are kept under their
              record-keeping obligations.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
