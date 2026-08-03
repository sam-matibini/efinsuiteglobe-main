## 1. Wise and eFinMoney wallet payout providers for payroll

Today the payroll batch dialog (`/treasury/payroll-payments`) offers only Stripe, Plaid, Paysafe EFT/Card, Wire, Wallet, Cheque, Manual — this is enforced by a database check constraint on `payroll_payment_batches.provider`. Rails are similarly constrained on `payroll_payment_items.rail`.

**Database migration**
- Extend the `provider` check on `payroll_payment_batches` with: `wise_eft`, `wise_etransfer`, `wise_card`, `efinmoney`.
- Extend the `rail` check on `payroll_payment_items` with: `wise_eft`, `wise_etransfer`, `wallet_efinmoney`.

**Frontend**
- `src/hooks/usePayrollPaymentBatches.ts`: add the new values to `PayrollBatchProvider` and `Rail` types; when the chosen provider is a Wise or eFinMoney one, default each employee item's rail accordingly instead of `ach`.
- `src/pages/treasury/PayrollPayments.tsx`: add the provider options — Wise EFT, Wise e-Transfer, Wise Card payout, eFinMoney Wallet — grouped under a "Wise" / "Wallets" label, and auto-set the default rail when a provider is picked.
- `src/components/treasury/RailPicker.tsx`: add the three new rails with icons and helper text, and treat Wise/eFinMoney rails as available when the corresponding provider is selected (they are not tied to the funding bank's supported rails).

**Processing**
- `supabase/functions/treasury-pay-payroll-batch`: route items whose rail is `wise_eft` / `wise_etransfer` through the existing `wise-create-transfer` function (using the employee's saved Wise recipient or inline bank details already stored on the item), and record `wallet_efinmoney` items as instructed/manual wallet payouts pending confirmation, same pattern as the existing fallback. Employees without a Wise destination keep falling back to cheque as today.

## 2. Add more vendors in Vendor routing

The Vendor routing tab lists existing vendors only, with no way to add one and no search — long vendor lists are unusable.

In `src/pages/treasury/PayoutRouting.tsx`:
- Add a search box above the table filtering vendors by name.
- Add an **Add vendor** button opening a small dialog (name, email, phone, default currency) that inserts into `public.vendors` for the current organization, invalidates the vendor query, and immediately shows a routing row for the new vendor.
- Add a **Bulk assign** control: pick a provider + destination + method and apply it to all currently filtered vendors in one save.
- Include `efinmoney` alongside Wise and Stripe in the per-vendor provider select, with wallet ID as the destination field, so vendor routing matches the payroll providers.

## Technical notes
- Provider/rail values are plain `text` with check constraints, so widening is a low-risk `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT` pair; no data migration is needed.
- Wise API calls still degrade to "instructed" mode when `WISE_API_TOKEN` / `WISE_PROFILE_ID` are unset, as with the existing bill payout path.
- eFinMoney already exists as a mobile-money institution in `src/data/localizedBankingInstitutions.ts`; the wallet payout will reuse that code (`EFINMONEY`) for labeling.
