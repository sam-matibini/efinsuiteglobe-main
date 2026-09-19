import { createFileRoute } from "@tanstack/react-router";
import {
  CTASection,
  DefinitionRow,
  PageHero,
  Placeholder,
  Section,
} from "@/components/site/primitives";

export const Route = createFileRoute("/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance — FINTRAC and RPAA — eterfaceID" },
      {
        name: "description",
        content:
          "How eterfaceID maps to FINTRAC identification, record-keeping, monitoring and reporting obligations, and to Bank of Canada PSP registration under the RPAA.",
      },
      { property: "og:title", content: "Compliance — FINTRAC and RPAA — eterfaceID" },
      {
        property: "og:description",
        content:
          "Identification methods, record retention, ongoing monitoring and registration support for Canadian reporting entities.",
      },
    ],
  }),
  component: Compliance,
});

function Compliance() {
  return (
    <>
      <PageHero
        eyebrow="Compliance"
        title="Designed around the obligations, not retrofitted to them"
        lede="eterfaceID is built for reporting entities under the Proceeds of Crime (Money Laundering) and Terrorist Financing Act and for payment service providers registering under the Retail Payment Activities Act."
      />

      <Section title="FINTRAC obligations">
        <div className="border-b border-rule">
          <DefinitionRow term="Client identification">
            Every verification is executed and labelled as one of the recognised methods —
            government-issued photo identification, the credit file method, or the dual-process
            method — with the source and date captured.
          </DefinitionRow>
          <DefinitionRow term="Beneficial ownership">
            For entity customers, ownership and control information is obtained, confirmed where
            possible, and where it cannot be confirmed the reasonable measures taken are recorded
            instead of left blank.
          </DefinitionRow>
          <DefinitionRow term="PEP and HIO determination">
            Screening covers domestic and foreign politically exposed persons, heads of
            international organisations, and their relatives and close associates, with the
            determination date stored on the file.
          </DefinitionRow>
          <DefinitionRow term="Ongoing monitoring">
            Customers are rescreened continuously and risk ratings are refreshed as new
            information arrives, with alerts routed to the analyst queue.
          </DefinitionRow>
          <DefinitionRow term="Record keeping">
            Records are retained for seven years by default. Retention is configurable upward, and
            deletion is blocked while a record is inside its retention window.
          </DefinitionRow>
          <DefinitionRow term="Examination readiness">
            Any customer file can be exported with its full evidence chain: the source documents,
            the checks run, the results, the reviewer and the timestamps.
          </DefinitionRow>
        </div>
      </Section>

      <Section title="Bank of Canada PSP registration (RPAA)" className="bg-paper">
        <div className="border-b border-rule">
          <DefinitionRow term="End-user identification">
            Retail payment activity requires you to know your end users. eterfaceID supplies the
            identification and the evidence in the form the registration process expects.
          </DefinitionRow>
          <DefinitionRow term="Risk management framework">
            Screening configuration, thresholds and escalation paths are documented and versioned,
            which supports the operational risk and incident response framework you must maintain.
          </DefinitionRow>
          <DefinitionRow term="Incident readiness">
            Access logs and an append-only audit trail give you the record needed when an incident
            has to be reported and reconstructed.
          </DefinitionRow>
          <DefinitionRow term="Annual reporting">
            Volume, outcome and alert-disposition reporting can be exported for the annual report
            and for supervisory requests.
          </DefinitionRow>
        </div>
      </Section>

      <Section title="Data handling and security">
        <div className="border-b border-rule">
          <DefinitionRow term="Data residency">
            Canadian customer data is stored in Canadian regions.{" "}
            <Placeholder>Confirm the exact regions and any regional options before publishing</Placeholder>
          </DefinitionRow>
          <DefinitionRow term="Encryption">
            Data is encrypted in transit and at rest. Document images and biometric artefacts are
            access-controlled and logged on every read.
          </DefinitionRow>
          <DefinitionRow term="Privacy">
            Handling is aligned with PIPEDA and applicable provincial privacy legislation, with
            consent captured at the point of collection.{" "}
            <Placeholder>Have counsel review this section</Placeholder>
          </DefinitionRow>
          <DefinitionRow term="Certifications">
            <Placeholder>
              SOC 2 Type II, ISO 27001 and any other certifications — list only what has actually
              been awarded; nothing is claimed here yet
            </Placeholder>
          </DefinitionRow>
        </div>
        <p className="mt-8 max-w-[70ch] text-[0.85rem] leading-[1.7] text-ink-soft">
          This page describes how the platform supports your obligations. It is not legal advice,
          and it does not transfer your obligations to eterfaceID.
        </p>
      </Section>

      <CTASection
        title="Bring your compliance officer to the first call"
        body="The conversation usually goes faster when the person who owns the programme is in the room. We will go obligation by obligation."
      />
    </>
  );
}
