import { createFileRoute } from "@tanstack/react-router";
import { CheckList, CTASection, PageHero, Section } from "@/components/site/primitives";
import { ProductFilm } from "@/components/site/ProductFilm";
import transactionFilm from "@/assets/transaction-monitoring.mp4.asset.json";
import transactionPoster from "@/assets/transaction-monitoring-poster.png.asset.json";

export const Route = createFileRoute("/solutions/fraud-risk")({
  head: () => ({
    meta: [
      { title: "Fraud & Risk Intelligence — eterfaceID" },
      {
        name: "description",
        content:
          "Device and network risk, email and phone reputation, velocity patterns and synthetic identity signals alongside every verification.",
      },
      { property: "og:title", content: "Fraud & Risk Intelligence — eterfaceID" },
      {
        property: "og:description",
        content:
          "Fraud signals that travel with the identity record, so risk decisions and compliance evidence live in one place.",
      },
    ],
  }),
  component: FraudRisk,
});

function FraudRisk() {
  return (
    <>
      <PageHero
        eyebrow="Fraud & risk intelligence"
        title="A verified identity is not the same as a safe one"
        lede="Documents can be genuine and the applicant still fraudulent. eterfaceID collects the surrounding signals — device, network, email, phone and behaviour — and returns them with the identity result rather than in a separate tool."
      />

      <Section
        title="See risk emerge across a sequence"
        intro="eterfaceID evaluates individual payments and the pattern around them, then gives the analyst the reason behind every alert."
      >
        <ProductFilm
          src={transactionFilm.url}
          poster={transactionPoster.url}
          title="Transaction monitoring in motion"
          description="Illustrative structuring detection and alert escalation."
        />
      </Section>

      <Section title="Signals collected">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Device & network
            </h3>
            <div className="mt-4">
              <CheckList
                items={[
                  "Device fingerprint and reuse across accounts",
                  "Emulator, virtual machine and automation detection",
                  "Rooted and jailbroken device flags",
                  "Proxy, VPN, Tor and hosting-provider IP detection",
                  "IP geolocation against stated address",
                  "Timezone and language mismatch",
                  "Session behaviour and paste detection",
                ]}
              />
            </div>
          </div>
          <div>
            <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Email, phone & identity
            </h3>
            <div className="mt-4">
              <CheckList
                items={[
                  "Email first-seen age and deliverability",
                  "Disposable and temporary domain detection",
                  "Breach exposure and online footprint",
                  "Phone line type, carrier and porting history",
                  "Recently issued or recycled number flags",
                  "Synthetic identity indicators",
                  "Velocity across applications and shared attributes",
                ]}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="One risk view, not three dashboards"
        intro="Fraud signals, verification evidence and screening hits sit in the same case. An analyst reviewing a file sees the genuine passport, the residential address that matched, and the fact that the device has been used on eleven other applications this week — without switching tools."
        className="bg-paper"
      >
        <CheckList
          items={[
            "Signals attached to the identity case",
            "Configurable rules by product and segment",
            "Reason codes on every elevated risk result",
            "Manual override with mandatory justification",
            "Feedback loop from confirmed fraud outcomes",
            "Exportable for your own risk modelling",
          ]}
        />
      </Section>

      <CTASection />
    </>
  );
}
