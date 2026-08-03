## Goal
Turn the Providers tab of `/banking-payments/payout-routing` from two static cards into a tile grid where every payout provider has its own tile with an on/off toggle.

## Tiles
A responsive grid (1 / 2 / 3 columns) of provider tiles:
- **Wise** — EFT, e-Transfer, card payouts, payment links (keeps Add recipient + Open Wise + recipient list)
- **Stripe Connect** — card acquiring, connected-account transfers (keeps Manage accounts + Compliance)
- **eFinMoney Wallet** — wallet payouts for vendors and payroll
- **Paysafe** — EFT / card payouts
- **Plaid / Bank (ACH-EFT)** — direct bank rails
- **Wire**, **Cheque**, **Manual** — grouped as a compact "Offline methods" tile with individual switches

Each tile shows: icon + name, a status badge (Active / Off / Not configured), one-line description, a live stat line (e.g. "1 saved recipient · 0 transfers"), its action buttons, and a `Switch` in the top-right corner.

## Toggle behaviour
- The switch enables/disables the provider for this organization; when off, the tile dims, its action buttons are disabled, and the badge reads **Off**.
- State persists in the existing `organizations.efinconnect_preferences` JSON under a new `payout_providers` key (`{ wise: true, stripe: true, efinmoney: false, ... }`), so no migration is needed.
- Defaults when the key is absent: Wise and Stripe on, everything else off.
- Disabled providers are filtered out of the provider dropdowns in the Vendor routing tab and in the payroll batch dialog, so the toggle actually shapes what users can pick.

## Technical notes
- New hook `src/hooks/usePayoutProviderToggles.ts`: reads `efinconnect_preferences` from the current organization, exposes `enabled` map + `setEnabled(provider, value)` mutation that merges into the JSON and invalidates the organization query.
- `src/pages/treasury/PayoutRouting.tsx`: extract a small local `ProviderTile` component (props: icon, title, description, badge, enabled, onToggle, children) and render the tiles from a config array; existing Wise dialog and Stripe buttons move inside their tiles unchanged.
- Filtering in `PayoutRouting.tsx` vendor rows and `src/pages/treasury/PayrollPayments.tsx` provider select reads the same hook.
- Uses `@/components/ui/switch`; all colors via semantic tokens.
