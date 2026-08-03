
# Approve & Post to GL — Bills, Expense Claims, Direct Expenses

## Goal
No purchase document touches the General Ledger until it is approved. The person who prepares a document cannot approve it. Approvers are either a role (default) or a named multi-step workflow configured in Settings.

## Current behaviour (verified)
- Bills post to the GL immediately on creation (`CreateBillDialog.tsx` calls `postBillToGL`).
- Direct expenses post immediately (`useExpenses.ts` calls `createJournalEntry` and sets `is_posted`).
- Expense claims have `status` / `approved_by` / `approved_at` and a `journal_entry_id` column, but nothing ever posts them to the GL.
- Tables `approval_workflows`, `approval_workflow_steps`, `approval_requests`, `approval_actions` exist in the database but are not used anywhere in the app.

## What will be built

### 1. Approval gate on creation
- Bills and direct expenses are saved as **Pending approval** and are *not* posted. Expense claims keep their submit flow and also become postable only after approval.
- The document lists show an "Awaiting approval / Approved / Posted" badge and filter.

### 2. Approve and Post action
- A single **Approve & Post to GL** action on each document (Bills, Expense Claims, Direct Expenses) that, in one transaction-like sequence: records the approval, creates the balanced journal entry, and links `journal_entry_id`.
  - Bills: DR expense/asset lines + input tax, CR Accounts Payable (existing `postBillToGL`).
  - Direct expenses: existing expense posting logic, moved behind the gate.
  - Expense claims: new posting helper — DR each claim line's expense account + tax, CR Employee Reimbursements Payable (falls back to Accounts Payable when no dedicated account exists).
- **Reject** and **Send back to preparer** actions with a comment, returning the document to draft.
- Approvals are audited: every approve/reject/return writes an `approval_actions` row.

### 3. Segregation of duties
- The preparer (creator/submitter) cannot approve their own document — the action is disabled with a clear reason.
- Overridable only by an org owner/admin, and that override is recorded in the audit trail.

### 4. Approval hierarchy
- **Default (role-based):** users with owner/admin or a new `approver` capability can approve in one step.
- **Optional (named workflow):** a new Settings tab, *Approvals*, where per document type (Bill, Expense Claim, Expense) you define ordered steps — each step with a named approver (or role) and an amount band (e.g. up to 500,000 → Manager; above → Director).
- When a workflow exists and is active for a document type, the document routes through its steps; posting to the GL happens only after the final step approves. `approval_requests.current_step` tracks progress.

### 5. Approvals inbox
- A "Pending my approval" panel in the Purchases area listing everything awaiting the signed-in user, with amount, preparer, age and one-click approve/reject.

## Technical notes
- Database migration: add `approver` to the role/permission surface used for approvals; add posting-state columns where missing on `bills`/`expense_claims` (`prepared_by`, `approved_by`, `approved_at`, `posted_at`); add GRANTs + RLS on any new table; RLS on approval tables so only org members read and only eligible approvers act.
- New `src/lib/approvals/` module: `requestApproval`, `recordAction`, `resolveNextApprovers`, plus `postExpenseClaimToGL`.
- Reuse existing GL-safe patterns: edits after posting continue to reverse and re-post the linked journal entry.
- Files touched: `CreateBillDialog.tsx`, `EditBillDialog.tsx`, `ViewBillDialog.tsx`, `useBills.ts`, `useExpenses.ts`, `useExpenseClaims.ts`, expenses/claims dialogs, Purchases pages, plus new approval components and a Settings → Approvals tab.
