import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Coming Soon — Something Beautiful" },
      { name: "description", content: "A new experience is on the way. Stay tuned for updates." },
      { property: "og:title", content: "Coming Soon — Something Beautiful" },
      { property: "og:description", content: "A new experience is on the way. Stay tuned for updates." },
    ],
  }),
});

function Index() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
      setEmail("");
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-24 text-center">
      {/* Background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "url('/hero-placeholder.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(60px)",
        }}
      />

      {/* Decorative circle */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-cream-300 opacity-30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-cream-400 opacity-20 blur-3xl" />

      <div className="relative z-10 max-w-lg">
        {/* Logo mark */}
        <div className="mx-auto mb-10 flex h-14 w-14 items-center justify-center rounded-full bg-foreground">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-background"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>

        <p className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Coming Soon
        </p>

        <h1 className="font-serif text-5xl font-light leading-[1.1] tracking-tight text-foreground sm:text-6xl">
          Something
          <br />
          <span className="italic">beautiful</span> is brewing
        </h1>

        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          We are crafting something special. Be the first to know when it is ready.
        </p>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
            <input
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitted}
              className="h-12 flex-1 rounded-full border border-border bg-card px-6 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-foreground transition-shadow focus:ring-2"
            />
            <button
              type="submit"
              disabled={submitted}
              className="h-12 rounded-full bg-foreground px-8 text-sm font-medium text-primary-foreground transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {submitted ? "Thank you!" : "Notify me"}
            </button>
          </div>
        </form>

        {submitted && (
          <p className="mt-4 text-sm text-muted-foreground">
            You will hear from us soon.
          </p>
        )}

        {/* Social links */}
        <div className="mt-16 flex items-center justify-center gap-6">
          <a
            href="#"
            aria-label="Twitter"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
            </svg>
          </a>
          <a
            href="#"
            aria-label="Instagram"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </svg>
          </a>
          <a
            href="#"
            aria-label="LinkedIn"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
              <rect width="4" height="12" x="2" y="9" />
              <circle cx="4.5" cy="6.5" r="2.5" />
            </svg>
          </a>
        </div>

        <footer className="mt-16 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} All rights reserved.
        </footer>
      </div>
    </div>
  );
}
