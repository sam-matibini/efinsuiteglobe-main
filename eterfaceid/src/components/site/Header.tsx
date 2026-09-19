import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { megaMenu, solutionsGroup } from "./nav-data";
import { BrandLogo } from "./BrandLogo";


const topLevel = [
  { label: "Solutions", panel: true },
  { label: "Industries", to: "/industries" },
  { label: "Compliance", to: "/compliance" },
  { label: "Developers", to: "/developers" },
  { label: "Pricing", to: "/pricing" },
] as const;

export function Header() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { session } = useSession();


  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPanelOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-background/95 backdrop-blur">
      <div
        ref={wrapRef}
        onMouseLeave={() => setPanelOpen(false)}
        className="mx-auto max-w-[1180px] px-5"
      >
        <div className="flex h-16 items-center justify-between gap-6">
          <Link to="/" aria-label="eterfaceID home">
            <BrandLogo />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
            {topLevel.map((item) =>
              "panel" in item ? (
                <button
                  key={item.label}
                  type="button"
                  aria-expanded={panelOpen}
                  onMouseEnter={() => setPanelOpen(true)}
                  onClick={() => setPanelOpen((v) => !v)}
                  className="text-[0.875rem] text-ink-soft transition-colors hover:text-ink"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.label}
                  to={item.to}
                  onMouseEnter={() => setPanelOpen(false)}
                  activeProps={{ className: "text-ink" }}
                  className="text-[0.875rem] text-ink-soft transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <Link
              to="/about"
              className="text-[0.875rem] text-ink-soft transition-colors hover:text-ink"
            >
              Company
            </Link>
            <Link
              to={session ? "/console" : "/auth"}
              className="text-[0.875rem] text-ink-soft transition-colors hover:text-ink"
            >
              {session ? "Console" : "Sign in"}
            </Link>
            <Link
              to="/contact"
              className="rounded-sm bg-primary px-4 py-2 text-[0.8125rem] font-medium text-primary-foreground transition-colors hover:bg-ink"
            >
              Talk to us
            </Link>
          </div>


          <button
            type="button"
            className="lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {panelOpen && (
          <div className="absolute inset-x-0 top-16 hidden border-b border-rule bg-background lg:block">
            <div className="mx-auto grid max-w-[1180px] grid-cols-4 gap-10 px-5 py-9">
              {megaMenu.map((group) => (
                <div key={group.heading}>
                  <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                    {group.heading}
                  </h2>
                  <ul className="mt-4 space-y-3.5">
                    {group.links.map((link) => (
                      <li key={link.label + link.to}>
                        <Link
                          to={link.to}
                          onClick={() => setPanelOpen(false)}
                          className="marker-bracket block text-[0.9rem] text-ink transition-colors hover:text-signal"
                        >
                          {link.label}
                          {link.blurb && (
                            <span className="mt-1 block text-[0.78rem] leading-snug text-ink-soft">
                              {link.blurb}
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {mobileOpen && (
        <div className="border-t border-rule bg-background px-5 py-6 lg:hidden">
          <ul className="space-y-3">
            {solutionsGroup.links.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className="marker-bracket block text-[0.95rem] text-ink"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="mt-5 space-y-3 border-t border-rule pt-5">
            {[
              { label: "Industries", to: "/industries" },
              { label: "Compliance", to: "/compliance" },
              { label: "Developers", to: "/developers" },
              { label: "Pricing", to: "/pricing" },
              { label: "About us", to: "/about" },
              { label: "Careers", to: "/careers" },
              { label: "Contact us", to: "/contact" },
            ].map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className="block text-[0.95rem] text-ink-soft"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
