import { createFileRoute } from "@tanstack/react-router";
import {
  CheckList,
  CTASection,
  DefinitionRow,
  PageHero,
  Section,
} from "@/components/site/primitives";
import verifyPeopleImage from "@/assets/verify-people-workflow.jpg";

export const Route = createFileRoute("/solutions/person-verification")({
  head: () => ({
    meta: [
      { title: "Person Verification — eterfaceID" },
      {
        name: "description",
        content:
          "Government ID and passport checks, name, date of birth and address verification, phone and email validation, selfie, liveness and face-to-ID matching.",
      },
      { property: "og:title", content: "Person Verification — eterfaceID" },
      {
        property: "og:description",
        content:
          "Document, biometric and data checks that produce a defensible identity record for every customer.",
      },
    ],
  }),
  component: PersonVerification,
});

function PersonVerification() {
  return (
    <>
      <PageHero
        eyebrow="Person verification"
        title="Prove the person is real, present and who they claim to be"
        lede="Three layers of evidence — the document, the face in front of the camera, and the data trail behind the identity — reconciled into one decision you can defend."
      />

      <Section title="What gets checked">
        <figure className="mb-12 grid overflow-hidden border border-rule bg-paper md:grid-cols-[1.35fr_0.65fr]">
          <div className="aspect-[3/2] overflow-hidden md:aspect-auto md:min-h-[24rem]">
            <img
              src={verifyPeopleImage}
              alt="Customer completing identity verification with a passport and smartphone"
              width={1536}
              height={1024}
              loading="lazy"
              className="size-full object-cover"
            />
          </div>
          <figcaption className="flex flex-col justify-end border-t border-rule p-7 md:border-l md:border-t-0">
            <p className="text-[1.15rem] font-semibold leading-snug text-ink">A familiar flow, backed by defensible evidence</p>
            <p className="mt-3 text-[0.88rem] leading-[1.7] text-ink-soft">The customer captures their identity document and face while eterfaceID checks authenticity, presence and matching data.</p>
          </figcaption>
        </figure>
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Document
            </h3>
            <div className="mt-4">
              <CheckList
                items={[
                  "Government-issued photo identification",
                  "Passports and travel documents",
                  "Provincial driver's licences and ID cards",
                  "Permanent resident and status documents",
                  "Security-feature and template authentication",
                  "MRZ, barcode and chip data cross-check",
                  "Tamper, reprint and screen-capture detection",
                  "Expiry and issuing-authority validation",
                ]}
              />
            </div>
          </div>
          <div>
            <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Biometric
            </h3>
            <div className="mt-4">
              <CheckList
                items={[
                  "Selfie capture with guided framing",
                  "Passive and active liveness",
                  "Injection and deepfake detection",
                  "Face-to-ID portrait matching with a similarity score",
                  "Repeat-face detection across your own tenant",
                  "Configurable match thresholds per risk tier",
                ]}
              />
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
            Identity data
          </h3>
          <div className="mt-4">
            <CheckList
              items={[
                "Full name verification against authoritative sources",
                "Date of birth confirmation",
                "Residential address validation and standardisation",
                "National and government ID number checks",
                "Phone ownership, carrier and line-type checks",
                "Email age, breach exposure and domain reputation",
                "Deceased and known-fraud file screening",
                "Synthetic identity indicators",
              ]}
            />
          </div>
        </div>
      </Section>

      <Section title="How a check runs" className="bg-paper">
        <div className="border-b border-rule">
          <DefinitionRow term="1. Create the check">
            Call the API with whatever you already hold — name, date of birth, address, phone,
            email — and choose the verification method your policy requires.
          </DefinitionRow>
          <DefinitionRow term="2. Collect from the customer">
            Send them to a hosted flow or embed the capture SDK. The flow adapts to the document
            type and handles retries, poor lighting and accessibility needs.
          </DefinitionRow>
          <DefinitionRow term="3. Reconcile">
            Document data, biometric result and the data-source checks are compared. Conflicts are
            surfaced as specific reasons, not a single opaque score.
          </DefinitionRow>
          <DefinitionRow term="4. Decide and record">
            Auto-approve, auto-decline or route to an analyst. The outcome, the evidence and the
            reviewer are written to an append-only record.
          </DefinitionRow>
        </div>
      </Section>

      <Section
        title="Recognised identification methods"
        intro="Canadian reporting entities cannot simply pick any check. eterfaceID maps each verification to the method that satisfies the requirement."
      >
        <div className="border-b border-rule">
          <DefinitionRow term="Government-issued photo ID method">
            Authenticity of the document plus a match between the document portrait and the person
            presenting it, captured live.
          </DefinitionRow>
          <DefinitionRow term="Credit file method">
            A match against a credit file that has existed for the required minimum period, drawn
            from a Canadian credit bureau.
          </DefinitionRow>
          <DefinitionRow term="Dual-process method">
            Two independent, reliable sources confirming name with address, or name with date of
            birth, or name with a financial account.
          </DefinitionRow>
        </div>
      </Section>

      <CTASection />
    </>
  );
}
