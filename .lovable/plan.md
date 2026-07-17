## Goal
Expose the bank/credit-card account picker directly on the AI Sheets toolbar (next to **Post to Banking**) so the user picks the destination account *before* posting. Today the picker exists only inside the mapping dialog, which makes the linkage between AI Sheets rows and the banking account invisible on the main surface.

## Scope
Frontend-only change in `src/components/dashboard/AISheets.tsx`. No schema, hook, or edge-function changes. Posting still flows through the existing `useBankTransactions` / `useCreditCardTransactions` hooks against the selected `bank_accounts.id` / `credit_cards.id`.

## Changes

### 1. Toolbar destination selector (next to "Post to Banking")
Add a compact `Select` immediately before the **Post to Banking** button on the toolbar (line ~1499). Its content depends on the auto-detected statement type:

- If `detectStatementType() === 'bank'` → list active `bankAccounts` (name + last-4).
- If `'creditcard'` → list active `creditCards` (name + last-4).

Behavior:
- Value binds to the existing `selectedBankAccountId` / `selectedCreditCardId` state.
- Default = current `effectiveBankAccount` / `effectiveCreditCard` (first active) on mount.
- Groups `[icon] Account name  ···1234` per row, using `Building2` for bank and `CreditCard` for card.
- Empty-state item: "No bank accounts — add one in Banking" / "No credit cards — add one in Banking" (disabled).
- Persist the last-used account per type in `localStorage` (`aisheets:lastBankAccountId`, `aisheets:lastCreditCardId`) and rehydrate on mount so the selection sticks across sessions.

### 2. Keep dialog selector in sync
The dialog selector at lines 2179-2233 stays but simply reflects `selectedBankAccountId` / `selectedCreditCardId`. No duplicate state.

### 3. Guard the Post button
Disable **Post to Banking** when the resolved destination id is missing (`!effectiveBankAccountId && !effectiveCreditCardId`) with tooltip "Add a bank account or credit card first". This prevents silent no-ops.

### 4. Show the chosen account in the dialog header
Replace the current "Detected: …" line with:
> Posting to **{account.name}** (···{last4}) — detected {Credit Card|Bank} statement.

Purely presentational; account id already drives `importBankTx` / `importCcTx`.

### 5. Statement-type switch also swaps selector
When the user manually chooses "Map to Bank Statement" or "Map to Credit Card" from the advanced dropdown, the toolbar selector updates to the matching account list.

## Files touched
- `src/components/dashboard/AISheets.tsx` — toolbar selector, defaults, disabled state, dialog header text.

## Out of scope
- No changes to import hooks, mapping logic, alias table, or preview panel.
- No new tables, columns, or edge functions.
- No changes to `StatementExtractionDialog` or the standalone `MappingPreviewDialog`.
