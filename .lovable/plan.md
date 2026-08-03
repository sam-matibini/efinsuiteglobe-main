## Goal

When the extraction engine mis-classifies a row (e.g. "MBFS Auto" lease payment and "MPI Autopac Pmt" insurance shown as Credit/Deposit instead of Debit/Withdrawal), let the user correct that row before importing — without re-running extraction or fixing it later with a journal entry.

## Where the fix lands

Two surfaces are involved today:

- `src/components/banking/AdvancedMappingEngine.tsx` — the "Live Preview" panel in your screenshot. Read-only, 5 sample rows, column-level mapping only.
- `src/components/banking/MappingPreviewDialog.tsx` — the paginated "Preview & Validate Transactions" step that runs after mapping and produces the rows that actually get imported.

Row-level corrections belong in `MappingPreviewDialog`, because it processes **all** rows and is the last gate before import. The Live Preview gets a lightweight shortcut for the same action.

## What gets built

**1. Editable rows in Preview & Validate (`MappingPreviewDialog.tsx`)**

- New `rowOverrides` state: `Map<rowIndex, Partial<mappedRow>>`, merged on top of each computed row so re-parsing never wipes an edit.
- An "Edit" (pencil) action per row opens an inline editor row / small popover allowing correction of:
  - Transaction Date, Posted Date
  - Description, Payee/Payor, Reference
  - Debit and Credit amounts (or the single Amount column when that's what's mapped)
  - Category / Memo when mapped
- A **Type** dropdown per row (Deposit ↔ Withdrawal). Changing it moves the value between the debit and credit fields and recomputes the signed `amount` using the existing convention (`credit - debit` for bank, `debit - credit` for credit card), so the GL direction follows automatically.
- A one-click **Flip** button on the Type badge for the common case shown in your screenshot — turns "Deposit 613.65" into "Withdrawal 613.65" in a single click.
- Edited rows show an "Edited" badge and a per-row Reset; a header-level "Reset all edits" clears everything.
- Overrides re-run validation, so a corrected row that previously errored becomes importable, and the valid/error counts update live.

**2. Bulk fix by description**

Because the same payee recurs across a statement, the row editor offers "Apply to all rows matching this description/payee" when flipping type — one click fixes every MBFS Auto and MPI Autopac line in the statement.

**3. Quick flip in Live Preview (`AdvancedMappingEngine.tsx`)**

The Deposit/Withdrawal badge in the Live Preview panel becomes clickable, flipping the sign for that sample row and surfacing a hint that full row-by-row correction is available on the next (Preview & Validate) step. No mapping-config semantics change here.

## Technical notes

- `processedData` stays a `useMemo` over `sourceData` + mapping config; overrides are applied in a second derived pass so the source of truth is unchanged and edits survive page changes within the dialog.
- `normalizeMappedRow` and `deriveType` already own the sign/type convention; the editor writes debit/credit and lets those two functions derive `amount` and `type`, so bank vs credit-card conventions stay in one place.
- `handleConfirm` emits the override-merged rows, so corrections flow through `onImport` into the banking transactions exactly like clean rows.
- No database or edge-function changes; this is entirely in the import preview UI.
