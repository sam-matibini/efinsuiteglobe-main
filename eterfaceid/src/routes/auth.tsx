import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — eterfaceID review console" },
      {
        name: "description",
        content:
          "Sign in to the eterfaceID review console to work verification cases, screening hits and monitoring alerts.",
      },
      { property: "og:title", content: "Sign in — eterfaceID review console" },
      {
        property: "og:description",
        content: "Access the eterfaceID review console.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, ready } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [hasInvite, setHasInvite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const token = window.sessionStorage.getItem("eid_invite_token");
    if (token) {
      setHasInvite(true);
      setMode("signup");
    }
  }, []);

  useEffect(() => {
    if (ready && session) void navigate({ to: "/console", replace: true });
  }, [ready, session, navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    if (mode === "signup" && !hasInvite && company.trim().length < 2) {
      setError("Enter your company name");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!hasInvite) window.sessionStorage.setItem("eid_company", company.trim());
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Check your email and confirm the address to finish creating the account.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }


  async function google() {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Google sign-in could not be started. Try again or use your email address.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <div className="border-b border-[var(--rule)] bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">
            <span className="text-[var(--ink)]">eterface</span>
            <span className="text-[var(--signal)]">ID</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to site
          </Link>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {mode === "signin" ? "Sign in to the console" : "Create a console account"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {hasInvite
            ? "You have been invited to a team. Create your account and you will join it straight away."
            : "The review console is where analysts work cases, adjudicate screening hits and keep the audit trail."}
        </p>


        <button
          type="button"
          onClick={google}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-md border border-[var(--rule)] bg-background px-4 text-sm font-medium transition-colors hover:bg-[var(--paper-deep)]"
        >
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-[var(--rule)]" />
          or
          <span className="h-px flex-1 bg-[var(--rule)]" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Work email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-[var(--rule)] bg-background px-3 text-sm outline-none focus-visible:border-[var(--signal)]"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-[var(--rule)] bg-background px-3 text-sm outline-none focus-visible:border-[var(--signal)]"
            />
          </div>
          {mode === "signup" && !hasInvite ? (
            <div>
              <label htmlFor="company" className="text-sm font-medium">
                Company name
              </label>
              <input
                id="company"
                value={company}
                autoComplete="organization"
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Payments Inc."
                className="mt-1 h-11 w-full rounded-md border border-[var(--rule)] bg-background px-3 text-sm outline-none focus-visible:border-[var(--signal)]"
              />
            </div>
          ) : null}


          {error ? <p className="text-sm text-[var(--signal)]">{error}</p> : null}
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="mt-6 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {mode === "signin"
            ? "No account yet? Create one"
            : "Already have an account? Sign in"}
        </button>

        <p className="mt-8 text-xs text-muted-foreground">
          Signing up creates your own company workspace and makes you its administrator. You can
          invite colleagues from Settings and choose what each of them can do.
        </p>

      </main>
    </div>
  );
}
