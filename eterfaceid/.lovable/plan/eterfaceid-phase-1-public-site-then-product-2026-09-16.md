# eterfaceID — Phase 1: Public Site, then Product

A compliance-grade identity platform (KYC / KYB / AML) for Canadian and global regulated businesses. Light, clinical visual direction: white surfaces, hairline rules, restrained ink-and-accent palette, generous whitespace — closer to your second reference than the dark one.

## Phase 1 — Public site (build now)

Pages, each a real URL with its own title and social preview:

- **Home** — positioning, the three pillars (Verify people, Verify businesses, Screen continuously), coverage, compliance posture.
- **Solutions index** plus one page each:
  - Person Verification — document capture, passport/ID/driver's licence, name, date of birth, address, ID numbers, phone, email, selfie, liveness, face-to-ID match.
  - Business Verification — registry lookups, beneficial ownership (UBO) tracing, directors and officers, business status.
  - AML Screening & Monitoring — sanctions, PEP, government watchlists, adverse media, ongoing rescreening.
  - Fraud & Risk Intelligence — device and network risk, email and phone risk, velocity and fraud signals.
- **Industries** — Fintech, Money Services Businesses, Payments / PSPs, Lending, Crypto, Marketplaces, Real Estate, Insurance.
- **Compliance** — how the platform maps to FINTRAC obligations (identity methods, record keeping, retention, ongoing monitoring, reporting) and Bank of Canada PSP registration under the RPAA.
- **Developers** — API overview with realistic request/response samples and a walkthrough of the verification lifecycle.
- **Pricing** — Starter / Growth / Enterprise.
- **Company** — About, Careers, Contact.

Navigation: a multi-column dropdown grouped as Solutions / Risk Intelligence / Resources / Company, matching the structure of your first reference but rendered in the light treatment. Footer mirrors the same groups.

Content will be written as plausible product copy. Anything factual I can't know — office address, phone, support email, team names, real certifications (SOC 2, ISO 27001), pricing numbers — goes in as clearly marked placeholder text for you to replace. I will not claim certifications you don't hold.

## Phase 2 — Product dashboard (after the site is approved)

Backend on Lovable Cloud with accounts and three roles:

- **Admin** — manages users, API keys, screening thresholds, retention settings.
- **Analyst** — creates and reviews cases, adjudicates screening hits, escalates.
- **Viewer** — read-only.

Roles stored in a dedicated roles table with database-level access rules, never on the user profile.

Core screens: case list with status and risk filters, individual case (applicant details, document images, liveness and face-match outcomes, fraud signals), business case (entity, registry data, UBO tree with a verification case per owner), screening hits with match reasoning and a true/false-positive decision trail, ongoing-monitoring alerts queue, immutable audit log, API key management.

## Live verification providers — what I need from you

You chose real providers over simulated data. That can't be wired up until accounts exist, so Phase 2 ships behind a provider layer with each integration switched on as credentials arrive. Likely set:

- Document, selfie, liveness and face match — one of Persona, Veriff, Onfido, or Trulioo.
- Canadian business registry and UBO — Trulioo, Middesk, or provincial registry feeds.
- Sanctions / PEP / watchlist / adverse media — ComplyAdvantage, Dow Jones, or OpenSanctions.
- Email, phone, device and network risk — SEON, IPQS, or Telesign.

Before Phase 2 I'll ask which vendors you've signed with, then request each key through the secure secrets form. Keys are never written into the code.

## Technical notes

- TanStack Start with file-based routes; one route file per page above, each with its own metadata.
- Design tokens (light palette, type scale, spacing, radii) defined once in the stylesheet; no hardcoded colours in components.
- Typography: a distinctive humanist sans for headings paired with a highly legible body face — not the default stack.
- Phase 2 uses server functions with per-role authorization checked server-side, plus row-level policies; verification provider calls happen server-side only.
- Audit trail is append-only, matching FINTRAC record-retention expectations.

## What Phase 1 does not include

No login, no database, no live verification calls. Those land in Phase 2.
