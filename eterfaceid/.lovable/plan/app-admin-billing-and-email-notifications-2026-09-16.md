# App admin, billing and email notifications

Adds a platform-owner area (separate from customer workspaces), connects Resend for automatic emails, and lets the public pricing page read its prices from the admin area.

## 1. Platform staff access

A new `platform_staff` list holds the people who run eterfaceID. Only they can reach `/admin`. Your account is added as the first owner. Customer workspace admins see nothing new — `/admin` is invisible and blocked for them.

## 2. App admin area (`/admin`)

- **Overview** — every customer company: name, sign-up date, people, cases, verifications this month, plan, status. Click through to a company.
- **Company detail** — assign a plan, override price, included volume, suspend or reactivate, see usage against allowance.
- **Owner & company information** — your own legal entity details: registered name, address, contact email, phone, support email, registration and tax numbers, invoice footer text. These feed invoices and replace the orange placeholders on the public site (contact and about pages).
- **Plans & pricing** — create/edit plans (name, blurb, price, unit, feature bullets, "most chosen" flag, public visible yes/no, display order). This is what the public pricing page renders.
- **Billing** — monthly usage per company priced against its plan, generate an invoice (number, period, line items, subtotal, tax, total), mark sent / paid / void, download as a printable invoice page. No card payments — records and invoices only.
- **Integrations** — one place listing Resend (email) and the future add-ons (Plaid, Interac, Telesign, IP/email risk): connected or not, on/off switch, and a test button. Keys stay in the secure store, never shown.
- **Email log** — what was sent, to whom, and whether it was accepted.

## 3. Email notifications via Resend

Connecting Resend is a one-click step in chat; then the app sends:

- **Team invitation** — the invite link goes to the colleague directly, so you no longer copy it by hand.
- **Welcome** — when someone joins a workspace.
- **Case decision** — approved or rejected, to the assigned reviewer and the case creator.
- **Monitoring alert opened** and **new sanctions match** — to the workspace's admins and analysts.
- **Report filed** — confirmation with the authority reference.

Every email is branded eterfaceID, sent from your own domain once verified, and each type can be switched off per workspace under Settings. Sending failures are logged and never block the action that triggered them.

## 4. Public pricing page

`/pricing` reads plans from the admin area. Until you enter real prices, the existing placeholders remain. Contact and about page details come from the owner information you enter.

## Technical notes

- New tables: `platform_staff`, `plans`, `org_subscriptions` (org_id, plan_id, price override, included volume, status), `usage_counters` (org_id, month, verifications, screenings, transactions), `invoices` + `invoice_lines`, `app_settings` (single-row owner/company info), `integration_settings` (provider, enabled, status, last checked), `notification_preferences` (org_id, event, enabled), `email_log`. Every table gets grants; RLS restricts them to platform staff via an `is_platform_staff()` security-definer helper, except `plans` (public SELECT for visible rows) and `notification_preferences` (org-scoped).
- `/admin` routes live under a new `_platform` layout whose `beforeLoad` checks staff membership; server functions re-check server-side — the UI guard is never the only check.
- Usage counters incremented from the existing verification, screening and transaction server functions.
- Resend added through the Resend connector; sends go through server functions in `src/lib/notifications.functions.ts` using React-rendered HTML templates in `src/lib/email-templates/`. Invite sending is folded into `inviteMember`.
- Pricing page switches to a loader reading visible plans, with the current hard-coded tiers as the fallback when none are configured.
- Invoice numbers are sequential per year (`EID-2026-0001`) from a Postgres sequence.
