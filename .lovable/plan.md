
## Goal

On the Payment Links create dialog (and any other Nigeria payout picker on `/banking-payments/*`), when the active country scope is Nigeria, offer a country-appropriate "Default payout method" strip similar to the reference mockup:

`None · NIBSS (NG) · Bank · Mobile Money`

with Bank Name (lookup) and Account Number as the key input fields. Mobile Money is optional and includes an **eFinMoney** provider entry alongside MTN MoMo, Airtel Money, OPay, PalmPay, Moniepoint, Kuda.

## Changes

### 1. Add Nigeria to `src/data/localizedBankingInstitutions.ts`
- New `NG` entry in `BANKING_INSTITUTIONS`:
  - `currency: 'NGN'`, `accountNumberFormat: { label: 'Account Number', pattern: '^\\d{10}$', placeholder: '0123456789', helperText: '10-digit NUBAN' }`.
  - `clearingHouses`: NIBSS NIP (instant), NEFT (T+1), RTGS (same-day).
  - `commercialBanks`: full CBN-licensed list — Access, Zenith, GTBank, First Bank, UBA, Fidelity, FCMB, Union, Sterling, Stanbic IBTC, Ecobank, Wema, Polaris, Keystone, Providus, Unity, Titan Trust, Globus, Heritage, Citibank NG, Standard Chartered NG, SunTrust, Jaiz (non-interest), TAJ, Lotus (non-interest), Optimus, Signature, Premium Trust, Parallex, Coronation, Rand Merchant Bank NG, Nova Merchant, FSDH Merchant, FBNQuest Merchant, Greenwich Merchant.
  - `microfinance`: Kuda MFB, Moniepoint MFB, OPay Digital, PalmPay, Sparkle, Rubies, VFD MFB, Mint MFB, Fairmoney MFB.
  - `mobileMoneyProviders`: **eFinMoney**, MTN MoMo PSB, Airtel SmartCash PSB, 9mobile 9PSB, OPay Wallet, PalmPay Wallet, Paga.

### 2. Country-aware payout method strip in Payment Links dialog (`src/pages/treasury/PaymentLinks.tsx`)
- Read `useCountryScope()`. When `country === 'NG'`, replace the current `Accepted methods` select with a segmented button group:
  - `None`, `NIBSS (NG)`, `Bank`, `Mobile Money`.
- When `Bank` is selected, render:
  - **Bank Name** — `Combobox` populated from `getCommercialBanks('NG')` + `getMicrofinanceInstitutions('NG')`, with type-ahead lookup.
  - **Account Number** — `Input` validated against the NG `accountNumberFormat` (10 digits).
- When `Mobile Money` is selected, render:
  - **Provider** — `Select` from `getMobileMoneyProviders('NG')` (includes eFinMoney).
  - **Wallet / Phone Number** — `Input` (11-digit MSISDN).
- Persist selection into the existing `form.payment_method` (`bank_ng` / `mobile_money_ng`) plus new `form.payout_bank_code`, `form.payout_account_number`, `form.payout_wallet_provider`, `form.payout_wallet_number`.
- For non-NG scopes, keep the current Card/EFT/Interac controls untouched.

### 3. Small shared helper
- Add `getNigerianBanks()` and `getNigerianMobileProviders()` re-exports in `src/data/localizedBankingInstitutions.ts` for reuse by future vendor / employee payout forms.

## Out of scope

- No DB migration; the new fields are stored inside `payment_links.metadata` (already JSONB). Real settlement wiring to NIBSS / eFinMoney stays as-is.
- No changes to CA/US/ZM payout flows.
