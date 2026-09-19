# eterfaceID roadmap

## Done
- Phase 1 — public marketing site
- Phase 2 — console: cases, alerts, audit trail, roles, API keys
- Phase 3a — in-house watchlist warehouse, ingestion, name-matching engine, case screening, list search
- Phase 3b — document engine (machine-readable zone reader with check digits, provincial number formats, expiry and cross-checks), liveness scoring, reviewer face-match decision
- Phase 3c — own risk signals (email, phone, device, network, velocity) with an explainable score
- Phase 3d — transaction monitoring with FINTRAC/FinCEN/FATF rules, beneficial-ownership calculation (25% UBO, OFAC 50% rule), address and age verification, regulatory report packages (STR/LCTR/EFTR/SAR/CTR/FIU), regulatory coverage page, public REST API v1 (cases, screening, transactions) and signed webhooks

## Next
- Phase 3e — optional add-ons when keys arrive: Plaid (built, waiting on credentials), The KYB (built, waiting on THEKYB_API_TOKEN from backoffice.thekyb.com/settings), Interac, Twilio/Telesign, IP/email reputation
- API notepad — track and add new APIs; entries live in App admin > Integrations; connecting a listed API needs its keys (secure store, never shown)
- Nightly automatic list refresh (endpoint built at /api/public/hooks/refresh-watchlists; needs the schedule switched on after publish)
- Face-match model: currently a reviewer confirms the selfie against the document; automatic scoring needs model weights installed

## Blocked / waiting on user
- Vendor keys for the optional add-ons
- Replace placeholder marketing content (prices, address, team, certifications)
- Sign up with your own email so I can make you the administrator

## Accounts and teams (done)
- Companies (organizations), members with roles, email invites, onboarding screen.
- Every record is owned by a company; access rules and the public API are company-scoped.
- Invite emails are not sent automatically yet: the admin copies the invite link from Settings.

## App admin, billing and email notifications (done)
- /admin area for eterfaceID staff only: customer companies, plans and prices, billing and invoices, company details, integrations, email log.
- Plans set in /admin drive the public pricing page and invoice calculations.
- Usage is counted per company per month (verifications, screenings, transactions) and invoices are generated from it.
- Emails send automatically for invitations, welcomes, screening matches, monitoring alerts and filed reports; each type can be switched off per workspace in Settings.

## Official registry KYB and AML via The KYB (built, waiting on credentials)
- Optional add-on: switched on in App admin > Integrations; when off nothing on a case changes.
- Complements Plaid. Plaid confirms the person through their bank; The KYB confirms the company through official registries (legal existence, status, officers, UBOs) and screens the entity and its people.
- Console: search by name or registration number, attach the matching company, import officers/owners into the ownership graph, then run The KYB AML.
- Public API: GET/POST /cases/{id}/registry (`action` = search | attach | aml). Sandbox keys never call The KYB.
- Waiting on you: API secret from https://backoffice.thekyb.com/settings stored as THEKYB_API_TOKEN.

## Bank-confirmed identity and transactions via Plaid (built, waiting on credentials)
- Optional add-on: switched on in App admin > Integrations; when off nothing on a case changes.
- Reviewer starts "Connect bank" on a person case; the customer signs in to their own bank and the name, address, phone and email the bank holds are compared with the case, field by field.
- The result is saved as a case check and feeds the risk score.
- Linked banks import recent transactions into the monitoring screens through the existing rules; a daily job pulls new activity.
- Waiting on you: Plaid client ID, secret and environment (sandbox or production).

## Integration API v1 (done)
- Everything the console does is now available over HTTP: cases, decisions, document and liveness checks, address and age, fraud/device risk, beneficial ownership, screening and re-screening, match dispositions, payments and alerts, regulatory reports, bank-confirmed identity.
- Hosted verification links: a one-time secure link the customer opens to submit their ID and liveness check; the result arrives on the webhook.
- Safe retries with an Idempotency-Key header, paging on every list, browser-callable (CORS), usage counted per company.
- Signed webhooks: case.created, case.decision, verification.completed, screening.hit, transaction.flagged, report.filed.
- Full reference on the public Developers page plus a machine-readable file at /api/public/v1/openapi.json for Postman or client generation.

## Sandbox and live API access (done)
- Sandbox keys (`eid_test_…`) work immediately, are unlimited, free, and never touch the real
  sanctions lists or a real bank connection — results are simulated from the subject name.
- Live keys (`eid_live_…`) can only be created once the company has completed Go live: business
  details and beneficial owners verified by our own engine, the commercial agreement signed, and an
  eterfaceID reviewer's approval.
- Every API call is checked before any work: unapproved or suspended live access, missing agreement,
  inactive account, used-up monthly allowance, and more than 120 calls a minute are all refused with
  a clear error code.
- Console: Go live page. App admin: Live access queue with Approve / Decline / Suspend / Restore and
  the option to record a signed copy of the agreement.

## Brand and product films (done)
- Refined shield-and-wordmark lockup in the public header and footer.
- Silent, looping screening and transaction-monitoring films on the homepage and relevant solution pages, with reduced-motion stills.

## Authentic product imagery (done)
- Documentary-style scenes for person verification, business verification and continuous screening.
- Images appear on the homepage and their corresponding solution pages with responsive crops and descriptive text.
- Wide KYC · KYB · AML scene (ID capture, ownership review, screening desk in one frame) as a full-width picture under the homepage hero.

## Real-time Fintech monitoring film (done)
- Ten-second documentary-style film showing a Fintech compliance team monitoring live activity in the AI and Open Banking era.
- Branded captions explain why continuous monitoring matters; the film appears on the homepage and Industries page with a reduced-motion poster.
