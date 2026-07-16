
## Phase 10 — Gemini Integration Audit + Credit Card Mapping Fix

Two tightly-scoped changes, both frontend/edge-only. No schema changes, no changes to bank statement logic.

---

### 1. Verify Google Gemini API integration end-to-end

Two extraction paths exist today; both must work:

| Path | Function | Auth | Model |
|---|---|---|---|
| Dialog uploads (`StatementExtractionDialog`) | `pdf-to-spreadsheet` | `LOVABLE_API_KEY` → `ai.gateway.lovable.dev` | `google/gemini-2.5-flash` |
| Programmatic hook (`useBankStatementExtraction`) | `ai-extract-bank-statement` | `GOOGLE_AI_API_KEY` → direct Google API | `gemini-2.5-pro` |

Audit steps (read-only, no code changes required unless a gap is found):
- Confirm both secrets (`LOVABLE_API_KEY`, `GOOGLE_AI_API_KEY`) are present in project secrets via `fetch_secrets`.
- Ping `gemini-health` edge function to verify Google reachability.
- Re-invoke `pdf-to-spreadsheet` against a known-good sample and inspect `edge_function_logs` for `AI ... failed` entries.
- If a secret is missing, request it via `add_secret`. If `gemini-health` returns non-2xx, surface the exact provider error to the user; do not "fix" by rotating keys blindly.

Deliverable: a short status report in chat plus any missing-secret action. No code changes if everything passes.

---

### 2. Fix credit-card charge/payment mapping accuracy

**Root cause.** `pdf-to-spreadsheet` correctly emits CC rows as `Charge` / `Payment` columns and applies the description-first keyword swap (Phase 9). But `MappingPreviewDialog.tsx` then collapses those two columns into a single signed `amount` using the **bank formula** for every statement type:

```ts
mapped['amount'] = credit - debit;   // line 258 and line 356
```

For a CC statement mapped as `debit=Charge`, `credit=Payment`, this produces:
- Charge $100 → `amount = 0 - 100 = -100`  → downstream `classifyCreditCardType` sign-fallback sees negative → **classified as "payment"** ❌
- Payment $500 → `amount = 500 - 0 = +500` → sign-fallback sees positive → **classified as "charge"** ❌

Every CC row imported through the Alice extractor is being flipped unless its description happens to trigger a keyword match in `classifyCreditCardType`.

**Fix.** In `src/components/banking/MappingPreviewDialog.tsx`, make the amount derivation statement-type aware:

```ts
// CC convention: positive = charge (money out of card), negative = payment (money into card)
// Bank convention: positive = deposit (credit), negative = withdrawal (debit)
const signedAmount = statementType === 'creditcard'
  ? debit - credit    // Charge - Payment
  : credit - debit;   // Credit - Debit
```

Apply this at both call sites:
- Line 254-258 (initial `processedData` derivation used for the preview table).
- Line 352-357 (`normalizeMappedRow`, which produces the final row handed to `onImport` → `AIAccountingAssistant`).

`deriveType` at lines 313-337 already uses the CC-correct convention (positive amount → withdrawal/charge) so no change needed there — it becomes consistent once the sign is correct.

Downstream `classifyCreditCardType` in `AIAccountingAssistant.tsx` (line 320) is unchanged: description-first still wins, but the sign fallback now points the right way for ambiguous vendor rows.

**Out of scope**
- Bank statement mapping logic (explicitly untouched).
- Any change to `pdf-to-spreadsheet` extraction — Phase 9 keyword swap remains the source of truth on the extractor side.
- Historical reprocessing of already-imported CC rows. Users must re-import affected statements or reclassify inline via the existing Credit Card Transactions page.
- Schema, RLS, or GL posting logic (`useCreditCardGL` is already correct given a correct `transaction_type`).

### Files touched
- `src/components/banking/MappingPreviewDialog.tsx` — two-line sign-convention fix at lines ~258 and ~356.

### Verification
- Rebuild; open the Alice extraction dialog for an RBC Avion Visa PDF; confirm the preview Type column shows charges as red "Withdrawal/Charge" and payments as green "Deposit/Payment".
- Import; open Credit Card Transactions; confirm charges post as debit-Expense/credit-CC-Liability and payments as debit-CC-Liability/credit-Bank.
