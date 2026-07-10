## Goal

Two related edits to `/landing`:

1. **Message a real differentiator:** competitors' payment flows are one-directional (either pay bills OR collect from customers). efinsuite does both in one ledger. Make this the headline pillar, not a bullet buried in features.
2. **Add motion** — Emil-style: purposeful, `ease-out`, custom curves, `prefers-reduced-motion` respected, nothing that plays on every scroll.

---

## 1. Bidirectional payments story

### 1a. New "Two-way money flow" hero moment

Insert a dedicated section between the Differentiators grid and the Features grid. Full-width, dark navy (uses `--gradient-hero`), single idea per fold.

Layout: split diagram on the left, copy + CTA on the right.

- **Eyebrow:** "Money in. Money out. One ledger."
- **Headline:** "Most tools move money one way. efinsuite moves it both."
- **Body:** 2 sentences on why one-directional AR-only or AP-only tools force reconciliation gymnastics; efinsuite unifies collect + pay + reconcile in a single audit trail.
- **Diagram (SVG, built inline):**
  - Left column: 3 pills labeled "Customers · Invoices · Cards" with arrows pointing *right* into a central "efinsuite Ledger" node.
  - Right column: 3 pills labeled "Vendors · Payroll · Tax authorities" with arrows pointing *left* out of the ledger node.
  - The ledger node pulses subtly (2s ease-in-out infinite, opacity + scale).
  - Arrows animate: dashed stroke with `stroke-dashoffset` drifting inward, giving a slow "flow" impression on both sides. Runs only when the section is in view; paused on `prefers-reduced-motion`.
- **Under diagram:** 3 mini stats — "AR + AP in one entry", "0 CSV exports between sides", "Real-time cash position".

### 1b. Differentiators grid: swap in bidirectional pillar

The current 4 pillars are Alice AI · 15+ Countries · Multi-org · Enterprise Security. Replace **"Multi-org from day one"** with a new pillar (multi-org is already implied by the platform description; the two-way flow is the sharper competitive edge):

- **Icon:** `ArrowLeftRight` (lucide)
- **Title:** "Two-way money movement"
- **Body:** "Collect from customers *and* pay vendors, payroll, and taxes from the same ledger — most tools only do one side."
- **Proof line:** "AR + AP + payroll in one ledger"

Multi-org gets folded into the Alice/Compliance copy so nothing gets lost.

### 1c. Hero badge copy tweak

Current hero badge: `🤖 AI-Powered • ☁️ Cloud-Based • 🏢 Multi-Organization • 🌍 15+ Countries`

Update to: `Collect payments · Pay vendors · Run payroll · One ledger` — this teases the two-way story above the fold without redesigning the hero.

---

## 2. Motion pass (Emil-style)

### 2a. New easing tokens (`src/index.css`)

Add alongside existing `nav-hover-panel`:

```css
--ease-out-emil: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out-emil: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

### 2b. `useInViewOnce` helper

Small hook in `src/hooks/useInViewOnce.ts` using `IntersectionObserver` with `{ threshold: 0.15, rootMargin: '0px 0px -10% 0px' }`, fires once, returns `[ref, inView]`. Used to gate scroll-reveals so they don't fire off-screen or replay.

### 2c. Section reveals

Not every section. Only the ones that benefit from purposeful entrance:

| Section | Motion | Duration | Easing |
|---|---|---|---|
| Hero headline + subhead + CTAs | Stagger fade-up on load (headline → subhead → CTAs → trust chips), 60ms between | 260ms | `--ease-out-emil` |
| Differentiators grid (4 cards) | Fade + `translateY(12px) → 0` staggered 60ms | 240ms | `--ease-out-emil` |
| Two-way flow section (new) | Diagram scales `0.96 → 1` + fades; copy fades up | 320ms | `--ease-out-emil` |
| Testimonial cards | Fade + rise, 50ms stagger | 240ms | `--ease-out-emil` |
| Final CTA card | Fade + subtle scale `0.98 → 1` | 320ms | `--ease-out-emil` |

Feature grid (14 cards) and pricing (3 cards) intentionally get no scroll reveal — users see them repeatedly on scroll-back, and staggering 14 items is slop.

Start states use `opacity: 0; transform: translateY(12px)` (never `scale(0)` — nothing in the real world appears from nothing).

### 2d. Micro-interactions

- **Buttons:** add `active:scale-[0.97]` and `transition-transform 160ms var(--ease-out-emil)` to the pricing CTAs, the "Book a Demo" button, and the final CTA button. (Hero CTAs already have this from a previous pass.)
- **Feature cards:** current `hover:scale-105` on the image is fine but add `transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]` for a stronger curve.
- **Differentiator cards:** on hover, icon chip rotates 0 → 6deg + subtle `bg-accent/15`, 200ms `ease-out-emil`. Card lifts `translateY(-2px)` + shadow bump.
- **Pricing "Most Popular":** ribbon gets a slow 3s `ease-in-out` opacity pulse on the accent glow, respects reduced-motion.
- **Nav hover panel:** already animated; leave alone.

### 2e. Two-way flow diagram animation

Uses CSS `@keyframes`, not Framer, so it runs off the main thread:

```css
@keyframes flow-dash {
  to { stroke-dashoffset: -40; }
}
@keyframes ledger-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 40px hsl(172 66% 50% / 0.25); }
  50%      { transform: scale(1.03); box-shadow: 0 0 60px hsl(172 66% 50% / 0.45); }
}
```

- Flow arrows: 4s linear infinite, only when section in view (toggle class).
- Ledger node: 2.4s `ease-in-out` infinite.
- Both suppressed under `prefers-reduced-motion`.

### 2f. Reduced-motion handling

Single global block in `index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .reveal, .reveal-child { opacity: 1 !important; transform: none !important; }
  .flow-arrow, .ledger-pulse { animation: none !important; }
}
```

Fades stay elsewhere (they aid comprehension); transforms are stripped.

---

## 3. Files touched

- `src/pages/Landing.tsx` — insert two-way flow section, swap differentiator pillar, update hero badge, add reveal classes + `useInViewOnce` refs on target sections, wire button `active:scale-[0.97]`.
- `src/components/landing/TwoWayFlow.tsx` — new component holding the split diagram + copy (keeps `Landing.tsx` readable).
- `src/index.css` — easing tokens, `.reveal` / `.reveal-child` utility, flow + pulse keyframes, reduced-motion overrides.
- `src/hooks/useInViewOnce.ts` — new hook.

## Out of scope

- Copy rewrites outside the pieces above.
- New imagery (diagram is inline SVG, no assets).
- Framer Motion install (CSS-only, off main thread).
- Nav, footer, feature grid, pricing structure — no changes.
- Adding motion to the stock ticker, floating market widget, or chat widget.

## Verification

- Playwright at 1280×1800: capture `/landing` top (hero staggered), mid (two-way flow with diagram running), testimonials, CTA.
- Emulate `prefers-reduced-motion: reduce` and confirm all transforms are stripped.
- `bunx tsgo --noEmit` clean.
