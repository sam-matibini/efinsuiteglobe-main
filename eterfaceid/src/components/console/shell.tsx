import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useOrganization, useRoles, useSession } from "@/hooks/useSession";
import { usePlatformStaff } from "@/hooks/usePlatformStaff";

const navItems = [
  { to: "/console", label: "Cases", exact: true },
  { to: "/console/watchlists", label: "Watchlists", exact: false },
  { to: "/console/transactions", label: "Transactions", exact: false },
  { to: "/console/alerts", label: "Monitoring", exact: false },
  { to: "/console/reports", label: "Reports", exact: false },
  { to: "/console/compliance", label: "Coverage", exact: false },
  { to: "/console/audit", label: "Audit trail", exact: false },
  { to: "/console/go-live", label: "Go live", exact: false },
  { to: "/console/settings", label: "Settings", exact: false },

] as const;


export function ConsoleShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { roles } = useRoles();
  const { organization, ready } = useOrganization();
  const { isStaff } = usePlatformStaff();

  useEffect(() => {
    if (ready && !organization) void navigate({ to: "/onboarding", replace: true });
  }, [ready, organization, navigate]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }


  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <header className="border-b border-[var(--rule)] bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-6 py-4">
          <Link to="/console" className="font-display text-lg font-bold tracking-tight">
            <span className="text-[var(--ink)]">eterface</span>
            <span className="text-[var(--signal)]">ID</span>
            <span className="ml-2 align-middle text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Console
            </span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-5 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact ?? false }}
                activeProps={{ className: "text-foreground font-medium" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-sm">
            {isStaff ? (
              <Link to="/admin" className="text-[var(--signal)] transition-opacity hover:opacity-80">
                App admin
              </Link>
            ) : null}
            <span className="hidden text-muted-foreground sm:inline">
              {organization ? `${organization.name} · ` : ""}
              {user?.email}
              {roles.length ? ` · ${roles.join(", ")}` : ""}
            </span>

            <button
              type="button"
              onClick={signOut}
              className="rounded-md border border-[var(--rule)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--paper-deep)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: string; children: ReactNode }) {
  const tones: Record<string, string> = {
    approved: "border-[var(--verify)] text-[var(--verify)]",
    low: "border-[var(--verify)] text-[var(--verify)]",
    pass: "border-[var(--verify)] text-[var(--verify)]",
    clear: "border-[var(--verify)] text-[var(--verify)]",
    closed: "border-[var(--rule)] text-muted-foreground",
    false_positive: "border-[var(--rule)] text-muted-foreground",
    not_run: "border-[var(--rule)] text-muted-foreground",
    pending: "border-[var(--rule)] text-muted-foreground",
    in_review: "border-[var(--ink)] text-[var(--ink)]",
    review: "border-[var(--ink)] text-[var(--ink)]",
    medium: "border-[var(--ink)] text-[var(--ink)]",
    open: "border-[var(--signal)] text-[var(--signal)]",
    high: "border-[var(--signal)] text-[var(--signal)]",
    fail: "border-[var(--signal)] text-[var(--signal)]",
    rejected: "border-[var(--signal)] text-[var(--signal)]",
    true_positive: "border-[var(--signal)] text-[var(--signal)]",
    hit: "border-[var(--signal)] text-[var(--signal)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        tones[tone] ?? "border-[var(--rule)] text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-[var(--rule)] bg-background${className ? ` ${className}` : ""}`}>

      <div className="flex items-center justify-between gap-4 border-b border-[var(--rule)] px-5 py-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
