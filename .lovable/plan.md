## Goal

Let you correct mis-mapped rows (e.g. "MBFS Auto" lease payment or "MPI Autopac Pmt" shown as a green Deposit) directly in the **Preview & Validate** step, before import — no journal-entry cleanup afterwards.

## Where it lands

`src/components/banking/MappingPreviewDialog.tsx` — the last gate before rows are imported. `src/components/banking/AdvancedMappingEngine.tsx` Live Preview points users to that step.

## What the step provides

1. **One-click Deposit↔Withdrawal flip** — a flip icon on each row's type badge moves the value between debit and credit and recomputes the signed amount using the existing convention (`credit - debit` for bank, `debit - credit` for credit card), so GL direction follows automatically.
2. **Inline row editor** — a pencil opens an editor for Transaction Date, Posted Date, Description, Payee/Payor, Reference, Debit, Credit (or the single Amount column when that's what's mapped).
3. **Apply to all matching rows** — when flipping a type, an option applies the same correction to every row sharing that description/payee, so all MBFS Auto / MPI Autopac lines are fixed in one click.
4. **Edited badge, per-row reset, and reset-all** — corrections are tracked in a `rowOverrides` map layered on top of the computed rows, so edits survive re-parsing and page changes.
5. **Live re-validation** — overrides re-run validation, so corrected rows become importable and the valid/error counts update; the override-merged rows are what gets imported.

## Technical notes

- `rowOverrides: Record<rowIndex, Partial<row>>` merged in a derived pass over the `useMemo` source data, so the parsed source stays the source of truth.
- Type/sign convention stays owned by the existing normalize/derive helpers; the editor writes debit/credit and lets them derive amount and type.
- No database or edge-function changes.

## Status

All of the above is already present in `MappingPreviewDialog.tsx` (flip control, inline editor, "Apply this type to all N matching rows", edited badge, resets). Approving this plan means I re-verify it end-to-end against a real statement import and fix anything that doesn't behave as described.
