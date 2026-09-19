import { Link } from "@tanstack/react-router";
import { megaMenu } from "./nav-data";
import { BrandLogo } from "./BrandLogo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-rule bg-paper">
      <div className="mx-auto max-w-[1180px] px-5 py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link to="/" aria-label="eterfaceID home">
              <BrandLogo />
            </Link>
            <p className="mt-3 max-w-[22ch] text-[0.82rem] leading-relaxed text-ink-soft">
              Identity, business and financial-crime checks for regulated businesses in Canada and
              abroad.
            </p>
          </div>

          {megaMenu.map((group) => (
            <div key={group.heading}>
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                {group.heading}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label + link.to}>
                    <Link
                      to={link.to}
                      className="text-[0.85rem] text-ink transition-colors hover:text-signal"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-rule pt-6 text-[0.75rem] text-ink-soft md:flex-row md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} eterfaceID. All rights reserved.</p>
          <p>
            [Placeholder: registered office address] &middot; [Placeholder: support@email] &middot;
            [Placeholder: phone]
          </p>
        </div>
      </div>
    </footer>
  );
}
