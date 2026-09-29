# Add a KYC · KYB · AML picture below the homepage hero

## What

Add one original, documentary-style photograph depicting all three pillars — verifying people (KYC), verifying businesses (KYB) and screening for financial crime (AML) — as a full-width image directly under the homepage hero, before the three-pillar cards.

## Image

- Generate one wide photoreal image (~1536×1024, used in a wide crop) in the same restrained documentary style as the existing site photos: a credible compliance/onboarding setting where identity documents, a laptop with company-registry material and a screening workstation are visible; no readable personal data, no logos, no overlaid text.
- Save as `src/assets/kyc-kyb-aml-hero.jpg` (regular project import, like the other pillar images).
- Review the generated image before placing it; regenerate if it contains readable text, logos or uncanny details.

## Placement (src/routes/index.tsx)

- Insert a new full-width section immediately after the hero section (after the `border-b border-rule` hero block, before the pillars `Section`).
- Layout: edge-to-edge container image, 16/7-ish wide crop on desktop (`aspect-[16/7]` with `object-cover`, collapsing to a taller crop on mobile), thin `border-rule` borders top/bottom to match the site's rule system.
- `loading="lazy"`, descriptive alt text ("Compliance team verifying a customer's identity, business registration and screening results").
- No headline required — the picture sits between the hero copy and the three-pillar cards; keep it quiet and photographic.

## Verification

- `bun run build` green (check `/tmp/observability/build-errors.log`).
- Playwright check at desktop and mobile widths: image renders in the right position, crop looks right, no layout shift issues.
- Mark the roadmap item done.
