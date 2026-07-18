## Footer cleanup on /landing

### Product column
- Replace "Integrations" → **Security** linking to `#security` (existing landing section).
- Replace "Changelog" → **Testimonials** linking to `#testimonials` (existing landing section).

Result: Product column = Features, Pricing, Security, Testimonials — all anchor to real sections on /landing.

### Company column
- "About" → link to a new `/about` route (internal page, replaces the external efintax.biz link).
- Replace "Blog" → **Resources**, linking to `#features` (closest existing content on the landing page).
- Replace "Careers" → remove entirely (no page to back it; keeps the footer honest).
- Keep Contact and LinkedIn as-is.

### New /about page
Create `src/pages/About.tsx` and register the route in `src/App.tsx`. The page reuses `LandingNav` + landing footer styling and contains:
- Hero: "About efinsuite Globe" with a one-line positioning statement.
- **Our Mission** — short paragraph on democratizing AI-powered, multi-country accounting for SMBs and firms.
- **What We Stand For** — 3–4 value cards (Accuracy & Compliance, AI that Assists, Global by Design, Customer Trust) using existing lucide icons and card styling from the landing page.
- **Who We Serve** — brief paragraph covering SMBs, accounting firms, and NPOs.
- CTA row linking to `/contact` ("Talk to us") and `/signup` ("Get started").
- SEO: `<title>` "About — efinsuite Globe", matching meta description, single H1, semantic sections.

### Technical notes
- Files edited: `src/pages/Landing.tsx` (footer lines ~800–822), `src/App.tsx` (add `/about` route).
- Files added: `src/pages/About.tsx`.
- No backend or data changes. Pure presentation.
