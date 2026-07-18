## Problem

In the Reports Centre (`/reports`), roughly 25 report cards have no `href` set, so clicking them does nothing — the card just sits there and the user sees no data. Every card that already has an `href` points to a route that exists in `App.tsx` (verified by diffing hrefs against the route table), so the issue is limited to the missing links, not broken paths.

Cards currently missing links:
- Sales: Sales Summary, Customer Statement
- Banking: Outstanding Checks, Cash Position
- Inventory: Stock Movement, Reorder Report, Inventory Adjustments
- Fixed Assets: Depreciation Schedule, Asset Disposition, CCA Schedule
- Leases: Lease Amortization, Lease Maturity Analysis, ROU Asset Summary
- Tax: Tax Summary, QST Report, PST Report, Tax Exception Report
- Payroll: Employee Earnings, Payroll Register, Deduction Report, PD7A Report, Vacation Accrual, Benefits Report
- Management: Financial Ratios, Budget vs Actual

## Fix

In `src/pages/ReportsCentre.tsx`, wire every card to the best existing route so clicks always land on real data:

| Report | New href |
|---|---|
| Sales Summary | `/sales/invoices` |
| Customer Statement | `/sales/customers` |
| Outstanding Checks / Cash Position | `/banking/accounts` |
| Stock Movement / Reorder Report / Inventory Adjustments | `/inventory` |
| Depreciation Schedule / Asset Disposition / CCA Schedule | `/fixed-assets` |
| Lease Amortization / Maturity / ROU Asset Summary | `/leases` |
| Tax Summary / QST / PST / Tax Exception | `/tax` |
| Employee Earnings / Payroll Register / Deduction Report / Vacation Accrual / Benefits Report | `/payroll/reports` |
| PD7A Report | `/payroll/remittances` |
| Financial Ratios | `/reports/management` |
| Budget vs Actual | `/reports/management` |

Also small UX polish so clicks always feel responsive:
- Keep the existing "Pro/New" badges but remove the `cursor-default` fallback branch — every card is now clickable.
- Leave `isPremium` / `isNew` flags as-is (informational only).

No changes to routes, data hooks, or business logic — this is a presentation-layer link fix inside `ReportsCentre.tsx` only.