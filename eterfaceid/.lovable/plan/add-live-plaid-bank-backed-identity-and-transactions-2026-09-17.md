# Add live Plaid: bank-backed identity and transactions

Plaid becomes an optional add-on, switched on from App admin > Integrations. When it is off, nothing in the product changes.

## What you get

**Identity confirmed by the bank**
On a person case, a reviewer starts a "Connect bank" step. The person signs into their bank through Plaid's secure window, and the name, address, phone and email their bank holds come back. Each field is compared with what the case already claims and shown as matched, close, or different, with the same tick/cross style the document checks use. The result is saved as a case check and feeds the risk score.

**Real transactions in monitoring**
Once a bank is linked, the last 90 days of transactions are pulled in and appear on the Transactions screen alongside manually recorded ones. They run through the existing rules (large cash, cross-border, structuring, velocity, counterparty screening), so alerts and reports work unchanged. A daily job pulls new activity.

## What you need to supply

Plaid production access is granted by Plaid after a short review; sandbox works immediately. I'll request three values through the secure form when you're ready: client ID, secret, and which environment to use (sandbox or production). Keys are never shown in the app.

## Things to note

- Bank linking requires the customer to be present and sign in; it cannot be done on their behalf.
- Plaid charges per linked account and per product; usage is counted per company so it shows on their invoice.
- Canadian bank coverage through Plaid is good but not complete; cases where no bank is linked simply carry on as today.

## Technical notes

- New tables: `plaid_items` (org_id, case_id, item_id, access_token encrypted at rest, institution, status, cursor) and `plaid_identity_results` (org_id, case_id, item_id, returned fields, per-field comparison, result). Grants + org-scoped RLS matching the existing tenant tables.
- `src/lib/plaid.server.ts`: thin client over Plaid's REST API reading `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` inside handlers; endpoints used are `/link/token/create`, `/item/public_token/exchange`, `/identity/get`, `/transactions/sync`.
- `src/lib/plaid.functions.ts`: `createLinkToken`, `exchangePublicToken`, `runIdentityCheck`, `syncTransactions` — all `requireSupabaseAuth` + `can_write_org`, each recording an audit event and bumping usage.
- Field comparison reuses `normalizeName`/`tokenSimilarity` from `src/lib/name-match.ts` and `validateAddress` from `src/lib/address-rules.ts`; no new matching logic.
- Imported transactions go through the existing `recordTransaction` path so rules, alerts and notifications are untouched; source marked `plaid` to distinguish from manual entries.
- A new Bank panel in `src/components/console/verification.tsx` loads Plaid Link only in the browser, behind the integration being enabled.
- Daily `transactions/sync` added to the existing cron hooks under `src/routes/api/public/hooks/`, guarded by the same cron secret.
- `integration_settings` already has a `plaid` row; the on/off switch and test button in App admin > Integrations drive it.

## Roadmap

`roadmap.md` gains an open item: "Add live Plaid API — bank-confirmed identity and transaction import; needs Plaid production credentials."
