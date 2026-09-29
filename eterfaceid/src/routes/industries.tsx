import { createFileRoute, Link } from "@tanstack/react-router";
import { CTASection, Container, PageHero, Section } from "@/components/site/primitives";
import { industries } from "@/components/site/nav-data";
import { ProductFilm } from "@/components/site/ProductFilm";
import fintechFilm from "@/assets/fintech-real-time-monitoring.mp4.asset.json";
import fintechPoster from "@/assets/fintech-real-time-monitoring-poster.png.asset.json";

export const Route = createFileRoute("/industries")({
  head: () => ({
    meta: [
      { title: "Industries — eterfaceID" },
      {
        name: "description",
        content:
          "Identity and financial-crime controls for fintech, money services businesses, payment service providers, lending, digital assets, marketplaces, real estate and insurance.",
      },
      { property: "og:title", content: "Industries — eterfaceID" },
      {
        property: "og:description",
        content: "How regulated businesses across sectors use eterfaceID to onboard and monitor customers.",
      },
    ],
  }),
  component: Industries,
});

function Industries() {
  return (
    <>
      <PageHero
        eyebrow="Industries"
        title="Same obligations, very different onboarding flows"
        lede="The underlying requirement — know who you are dealing with and keep knowing — is constant. What changes is the friction your customers will tolerate and the evidence your regulator expects."
      />

      <section className="border-b border-rule bg-paper">
        <Container className="grid gap-10 py-16 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-signal">
              Fintech
            </p>
            <h2 className="mt-4 max-w-[15ch] text-[2rem] font-semibold leading-[1.12] text-ink md:text-[2.6rem]">
              Monitor at the speed of open finance
            </h2>
            <p className="mt-5 max-w-[52ch] text-[0.96rem] leading-[1.75] text-ink-soft">
              Open banking widens the signal surface while instant payments shorten the time to
              intervene. Continuous monitoring connects changes in identity, behaviour, devices,
              networks and counterparties so your team can act before isolated anomalies become
              financial crime.
            </p>
            <p className="mt-4 max-w-[52ch] text-[0.9rem] leading-[1.7] text-ink-soft">
              AI helps prioritize the changing risk. Reviewers retain control over decisions that
              affect customers, investigations and reporting.
            </p>
            <Link
              to="/solutions/fraud-risk"
              className="marker-bracket mt-6 inline-block text-[0.88rem] font-semibold text-ink hover:text-signal"
            >
              See fraud and risk intelligence
            </Link>
          </div>
          <ProductFilm
            src={fintechFilm.url}
            poster={fintechPoster.url}
            title="High-velocity monitoring"
            description="A live risk signal is surfaced for human review."
          />
        </Container>
      </section>

      <Section>
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2">
          {industries.map((i) => (
            <div key={i.name} className="bg-background p-8">
              <h2 className="marker-bracket text-[1.1rem] font-semibold text-ink">{i.name}</h2>
              <p className="mt-3 pl-[1.1rem] text-[0.9rem] leading-[1.7] text-ink-soft">
                {i.summary}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <CTASection
        title="Not sure which obligations apply to you?"
        body="Tell us what you do and who your customers are. We will map it against FINTRAC's reporting-entity categories and the RPAA registration test before talking about product."
      />
    </>
  );
}
