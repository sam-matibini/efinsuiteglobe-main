import { createFileRoute } from "@tanstack/react-router";
import { CTASection, PageHero, Placeholder, Section } from "@/components/site/primitives";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About us — eterfaceID" },
      {
        name: "description",
        content:
          "eterfaceID builds identity, business verification and financial-crime screening infrastructure for regulated businesses.",
      },
      { property: "og:title", content: "About us — eterfaceID" },
      {
        property: "og:description",
        content: "Why we built one platform for KYC, KYB and AML instead of three.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <PageHero
        eyebrow="Company"
        title="Compliance teams deserve better than three vendors and a spreadsheet"
        lede="Most teams buy identity verification from one company, business data from another, and screening from a third — then spend their time reconciling the three. eterfaceID exists because that reconciliation is where things get missed."
      />

      <Section title="What we believe">
        <div className="grid gap-x-12 gap-y-8 md:grid-cols-3">
          {[
            {
              h: "Evidence over scores",
              b: "A number between zero and one is not a defence. Every result we return carries the source, the date and the reasoning behind it.",
            },
            {
              h: "Monitoring is the product",
              b: "Onboarding is a moment; risk is continuous. Rescreening is included everywhere rather than sold as an upgrade.",
            },
            {
              h: "Built here, works anywhere",
              b: "We start from the Canadian rulebook because it is specific and strict, then extend outward as our customers expand.",
            },
          ].map((x) => (
            <div key={x.h} className="border-t border-rule pt-5">
              <h3 className="text-[1rem] font-semibold text-ink">{x.h}</h3>
              <p className="mt-2.5 text-[0.9rem] leading-[1.7] text-ink-soft">{x.b}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="The company" className="bg-paper">
        <div className="max-w-[70ch] space-y-4 text-[0.95rem] leading-[1.75] text-ink-soft">
          <p>
            <Placeholder>
              Founding story — when the company started, who founded it, and what they were doing
              before
            </Placeholder>
          </p>
          <p>
            <Placeholder>
              Where the team is based, headcount, and any funding you want to disclose
            </Placeholder>
          </p>
          <p>
            <Placeholder>
              Leadership team — names, roles and short bios
            </Placeholder>
          </p>
        </div>
      </Section>

      <CTASection />
    </>
  );
}
