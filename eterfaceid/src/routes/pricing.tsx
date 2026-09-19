import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CTASection, PageHero, Placeholder, Section } from "@/components/site/primitives";
import { fetchPlans, money } from "@/lib/platform";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — eterfaceID" },
      {
        name: "description",
        content:
          "Starter, Growth and Enterprise plans for identity verification, business verification and AML screening.",
      },
      { property: "og:title", content: "Pricing — eterfaceID" },
      {
        property: "og:description",
        content: "Per-verification pricing with ongoing screening included on every plan.",
      },
    ],
  }),
  component: Pricing,
});

const tiers = [
  {
    name: "Starter",
    price: "Placeholder",
    unit: "per verification",
    for: "Early-stage teams getting their first compliance programme live.",
    includes: [
      "Person verification with document and liveness",
      "Sanctions and PEP screening",
      "Ongoing rescreening",
      "Hosted verification flow",
      "Single workspace, up to 5 users",
      "Email support",
    ],
  },
  {
    name: "Growth",
    price: "Placeholder",
    unit: "per verification, volume tiered",
    for: "Scaling fintechs and MSBs with an in-house compliance function.",
    includes: [
      "Everything in Starter",
      "Business verification and beneficial ownership",
      "Fraud and risk intelligence signals",
      "Configurable rules and thresholds per segment",
      "Analyst review console with roles",
      "Webhooks and full API access",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    unit: "annual commitment",
    for: "Regulated institutions with bespoke policy, residency or audit requirements.",
    includes: [
      "Everything in Growth",
      "Custom data residency and retention",
      "Dedicated screening list configuration",
      "SSO and granular permissions",
      "Named implementation and compliance contacts",
      "Contracted service levels",
    ],
  },
];

function Pricing() {
  const plans = useQuery({ queryKey: ["public-plans"], queryFn: fetchPlans });
  const configured = (plans.data ?? []).filter((p) => p.public_visible);
  const displayed = configured.length
    ? configured.map((p) => ({
        name: p.name,
        price: p.custom_pricing || p.price_amount == null ? "Custom" : money(p.price_amount, p.price_currency),
        unit: p.price_unit,
        for: p.blurb ?? "",
        includes: p.features ?? [],
        featured: p.featured,
        configured: true,
      }))
    : tiers.map((t) => ({ ...t, featured: Boolean((t as { featured?: boolean }).featured), configured: false }));

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Pay per verification. Monitoring is not an upsell."
        lede="Ongoing rescreening is included on every plan, because a compliance programme that stops at onboarding is not a compliance programme."
      />

      <Section>
        <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-3">
          {displayed.map((t) => (
            <div
              key={t.name}
              className={t.featured ? "bg-paper p-8" : "bg-background p-8"}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-[1.15rem] font-semibold text-ink">{t.name}</h2>
                {t.featured && (
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-signal">
                    Most chosen
                  </span>
                )}
              </div>
              <p className="mt-5 font-display text-[1.9rem] font-semibold leading-none text-ink">
                {t.price === "Custom" ? (
                  "Custom"
                ) : t.configured ? (
                  t.price
                ) : (
                  <Placeholder>{t.price} price</Placeholder>
                )}
              </p>
              <p className="mt-2 text-[0.8rem] text-ink-soft">{t.unit}</p>
              <p className="mt-5 border-t border-rule pt-5 text-[0.88rem] leading-[1.7] text-ink-soft">
                {t.for}
              </p>
              <ul className="mt-5 space-y-2.5">
                {t.includes.map((i) => (
                  <li key={i} className="marker-bracket text-[0.86rem] leading-relaxed text-ink">
                    {i}
                  </li>
                ))}
              </ul>
              <Link
                to="/contact"
                className="mt-7 inline-block rounded-sm border border-ink/25 px-5 py-2.5 text-[0.85rem] font-medium text-ink transition-colors hover:border-ink"
              >
                Talk to us
              </Link>
            </div>
          ))}
        </div>
        {configured.length === 0 ? (
          <p className="mt-8 max-w-[70ch] text-[0.85rem] leading-[1.7] text-ink-soft">
            Prices above are placeholders. Set your real plans and prices in the app admin area and this
            page updates itself.
          </p>
        ) : null}
      </Section>

      <CTASection
        title="Want a number against your actual volume?"
        body="Send us your expected monthly verifications and the mix of individuals to businesses, and we will come back with a real quote."
      />
    </>
  );
}
