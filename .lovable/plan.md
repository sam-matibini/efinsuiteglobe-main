## Goal

Elevate the `/landing` homepage so it feels more professional and premium, and turn the three top nav links (Features, Pricing, Testimonials) into hover-triggered dropdown menus.

## 1. Nav dropdowns (hover-activated)

Replace the three plain `<a href="#...">` links in the header (`src/pages/Landing.tsx` around lines 287–308) with a hover-menu pattern built on shadcn's `NavigationMenu` (Radix) — it already supports hover-on-desktop out of the box and is keyboard/ARIA accessible.

Dropdown contents:

- **Features** — 2-column mega panel grouping the existing feature icons + titles from the `features` array. Groups:
  - Core Accounting: General Ledger, AR, AP, Banking, Fixed Assets
  - Operations: Payroll, Inventory, Budgeting, Practice Management
  - Modern: Alice AI, DocSign, Communication Hub, Donations, Multi-Org
  - Each row: icon + title + one-line description, anchors to `#features`.
- **Pricing** — small panel listing the three plans (Starter, Professional, Enterprise) with price + one-line pitch, anchors to `#pricing`.
- **Testimonials** — small panel with 2–3 quoted names/roles, anchors to `#testimonials`.

Interaction (from the Emil design-eng skill):
- Custom easing token in `index.css`: `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`.
- Enter: 180ms `ease-out`, from `opacity: 0; transform: scale(0.97) translateY(-4px)`; `transform-origin` set to the Radix trigger variable.
- Exit: 140ms.
- Small hover-intent delay via Radix `delayDuration={120}` so the menu doesn't flicker on pass-through.
- Mobile (`useIsMobile`): fall back to click-to-open using the same component (no hover on coarse pointers, gated with `@media (hover: hover) and (pointer: fine)`).
- No animation on the trigger buttons themselves beyond a subtle underline; keyboard-focus ring preserved.

## 2. Homepage visual polish

Scope: header, hero, features section headings, pricing cards, testimonials, footer band. No copy rewrites, no new business logic.

Design direction: keep the existing navy + teal palette; commit harder to it with layered depth and calmer typography rather than a new theme.

- **Header:** thinner border, `backdrop-blur-md`, subtle bottom shadow on scroll (IntersectionObserver on a sentinel), tighter vertical rhythm.
- **Hero:**
  - Add a soft radial teal glow behind the headline using `--gradient-hero` + a masked SVG grid overlay for texture (no new asset).
  - Refine headline: keep copy, but split the accent word with `gradient-text` class already defined, and tighten `tracking-tight`, `leading-[1.05]`.
  - Primary CTA: keep, add `active:scale-[0.97]` and `transition-transform 160ms ease-out`.
  - Secondary CTA becomes an outline ghost button with an arrow that translates 2px on hover.
  - Add a thin trust strip under the CTAs (e.g., "Trusted by finance teams in 15+ countries") using existing muted tokens.
- **Feature cards** (grid section): unify to `rounded-2xl`, `border border-border/60`, `shadow-sm hover:shadow-lg`, image with `aspect-[16/10]` and `group-hover:scale-[1.02]` (200ms `ease-out`). Icon chip: teal-tinted `bg-accent/10` circle.
- **Pricing cards:** elevate the "Popular" plan with `--shadow-glow`, a 1px accent ring, and a small ribbon badge. Consistent CTA button widths, `active:scale-[0.97]`.
- **Testimonials:** cards get quotation-mark watermark (SVG in `text-accent/10`), tighter avatar + name block, star row uses existing `warning` token.
- **Footer:** darker navy band using `--gradient-primary`, brighter link hover, uniform column spacing.
- **Micro-motion:** section headings fade+rise on enter (`@starting-style` where available, `IntersectionObserver` fallback), stagger 40ms between siblings. No animation on keyboard-triggered elements.
- **Accessibility:** respect `prefers-reduced-motion` (skip transforms, keep opacity). Preserve one `<h1>`.

## 3. Files touched

- `src/pages/Landing.tsx` — replace nav block, tighten hero/features/pricing/testimonials/footer classNames.
- `src/index.css` — add `--ease-out` token + a `.nav-hover-panel` component class for the dropdown motion; add a `.hero-glow` utility.
- (Optional) `src/components/landing/LandingNav.tsx` — extract the new nav into its own file to keep `Landing.tsx` readable.

## Out of scope

- Copy/messaging rewrites, new imagery, SSR, route additions, backend changes.
- Changing the color palette or fonts.
- Mobile nav redesign beyond falling back to click-to-open on the same menu.

## Verification

- `bun run test` for the existing `Landing.test.tsx` (Features / Pricing / Testimonials text must still be present — the dropdown triggers keep those labels).
- Playwright screenshot at 1280×1800 of `/landing` before/after; hover a nav trigger and capture the open panel.
