import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero, Placeholder, Section } from "@/components/site/primitives";

export const Route = createFileRoute("/careers")({
  head: () => ({
    meta: [
      { title: "Careers — eterfaceID" },
      {
        name: "description",
        content:
          "Open roles at eterfaceID, building identity and financial-crime infrastructure for regulated businesses.",
      },
      { property: "og:title", content: "Careers — eterfaceID" },
      {
        property: "og:description",
        content: "Work on identity, verification and financial-crime detection at eterfaceID.",
      },
    ],
  }),
  component: Careers,
});

const roles = [
  { title: "Senior Backend Engineer", team: "Platform", location: "Placeholder location" },
  { title: "Machine Learning Engineer, Document Fraud", team: "Risk", location: "Placeholder location" },
  { title: "Compliance Solutions Lead", team: "Customer", location: "Placeholder location" },
  { title: "Product Designer", team: "Product", location: "Placeholder location" },
];

function Careers() {
  return (
    <>
      <PageHero
        eyebrow="Careers"
        title="Work on the part of fintech nobody sees until it fails"
        lede="Verification is unglamorous, high-stakes and genuinely hard. If that sounds appealing rather than tedious, we should talk."
      />

      <Section title="Open roles">
        <div className="divide-y divide-rule border-y border-rule">
          {roles.map((r) => (
            <div
              key={r.title}
              className="flex flex-col gap-2 py-6 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <h2 className="text-[1.05rem] font-semibold text-ink">{r.title}</h2>
                <p className="mt-1 text-[0.85rem] text-ink-soft">
                  {r.team} &middot; <Placeholder>{r.location}</Placeholder>
                </p>
              </div>
              <Link
                to="/contact"
                className="shrink-0 rounded-sm border border-ink/25 px-4 py-2 text-[0.82rem] font-medium text-ink transition-colors hover:border-ink"
              >
                Apply
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-[70ch] text-[0.85rem] leading-[1.7] text-ink-soft">
          These roles are placeholders so the page has a shape. Replace them with your real
          openings, locations and application links.
        </p>
      </Section>
    </>
  );
}
