import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { useOrganization } from "@/hooks/useSession";
import { acceptInvite, createOrganization } from "@/lib/teams.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your team — eterfaceID" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization, ready } = useOrganization();
  const create = useServerFn(createOrganization);
  const join = useServerFn(acceptInvite);

  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && organization) void navigate({ to: "/console", replace: true });
  }, [ready, organization, navigate]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem("eid_invite_token");
    if (stored) setToken(stored);
    const storedCompany = window.sessionStorage.getItem("eid_company");
    if (storedCompany) setName(storedCompany);
  }, []);


  async function finish(run: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await run();
      window.sessionStorage.removeItem("eid_invite_token");
      window.sessionStorage.removeItem("eid_company");

      await queryClient.invalidateQueries();
      void navigate({ to: "/console", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <h1 className="font-display text-3xl font-bold tracking-tight">Set up your team</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Create your company workspace, or join one you have been invited to. Your cases, documents
          and keys are visible only to your own team.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length >= 2) void finish(() => create({ data: { name } }));
          }}
          className="mt-8 space-y-3"
        >
          <label htmlFor="company" className="text-sm font-medium">
            Company name
          </label>
          <input
            id="company"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Payments Inc."
            className="h-11 w-full rounded-md border border-[var(--rule)] bg-background px-3 text-sm outline-none focus-visible:border-[var(--signal)]"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Create workspace
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-[var(--rule)]" />
          or
          <span className="h-px flex-1 bg-[var(--rule)]" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (token.trim()) void finish(() => join({ data: { token: token.trim() } }));
          }}
          className="space-y-3"
        >
          <label htmlFor="token" className="text-sm font-medium">
            Invitation code
          </label>
          <input
            id="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste the code from your invitation link"
            className="h-11 w-full rounded-md border border-[var(--rule)] bg-background px-3 text-sm outline-none focus-visible:border-[var(--signal)]"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center rounded-md border border-[var(--rule)] bg-background px-4 text-sm font-medium transition-colors hover:bg-[var(--paper-deep)] disabled:opacity-60"
          >
            Join the team
          </button>
        </form>

        {error ? <p className="mt-5 text-sm text-[var(--signal)]">{error}</p> : null}
      </main>
    </div>
  );
}
