import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto w-full max-w-[1180px] px-5", className)}>{children}</div>;
}

export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-rule bg-paper">
      <Container className="py-16 md:py-24">
        {eyebrow && (
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-signal">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-4 max-w-[19ch] text-[2.4rem] font-semibold leading-[1.06] text-ink md:text-[3.35rem]">
          {title}
        </h1>
        {lede && (
          <p className="mt-6 max-w-[62ch] text-[1.03rem] leading-[1.65] text-ink-soft">{lede}</p>
        )}
        {children}
      </Container>
    </section>
  );
}

export function Section({
  title,
  intro,
  children,
  className,
  id,
}: {
  title?: string;
  intro?: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-16 md:py-20", className)}>
      <Container>
        {title && (
          <h2 className="max-w-[24ch] text-[1.6rem] font-semibold leading-tight text-ink md:text-[2rem]">
            {title}
          </h2>
        )}
        {intro && <p className="mt-4 max-w-[68ch] text-[0.98rem] leading-[1.7] text-ink-soft">{intro}</p>}
        <div className={cn(title || intro ? "mt-10" : "")}>{children}</div>
      </Container>
    </section>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="marker-bracket text-[0.92rem] leading-relaxed text-ink">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function DefinitionRow({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 border-t border-rule py-6 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-10">
      <h3 className="text-[1.02rem] font-semibold text-ink">{term}</h3>
      <div className="max-w-[70ch] text-[0.93rem] leading-[1.7] text-ink-soft">{children}</div>
    </div>
  );
}

export function CTASection({
  title = "See eterfaceID against your own onboarding flow",
  body = "We will walk through your current identification methods, where the gaps sit against FINTRAC and RPAA expectations, and what a live integration looks like.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="border-y border-rule bg-paper-deep">
      <Container className="flex flex-col gap-6 py-14 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="max-w-[24ch] text-[1.5rem] font-semibold leading-tight text-ink md:text-[1.85rem]">
            {title}
          </h2>
          <p className="mt-3 max-w-[60ch] text-[0.93rem] leading-[1.7] text-ink-soft">{body}</p>
        </div>
        <div className="flex shrink-0 gap-3">
          <Link
            to="/contact"
            className="rounded-sm bg-primary px-5 py-2.5 text-[0.85rem] font-medium text-primary-foreground transition-colors hover:bg-ink"
          >
            Book a walkthrough
          </Link>
          <Link
            to="/developers"
            className="rounded-sm border border-ink/25 px-5 py-2.5 text-[0.85rem] font-medium text-ink transition-colors hover:border-ink"
          >
            Read the API docs
          </Link>
        </div>
      </Container>
    </section>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span className="bg-signal/10 px-1.5 py-0.5 text-[0.85em] text-signal">[{children}]</span>
  );
}
