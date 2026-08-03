## What's wrong

Bills carry two separate fields:

- `bills.status` — the lifecycle badge shown in the Bills list and in the bill dialog (`draft` / `pending` / `approved` / `paid` / `overdue` / `void`), default `draft`.
- `bills.approval_status` — the approval workflow state (`pending_approval` / `approved` / `rejected`), default `pending_approval`.

The approve action in `src/hooks/useApprovals.ts` writes only `approval_status: 'approved'` (via the `STATUS_COLUMN` map) and never touches `status`. So an approved, GL-posted bill keeps `status = 'draft'` and the header badge still reads **Draft**, exactly as in your screenshot.

Confirmed in the database: the only bill on record is `status = draft`, `approval_status = approved`.

`expenses` has the same split (`approval_status` only, no `status` column, so nothing to fix there). `expense_claims` uses a single `status`, which already flips correctly.

## The fix

**1. Approve action also advances the lifecycle status (`src/hooks/useApprovals.ts`)**

When a document reaches fully-approved and posts to the GL, write both fields for bills:
- `approval_status = 'approved'` (unchanged)
- `status = 'approved'` — but only when the current status is `draft` or `pending`, so a bill already `paid`, `partial`, or `void` is never regressed.

**2. Reject / return also resets the lifecycle status**

- Returned to preparer → `approval_status = 'draft'`, `status = 'draft'`.
- Rejected → `approval_status = 'rejected'`, `status = 'void'` is *not* forced; status stays as-is and the rejection is visible via the approval banner (no silent voiding).

**3. New bills show "Pending", not "Draft" (`src/components/bills/CreateBillDialog.tsx`)**

A bill created through the dialog already inserts `approval_status: 'pending_approval'`, so it should insert `status: 'pending'` too — it's awaiting approval, not a draft. Bills saved explicitly as a draft (if that path exists) keep `draft`.

**4. Badge reflects reality (`src/components/bills/ViewBillDialog.tsx`)**

The header badge uses the same colour/label config as the Bills list instead of a raw capitalised string, and shows the approval state when it disagrees with the lifecycle status (e.g. "Rejected"). No duplicate/contradictory signals next to the existing "Approved & posted" panel.

**5. Backfill the existing data**

A migration corrects historical rows so the list isn't wrong for bills approved before this fix:

```sql
UPDATE public.bills
SET status = 'approved'
WHERE approval_status = 'approved'
  AND status IN ('draft', 'pending');
```

## Technical notes

- `STATUS_COLUMN` in `useApprovals.ts` grows a second, optional `lifecycleField` per document type so bills update both columns in one write and expenses/claims keep their current single-field behaviour.
- No change to GL posting logic, `src/lib/approvals/posting.ts`, or the approval workflow engine — this is a status-display/state-sync fix.
- The payment flow that moves a bill to `partial`/`paid` is untouched and still wins over `approved`.
