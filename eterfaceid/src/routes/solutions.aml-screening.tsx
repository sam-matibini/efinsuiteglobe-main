import { createFileRoute } from "@tanstack/react-router";
import {
  CheckList,
  CTASection,
  DefinitionRow,
  PageHero,
  Section,
} from "@/components/site/primitives";
import { ProductFilm } from "@/components/site/ProductFilm";
import screeningFilm from "@/assets/screening-workflow.mp4.asset.json";
import screeningPoster from "@/assets/screening-workflow-poster.png.asset.json";
import continuousScreeningImage from "@/assets/continuous-screening-workflow.jpg";

export const Route = createFileRoute("/solutions/aml-screening")({
  head: () => ({
    meta: [
      { title: "AML Screening & Monitoring — eterfaceID" },
      {
        name: "description",
        content:
          "Screen customers against sanctions, PEP, RCA, government watchlists and adverse media, with continuous rescreening for the life of the relationship.",
      },
      { property: "og:title", content: "AML Screening & Monitoring — eterfaceID" },
      {
        property: "og:description",
        content:
          "Sanctions, PEP and watchlist screening with match reasoning and an auditable disposition trail.",
      },
    ],
  }),
  component: AmlScreening,
});

function AmlScreening() {
  return (
    <>
      <PageHero
        eyebrow="AML screening & monitoring"
        title="Screen once at onboarding. Keep screening for as long as they stay."
        lede="A clean result on day one means nothing on day four hundred. eterfaceID rescreens your entire book against refreshed lists and alerts you only when something genuinely changed."
      />

      <Section>
        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          <figure className="flex overflow-hidden border border-rule bg-paper">
            <img
              src={continuousScreeningImage}
              alt="Compliance analyst reviewing continuous sanctions and monitoring results"
              width={1536}
              height={1024}
              loading="lazy"
              className="size-full object-cover"
            />
          </figure>
          <ProductFilm
            src={screeningFilm.url}
            poster={screeningPoster.url}
            title="From customer record to explained match"
            description="An illustrative live screening sequence using realistic example data."
          />
        </div>
      </Section>

      <Section title="Sources screened">
        <CheckList
          items={[
            "Consolidated Canadian Autonomous Sanctions List",
            "Listed persons under Canadian terrorism regulations",
            "OFAC SDN and consolidated non-SDN lists",
            "UN Security Council consolidated list",
            "EU and UK consolidated sanctions",
            "Domestic and foreign politically exposed persons",
            "Heads of international organisations",
            "Relatives and close associates (RCAs)",
            "Law enforcement and regulatory enforcement lists",
            "Debarment and exclusion registers",
            "Insolvency and disqualified-director registers",
            "Adverse media across financial-crime categories",
          ]}
        />
        <p className="mt-8 max-w-[70ch] text-[0.88rem] leading-[1.7] text-ink-soft">
          List sources refresh on the publisher's cadence — sanctions lists within minutes of
          publication, others daily. Every match carries the list, the publishing body and the
          version of the record at the moment it was matched.
        </p>
      </Section>

      <Section title="How matching works" className="bg-paper">
        <div className="border-b border-rule">
          <DefinitionRow term="Name resolution">
            Transliteration, nicknames, patronymics, reversed name order and common misspellings
            are handled so that a genuine hit is not lost to a spelling variant.
          </DefinitionRow>
          <DefinitionRow term="Secondary identifiers">
            Date of birth, nationality, country of residence and identity numbers narrow the
            candidate set, which is what keeps false positives from drowning your analysts.
          </DefinitionRow>
          <DefinitionRow term="Explained scores">
            Each hit shows which fields matched, which conflicted, and why the score landed where
            it did. No unexplained number.
          </DefinitionRow>
          <DefinitionRow term="Disposition trail">
            Analysts mark a hit as a true or false positive with a reason. The decision persists,
            so the same person does not resurface as new work tomorrow.
          </DefinitionRow>
          <DefinitionRow term="Ongoing rescreening">
            The whole customer book is rescreened as lists change. You are alerted on new matches
            and on material changes to an existing match, not on unchanged records.
          </DefinitionRow>
        </div>
      </Section>

      <Section
        title="Tuned to your risk appetite"
        intro="Screening thresholds, source selection and the adverse media categories in scope are all configurable per customer segment, and every change is versioned so you can show when a setting was altered and by whom."
      >
        <CheckList
          items={[
            "Per-segment match thresholds",
            "Source inclusion and exclusion rules",
            "Adverse media category selection",
            "Alert routing and escalation paths",
            "Versioned configuration history",
            "Full alert and disposition export",
          ]}
        />
      </Section>

      <CTASection />
    </>
  );
}
