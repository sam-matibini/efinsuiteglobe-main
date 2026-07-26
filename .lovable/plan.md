## Plan: Differentiate eFinconnect icon & rearrange payment methods (Scotiabank layout)

### 1. Sidebar icon change
`src/components/layout/Sidebar.tsx` — currently both "Banking" (line 114) and "eFinconnect" (line 130) use `Landmark`. Change eFinconnect's icon to **`Send`** (lucide-react paper-plane) so it visually represents "moving money out" and clearly differs from Banking's building icon. Add `Send` to the imports at the top.

### 2. Rearrange TreasuryDashboard to match Scotiabank layout
`src/pages/treasury/TreasuryDashboard.tsx` — restructure the action grid to mirror the reference screenshot exactly. Only two sections remain at the top (Bills, Transfers); Payments & Collections and Governance stay below unchanged.

**Bills (2 cards):**
- Pay bills — "Pay bills easily from anywhere with your phone, tablet, or computer." → `/treasury/ap-payments`
- Pay business taxes — "File and pay your Federal and Provincial government business taxes." → `/treasury/tax-payments` (external)

**Transfers (4 cards):**
- Transfer between accounts — "Pay your credit card or transfer money between your accounts." → `/banking/transfers`
- Interac e-Transfer — "Send and request money from anyone with a Canadian bank account with Interac e-Transfer." → `/banking-payments/payment-links`
- Bank deposit — "Send money directly to a bank account with International Money Transfer." → `/banking-payments/scheduled` — with small subtitle chip *"Delivery estimate: Up to 5 business days"*
- Cash pickup — "Send money to an agent location with Western Union." → `/banking-payments/scheduled` — with subtitle chip *"Delivery estimate: 2–4 hours"*

Remove the "Payroll remittances" card from Bills (it stays reachable from the sidebar).

**Card styling tweaks** to match Scotia:
- Icon on the right, chevron top-right (already close).
- Add optional `deliveryEstimate?: string` prop to `ActionCard`; when set, render a subtle muted chip beneath the card.
- Section headings stay small/bold; keep 2-column grid on md, 3-column on lg so the "Transfers" row wraps like the screenshot (3 up top, Cash pickup on its own row).

### Out of scope
No routing, business logic, KPI, or balance-card changes. Payments & Collections and Governance sections remain as-is.