# Feature Audit Document

Deliver a detailed Markdown report at `/mnt/documents/feature-audit.md` classifying every feature in the project as:

- **Completed & Functional** — code present, wired to routes, backed by real data/logic, verified via smoke check where reachable.
- **Completed & Non-Functional** — UI/code shipped but broken, placeholder-backed, disconnected from data, or throws at runtime.
- **Not Completed** — stubs, TODOs, `PlaceholderPage`, empty routes, or feature memory notes marked WIP.

## Method

1. **Inventory** — enumerate all routes in `src/App.tsx`, all pages in `src/pages/**`, all edge functions in `supabase/functions/**`, and cross-reference `.lovable/memory/features/**` notes.
2. **Static signals per feature**:
   - Presence of real hook/query vs mock (`src/data/mock*`, hardcoded arrays)
   - Uses `PlaceholderPage` component → Not Completed
   - `TODO`/`FIXME`/`coming soon`/`not yet supported` markers → flag
   - Backing table exists (grep migrations) and RLS/grants present
   - Edge function deployed and referenced from UI
3. **Live smoke checks (Playwright, authenticated)** on representative routes across each module:
   - Dashboard, Chart of Accounts, Journal Entries, Invoices, Bills, Bank Reconciliation, Reports (Income Statement, Balance Sheet, Trial Balance, Cash Flow), Payroll (Employees, Pay Runs), Tax (Filings, Audit), DocSign, Communication Hub, Treasury (Copilot, Alerts), Marketplace, Firm/Practice, Fixed Assets, Leases, Donations, Consolidation, Currency Revaluation.
   - Capture console errors, network failures, and screenshot each. Route counts as Non-Functional if it renders blank, crashes, or shows only skeleton after 5s.
4. **Classification table per module** with columns: Feature | Status | Evidence (file:line / route / memory ref) | Notes.

## Document Structure

```text
# Project Feature Audit
## Executive Summary (counts + top risks)
## Legend (status definitions)
## 1. Accounting Core (COA, JE, GL, Trial Balance)
## 2. Sales (Invoices, Quotes, Credit Notes, Recurring, Payments)
## 3. Purchases (Bills, POs, Vendor Credits, Recurring Bills)
## 4. Banking & Reconciliation (Bank, Credit Card, Rules, Plaid)
## 5. Reports (Financial statements, comparatives, cash flow, FX)
## 6. Tax (Sales tax, filings, provisions, EU VAT, UK MTD, US state, CRA)
## 7. Payroll (Employees, Timesheets, Pay Runs, T4/ROE/PD7A, global)
## 8. Fixed Assets & Leases
## 9. DocSign
## 10. Communication Hub (Voice/SMS/WhatsApp)
## 11. Treasury & Settlements (Processors, Copilot, Alerts, Mobile)
## 12. Donations & NPO (ASNPO, T3010)
## 13. Consolidation & Multi-Currency
## 14. Practice / Firm Management
## 15. Marketplace & Integrations
## 16. Admin, RBAC, Security, Auth
## 17. Landing / Public / SEO
## Appendix A — Route inventory (all 104 routes with status)
## Appendix B — Edge functions inventory
## Appendix C — Memory notes reviewed
```

## Deliverable

- `/mnt/documents/feature-audit.md` surfaced via `<presentation-artifact>`.
- Screenshots kept in `/tmp/browser/` (not shipped).
- Followed by a 1-line summary of headline counts.

## Out of Scope

- No code changes.
- No fixing of any Non-Functional item found — audit only.
- No re-running of tests or builds.

## Verification

- Confirm every route in `App.tsx` appears in Appendix A.
- Confirm each module section has at least one evidence file reference per feature.
- Confirm all Playwright screenshots inspected before finalizing statuses.
