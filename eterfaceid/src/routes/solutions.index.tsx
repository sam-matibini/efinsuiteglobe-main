import { createFileRoute, Link } from "@tanstack/react-router";
import { CTASection, PageHero, Section } from "@/components/site/primitives";
import { solutionsGroup } from "@/components/site/nav-data";

export const Route = createFileRoute("/solutions/")({
  head: () => ({
    meta: [
      { title: "Solutions — eterfaceID" },
      {
        name: "description",
        content:
          "Person verification, business verification, AML screening and fraud intelligence from a single platform.",
      },
      { property: "og:title", content: "Solutions — eterfaceID" },
      {
        property: "og:description",
        content:
          "Four capabilities, one contract: person verification, business verification, AML screening, fraud and risk intelligence.",
      },
    ],
  }),
  component: SolutionsIndex,
});

function SolutionsIndex() {
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title="Four capabilities that share one record"
        lede="Compose them as a single onboarding call or run them independently. Whatever you use, the evidence lands in the same case file with the same audit trail."
      />

      <Section>
        <div className="divide-y divide-rule border-y border-rule">
          {solutionsGroup.links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="group grid gap-3 py-8 transition-colors hover:bg-paper md:grid-cols-[minmax(0,22rem)_1fr] md:gap-12"
            >
              <h2 className="marker-bracket text-[1.25rem] font-semibold text-ink group-hover:text-signal">
                {l.label}
              </h2>
              <p className="max-w-[68ch] text-[0.95rem] leading-[1.7] text-ink-soft">{l.blurb}</p>
            </Link>
          ))}
        </div>
      </Section>

      <CTASection />
    </>
  );
}
