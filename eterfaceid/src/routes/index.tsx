import { createFileRoute, Link } from "@tanstack/react-router";
import { Container, CTASection, Section } from "@/components/site/primitives";
import { solutionsGroup } from "@/components/site/nav-data";
import { ProductFilm } from "@/components/site/ProductFilm";
import screeningFilm from "@/assets/screening-workflow.mp4.asset.json";
import screeningPoster from "@/assets/screening-workflow-poster.png.asset.json";
import transactionFilm from "@/assets/transaction-monitoring.mp4.asset.json";
import transactionPoster from "@/assets/transaction-monitoring-poster.png.asset.json";
import fintechFilm from "@/assets/fintech-real-time-monitoring.mp4.asset.json";
import fintechPoster from "@/assets/fintech-real-time-monitoring-poster.png.asset.json";
import verifyPeopleImage from "@/assets/verify-people-workflow.jpg";
import verifyBusinessImage from "@/assets/verify-business-workflow.jpg";
import continuousScreeningImage from "@/assets/continuous-screening-workflow.jpg";
import kycKybAmlImage from "@/assets/kyc-kyb-aml-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "eterfaceID — KYC, KYB and AML in one API" },
      {
        name: "description",
        content:
          "Verify people, verify businesses and screen against sanctions and PEP lists through a single Canadian-built API. FINTRAC and RPAA aligned.",
      },
      { property: "og:title", content: "eterfaceID — KYC, KYB and AML in one API" },
      {
        property: "og:description",
        content:
          "Identity, business and financial-crime checks for fintechs, MSBs and payment service providers.",
      },
    ],
  }),
  component: Home,
});

const pillars = [
  {
    kicker: "Verify people",
    title: "Know the person on the other side",
    body: "Government ID and passport capture, name, date of birth and address checks, phone and email validation, selfie with liveness, and face-to-ID matching — run as one request or composed step by step.",
    to: "/solutions/person-verification",
    image: verifyPeopleImage,
    alt: "Customer completing identity verification with a passport and smartphone",
  },
  {
    kicker: "Verify businesses",
    title: "Know the entity and who controls it",
    body: "Registry lookups across federal and provincial sources, operating status, directors and officers, and beneficial ownership traced through to the natural persons behind the structure.",
    to: "/solutions/business-verification",
    image: verifyBusinessImage,
    alt: "Business professionals reviewing company registration and ownership information",
  },
  {
    kicker: "Screen continuously",
    title: "Catch the list hit before your regulator does",
    body: "Sanctions, PEP and RCA, government and law-enforcement watchlists, and adverse media — screened at onboarding and rescreened for as long as the relationship lasts.",
    to: "/solutions/aml-screening",
    image: continuousScreeningImage,
    alt: "Compliance analyst reviewing continuous screening and monitoring results",
  },
];

const coverage = [
  { value: "195", label: "countries and territories in the identity graph" },
  { value: "1,400+", label: "sanctions, PEP and watchlist sources monitored" },
  { value: "< 30s", label: "median decision time for a full person check" },
  { value: "7 years", label: "default record retention, matching FINTRAC rules" },
];

function Home() {
  return (
    <>
      <section className="border-b border-rule">
        <Container className="grid gap-14 py-20 md:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-signal">
              KYC &middot; KYB &middot; AML
            </p>
            <h1 className="mt-5 max-w-[17ch] text-[2.6rem] font-semibold leading-[1.04] text-ink md:text-[4rem]">
              One interface for identity, entities and financial crime.
            </h1>
            <p className="mt-7 max-w-[58ch] text-[1.05rem] leading-[1.65] text-ink-soft">
              eterfaceID verifies the people and businesses you onboard, screens them against
              sanctions and politically exposed person lists, and keeps watching after the
              account is open — through one API and one review console.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/contact"
                className="rounded-sm bg-primary px-5 py-3 text-[0.88rem] font-medium text-primary-foreground transition-colors hover:bg-ink"
              >
                Book a walkthrough
              </Link>
              <Link
                to="/developers"
                className="rounded-sm border border-ink/25 px-5 py-3 text-[0.88rem] font-medium text-ink transition-colors hover:border-ink"
              >
                Read the API docs
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <ProductFilm
              src={screeningFilm.url}
              poster={screeningPoster.url}
              title="Screening in motion"
              description="Lists resolve and a reviewable match is explained."
            />
            <ProductFilm
              src={transactionFilm.url}
              poster={transactionPoster.url}
              title="Monitoring in motion"
              description="A suspicious pattern becomes an analyst alert."
            />
          </div>
        </Container>
      </section>

      <section className="border-b border-rule">
        <Container className="py-0">
          <img
            src={kycKybAmlImage}
            alt="Compliance team verifying a customer's identity, reviewing a business registration and ownership chart, and monitoring screening results"
            width={1536}
            height={1024}
            loading="lazy"
            className="aspect-[4/3] w-full border-x border-rule object-cover sm:aspect-[16/7]"
          />
        </Container>
      </section>

      <Section>
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          {pillars.map((p) => (
            <Link
              key={p.kicker}
              to={p.to}
              className="group flex min-w-0 flex-col bg-background transition-colors hover:bg-paper"
            >
              <div className="aspect-[3/2] overflow-hidden">
                <img
                  src={p.image}
                  alt={p.alt}
                  width={1536}
                  height={1024}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025]"
                />
              </div>
              <div className="flex flex-1 flex-col p-7">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-signal">
                  {p.kicker}
                </p>
                <h2 className="mt-4 text-[1.2rem] font-semibold leading-snug text-ink">{p.title}</h2>
                <p className="mt-3 text-[0.9rem] leading-[1.7] text-ink-soft">{p.body}</p>
                <span className="mt-auto pt-5 text-[0.82rem] font-medium text-ink group-hover:text-signal">
                  Explore &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <section className="border-y border-rule bg-paper">
        <Container className="grid gap-10 py-16 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-signal">
              Fintech &middot; AI &middot; Open banking
            </p>
            <h2 className="mt-4 max-w-[14ch] text-[2rem] font-semibold leading-[1.12] text-ink md:text-[2.6rem]">
              Real-time finance needs real-time controls
            </h2>
            <p className="mt-5 max-w-[52ch] text-[0.98rem] leading-[1.75] text-ink-soft">
              Instant payments, linked accounts and AI-assisted fraud can change a customer&apos;s
              risk between periodic reviews. eterfaceID continuously evaluates identity,
              transaction, device, network, sanctions and counterparty signals, then routes
              consequential decisions to a person.
            </p>
            <Link
              to="/solutions/fraud-risk"
              className="marker-bracket mt-6 inline-block text-[0.88rem] font-semibold text-ink hover:text-signal"
            >
              Explore transaction monitoring
            </Link>
          </div>
          <ProductFilm
            src={fintechFilm.url}
            poster={fintechPoster.url}
            title="Fintech monitoring in real time"
            description="Live payment and counterparty signals become a focused analyst review."
          />
        </Container>
      </section>

      <section className="border-y border-rule bg-paper">
        <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {coverage.map((c) => (
            <div key={c.label}>
              <p className="font-display text-[2.1rem] font-semibold leading-none text-ink">
                {c.value}
              </p>
              <p className="mt-3 max-w-[24ch] text-[0.82rem] leading-relaxed text-ink-soft">
                {c.label}
              </p>
            </div>
          ))}
        </Container>
      </section>

      <Section
        title="Built for the Canadian rulebook, usable anywhere"
        intro="Identity requirements are specific here. eterfaceID implements the methods FINTRAC recognises — government-issued photo identification, the credit file method, and the dual-process method — and records the evidence in the form an examiner expects to see."
      >
        <div className="grid gap-x-12 gap-y-8 md:grid-cols-3">
          {[
            {
              h: "FINTRAC identification methods",
              b: "Each verification is tagged with the method used, the source consulted, and the date, so your records hold up during an examination.",
            },
            {
              h: "RPAA registration support",
              b: "Payment service providers registering with the Bank of Canada can evidence end-user identification, risk management and incident-ready record keeping.",
            },
            {
              h: "Global coverage",
              b: "Document templates, registry connections and watchlist sources extend past Canada, so expansion does not mean a second vendor.",
            },
          ].map((x) => (
            <div key={x.h} className="border-t border-rule pt-5">
              <h3 className="text-[1rem] font-semibold text-ink">{x.h}</h3>
              <p className="mt-2.5 text-[0.9rem] leading-[1.7] text-ink-soft">{x.b}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Every capability, one contract">
        <ul className="grid gap-x-12 gap-y-4 sm:grid-cols-2">
          {solutionsGroup.links.map((l) => (
            <li key={l.to} className="border-t border-rule pt-4">
              <Link to={l.to} className="marker-bracket text-[1rem] font-semibold text-ink hover:text-signal">
                {l.label}
              </Link>
              <p className="mt-2 pl-[1.1rem] text-[0.88rem] leading-relaxed text-ink-soft">
                {l.blurb}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <CTASection />
    </>
  );
}
