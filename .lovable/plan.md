# eFinconnect Rename & Dashboard Redesign

## 1. Rename "Treasury Management" → "eFinconnect"

- `src/components/layout/Sidebar.tsx` (line 129): change `label: 'Treasury Management'` to `label: 'eFinconnect'`.
- `src/pages/treasury/TreasuryDashboard.tsx`: change the H1 from "Treasury Management" to "eFinconnect" and update the subtitle to reflect a payments/transfers hub (e.g. "Pay bills, remit taxes, and move money between accounts").
- `src/pages/mobile/treasury/MobileTreasuryShell.tsx`: change header "efinsuite Treasury" → "eFinconnect".
- Leave route paths (`/treasury/*`, `/banking-payments/*`) unchanged to avoid breaking links/bookmarks. Only the display label changes.

## 2. Redesign TreasuryDashboard to a bank-style action grid

Replace the current 4-KPI + recent-lists layout in `TreasuryDashboard.tsx` with a Scotiabank-style layout: labeled section headings and large white cards with a title, one-line description, and a right-side icon. Each card is a link.

Sections and cards:

**Bills**
- Pay bills → `/treasury/ap-payments` — "Pay vendor bills from anywhere with EFT or cheque."
- Pay business taxes → `/treasury/tax-payments` — "File and remit federal & provincial taxes (CRA, IRS, FIRS, HMRC)."
- Payroll remittances → `/treasury/payroll-payments` — "Send source deductions and payroll taxes."

**Transfers**
- Transfer between accounts → `/banking/transfers` (existing) — "Move funds between your connected bank & credit card accounts."
- Interac e-Transfer → `/banking-payments/payment-links` — "Send or request money by email/SMS."
- Bank deposit / Wire → `/banking-payments/scheduled` — "Send money directly to another bank account."

**Payments & Collections**
- Payment links → `/banking-payments/payment-links` — "Create shareable pay-me links."
- Stripe Connect payouts → `/banking-payments/stripe-connect` — "Route settlements to connected accounts."
- Scheduled payments → `/banking-payments/scheduled` — "View and manage upcoming outbound payments."

**Governance**
- Approvals → `/treasury/approvals` — "Approve pending payment batches."
- Payment history → `/banking-payments/history` — "Audit trail of every remittance and batch."
- Settings → `/treasury/settings` — "Rails, limits, and account defaults."

Preserve the existing KPI strip (Pending Tax, Paid YTD, AP Batches, Failed) as a compact row above the sections, and keep `ConnectedAccountsBalanceCard` at the top-right so balances remain visible — this matches how banks show account balances above the actions panel.

## Technical notes

- New card component is local to `TreasuryDashboard.tsx` — a small `ActionCard` (title, description, `to`, icon, optional external flag rendered as `ExternalLink` icon) using existing `Card`/`CardContent` + `Link` from `react-router-dom`. Use `lucide-react` icons already imported elsewhere (Receipt, Landmark, CreditCard, Users, ArrowLeftRight, Send, LinkIcon, Clock, ShieldCheck, History, Settings).
- Styling uses design tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `hover:bg-accent`) — no hard-coded colors.
- Recent Tax Payments / Recent AP Batches lists are removed from this page to match the bank-style hub; they remain reachable via their dedicated pages.
- No backend, schema, hook, or route changes.
