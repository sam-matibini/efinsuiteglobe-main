import { createFileRoute } from "@tanstack/react-router";
import {
  CheckList,
  CTASection,
  DefinitionRow,
  PageHero,
  Section,
} from "@/components/site/primitives";
import verifyBusinessImage from "@/assets/verify-business-workflow.jpg";

export const Route = createFileRoute("/solutions/business-verification")({
  head: () => ({
    meta: [
      { title: "Business Verification — eterfaceID" },
      {
        name: "description",
        content:
          "Registry lookups, operating status, directors and officers, and beneficial ownership traced to the natural persons behind the entity.",
      },
      { property: "og:title", content: "Business Verification — eterfaceID" },
      {
        property: "og:description",
        content:
          "Confirm the entity exists, is in good standing, and know exactly who controls it.",
      },
    ],
  }),
  component: BusinessVerification,
});

function BusinessVerification() {
  return (
    <>
      <PageHero
        eyebrow="Business verification"
        title="Confirm the entity — and follow the ownership to a person"
        lede="A corporate customer is only verified when you know it exists, that it is in good standing, and who ultimately owns and directs it. eterfaceID resolves all three and verifies the humans it finds."
      />

      <Section title="Entity checks">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <figure className="overflow-hidden border border-rule bg-paper">
            <div className="aspect-[3/2] overflow-hidden">
              <img
                src={verifyBusinessImage}
                alt="Business professionals reviewing registration and ownership information"
                width={1536}
                height={1024}
                loading="lazy"
                className="size-full object-cover"
              />
            </div>
            <figcaption className="border-t border-rule px-5 py-4 text-[0.82rem] leading-relaxed text-ink-soft">
              Confirm the company, its standing and the people behind it from one review record.
            </figcaption>
          </figure>
          <CheckList
            items={[
              "Official registry confirmation through The KYB across 225+ countries and states",
              "Legal name, operating names and registration number",
              "Incorporation date and jurisdiction",
              "Operating status, dissolution and strike-off flags",
              "Registered and operating addresses",
              "Business type and industry classification",
              "Tax and business numbers where available",
              "Filing history and annual return currency",
              "Directors, officers and beneficial owners imported onto the case",
              "The KYB AML on the entity and its people, alongside eterfaceID watchlists",
              "Bank-confirmed identity via Plaid for the people those owners become",
              "Document upload fallback for unregistered entities",
            ]}
          />
        </div>
      </Section>

      <Section title="Ownership and control" className="bg-paper">
        <div className="border-b border-rule">
          <DefinitionRow term="Beneficial ownership">
            Shareholding is traced through intermediate holding companies, trusts and partnerships
            until eterfaceID reaches natural persons or an unresolvable layer, which is flagged
            rather than hidden.
          </DefinitionRow>
          <DefinitionRow term="Ownership threshold">
            Set your own control threshold — 25 percent is the common default — and eterfaceID
            returns every person meeting it, plus anyone exercising control by other means.
          </DefinitionRow>
          <DefinitionRow term="Directors and officers">
            Current and historical directors and senior officers, each linkable to a person
            verification case with one call.
          </DefinitionRow>
          <DefinitionRow term="Ownership graph">
            The full structure is returned as a graph so your analysts can see the path from the
            customer to each ultimate owner instead of reading a flat list.
          </DefinitionRow>
          <DefinitionRow term="Screening on the whole structure">
            Entity, intermediate companies, directors and ultimate owners are all screened against
            sanctions, PEP and watchlist sources — and rescreened continuously.
          </DefinitionRow>
        </div>
      </Section>

      <Section
        title="Records that satisfy an examiner"
        intro="For a corporation, you are expected to hold the name, address and names of directors, plus confirmation of existence from a reliable source. eterfaceID stores the source document itself, not just the parsed fields, with the date it was obtained."
      >
        <CheckList
          items={[
            "Source document retained alongside parsed data",
            "Date and source of every confirmation",
            "Beneficial ownership information kept current",
            "Reasonable-measures notes when information cannot be confirmed",
            "Seven-year default retention, configurable",
            "Full export for examinations and audits",
          ]}
        />
      </Section>

      <CTASection />
    </>
  );
}
