import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { usePlatformStaff } from "@/hooks/usePlatformStaff";

export { usePlatformStaff };

const navItems = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/applications", label: "Live access", exact: false },
  { to: "/admin/plans", label: "Plans & pricing", exact: false },

  { to: "/admin/billing", label: "Billing", exact: false },
  { to: "/admin/owner", label: "Company details", exact: false },
  { to: "/admin/integrations", label: "Integrations", exact: false },
  { to: "/admin/emails", label: "Email log", exact: false },
] as const;


export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { isStaff, ready } = usePlatformStaff();

  useEffect(() => {
    if (ready && !isStaff) void navigate({ to: "/console", replace: true });
  }, [ready, isStaff, navigate]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  if (!ready) {
    return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isStaff) return null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--paper)]">
      <header className="border-b border-[var(--rule)] bg-[var(--ink)] text-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-6 px-6 py-4">
          <Link to="/admin" className="font-display text-lg font-bold tracking-tight">
            <span>eterface</span>
            <span className="text-[var(--signal)]">ID</span>
            <span className="ml-2 align-middle text-xs font-medium uppercase tracking-widest opacity-70">
              App admin
            </span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-5 text-sm">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact ?? false }}
                activeProps={{ className: "font-medium opacity-100" }}
                inactiveProps={{ className: "opacity-70" }}
                className="transition-opacity hover:opacity-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/console" className="opacity-70 transition-opacity hover:opacity-100">
              Console
            </Link>
            <span className="hidden opacity-70 sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={signOut}
              className="rounded-md border border-background/30 px-3 py-1.5 text-sm transition-colors hover:bg-background/10"
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

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-md border border-[var(--rule)] bg-background px-3 text-sm outline-none focus-visible:border-[var(--signal)]";
export const buttonClass =
  "h-10 rounded-md bg-[var(--ink)] px-4 text-sm text-background transition-opacity hover:opacity-90 disabled:opacity-50";
export const ghostButtonClass =
  "rounded-md border border-[var(--rule)] px-3 py-1.5 text-xs transition-colors hover:bg-[var(--paper-deep)]";
