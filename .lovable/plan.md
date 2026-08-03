# Attach & analyze invoices inside every purchases form

Today attachments exist only *after* a record is saved: the `Attach / Analyze Documents` dialog is opened from the row menu on Bills, Purchase Orders, Expenses, Expense Claims and Vendors, and `PurchaseAttachmentsSection` shows "Save this record first…" when there is no record id. This plan brings attach + AI analysis *into* the forms themselves, with auto-fill.

## What the user gets

1. An **Attachments** panel inside every purchases create/edit form (Bill, Edit Bill, View Bill read-only, Purchase Order, Recurring Bill, Vendor Credit, Expense Claim, Record/Edit Expense, Add/Edit Vendor).
2. Files can be dropped **before** the record is saved — they are held in the form and uploaded automatically once the record is created.
3. An **Analyze invoice** button: the AI reads the attached invoice/receipt and returns vendor, invoice number, date, due date/terms, currency, subtotal, tax, total and line items.
4. A review step: extracted values are shown side-by-side with the current form values; the user clicks **Apply** (all, or per field) before anything changes. Nothing is written silently.
5. A **document summary** stored in the record notes (same behaviour that exists today for saved records).

## Flow

```text
Create Bill form
  ├─ drop invoice.pdf ────────► staged in memory (not yet uploaded)
  ├─ "Analyze invoice" ───────► edge fn reads the staged file
  │                             returns {header, totals, lines[]}
  ├─ review sheet ────────────► Apply → form fields + line items filled
  └─ Save ────────────────────► bill created → staged files uploaded
                                to purchase-attachments + rows inserted
```

## Technical details

**New shared piece — `src/components/purchases/PurchaseAttachmentsField.tsx`**
Wraps the existing `PurchaseAttachmentsSection` and adds a *staged* mode: when `entityId` is null it keeps `File[]` in local state with previews and remove buttons, instead of showing the "save first" hint. Exposes the staged list plus a `flush(entityId, organizationId)` helper that uploads via the existing `useUploadPurchaseAttachment` mutation. Saved records keep today's behaviour unchanged.

**New hook — `src/hooks/useStagedPurchaseAttachments.ts`**
Holds staged files, validates type/size against the current `ACCEPT` / 20 MB limits, and performs the post-save upload with a toast on partial failure (record is already saved; a failed upload does not roll it back).

**Edge function — extend `analyze-purchase-attachments`**
Currently it requires `entityType` + `entityId`, loads the record from the DB for context, and returns `{summary, financial_summary}`. Add a second input mode:
- `mode: 'draft'` with inline base64 files (same 5-file / 20 MB caps already enforced) and no `entityId`;
- an extended response `extraction: { vendor_name, document_number, document_date, due_date, terms, currency, subtotal, tax_total, grand_total, lines: [{description, quantity, unit_price, tax_rate}] }`.
Keeps `google/gemini-2.5-flash` and the existing auth/org checks; org id comes from the caller's membership instead of the record when in draft mode. Loose JSON schema, parsed defensively, so a partial extraction still returns what it found.

**New component — `src/components/purchases/InvoiceExtractionReview.tsx`**
Dialog listing each extracted field vs the current form value, with per-row checkboxes and "Apply selected". Vendor name is matched against `useVendors` by fuzzy name; if no match, the user is prompted to pick a vendor manually (no vendor is auto-created). GL accounts are never guessed — extracted lines land with an empty Account cell that the user must fill, preserving the existing `expense_account_id` validation.

**Form wiring (each form gets the panel + apply handler):**
- `bills/CreateBillDialog.tsx`, `bills/EditBillDialog.tsx` — full extraction incl. line items; applying a date recomputes the due date through the existing `computeDueDate`/terms logic.
- `bills/ViewBillDialog.tsx` — attachments list, read-only.
- `purchases/CreatePurchaseOrderDialog.tsx`, `CreateRecurringBillDialog.tsx`, `CreateVendorCreditDialog.tsx`, `CreateExpenseClaimDialog.tsx`
- `expenses/RecordExpenseDialog.tsx` / `RecordExpenseTab.tsx`, `expenses/EditExpenseDialog.tsx`, `expenses/ExpenseDetailsDialog.tsx` (read-only)
- `vendors/AddVendorDialog.tsx` — attachments only (contracts, W-9/TIN docs), no auto-fill of financial lines.

**Storage / DB:** no schema change. Reuses the `purchase-attachments` bucket, the `purchase_attachments` table, and its existing RLS. `entity_type` values already cover bill / purchase_order / expense / expense_claim / vendor; recurring bills and vendor credits will be stored under the closest existing type with the record id, so nothing new is granted.

## Out of scope
- Auto-creating vendors or GL accounts from an invoice.
- Bulk "inbox" ingestion of emailed invoices.
- OCR of handwritten receipts beyond what the current model already handles.
