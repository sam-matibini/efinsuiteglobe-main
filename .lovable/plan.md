# Attachments + AI Analyzer for Purchases Module

Extend the same "attach documents + Analyze with AI" pattern already working on Journal Entries to the entire Purchases domain: **Expense Claims, Direct Expenses, Bills, Purchase Orders, and Vendors**.

## What the user gets

On every purchase record's edit/view dialog:
1. **Attachments panel** — drag-and-drop or browse; upload receipts, invoices, PDFs, images (up to 20MB each). Preview, download, delete.
2. **Analyze with AI** button — reads all attachments, extracts vendor, date, currency, subtotal, tax breakdown, total, line items, and returns:
   - **Financial Summary card** with reconciliation badge (Matches / Minor Variance / Mismatch) vs the record's own totals.
   - **Narrative summary**.
   - **Append to Notes** / **Replace Notes** actions.
3. On **new records**, AI extraction can auto-populate fields (vendor, date, amount, tax, description) — same UX already shipping on Expense Claims via `useAnalyzeReceipt`.

## Scope by module

| Module | Attachments | AI Analyzer | Auto-populate on create |
|---|---|---|---|
| Expense Claims | ✅ new panel on claim (in addition to per-line receipts) | ✅ | already exists per line |
| Direct Expenses (`expenses`) | ✅ | ✅ | ✅ |
| Bills | ✅ | ✅ | ✅ |
| Purchase Orders | ✅ | ✅ (quote/vendor confirmations) | ✅ |
| Vendors | ✅ (W-9, contracts, COI, banking letters) | ✅ (extract vendor profile: legal name, tax ID, address, banking) | ✅ vendor profile fields |

## Technical design

### Database (single migration)
One polymorphic attachments table, mirroring `journal_entry_attachments`:

```
public.purchase_attachments
  id, organization_id, entity_type, entity_id,
  file_name, file_path, mime_type, file_size,
  description, uploaded_by, created_at
```
`entity_type` ∈ `expense_claim | expense | bill | purchase_order | vendor`.
Index on `(entity_type, entity_id)`. RLS: org members read/write within their org; service_role full.

### Storage
Reuse a single private bucket `purchase-attachments` with path `{organization_id}/{entity_type}/{entity_id}/{uuid}-{name}`. RLS on `storage.objects` scoped to org membership.

### Frontend
- New hook `usePurchaseAttachments(entityType, entityId)` — generalized version of `useJournalAttachments`.
- New component `PurchaseAttachmentsSection` — generalized `JournalAttachmentsSection` accepting `entityType` + `entityId`.
- New component `PurchaseAIAnalyzer` — generalized `JournalAIAnalyzer`; passes record totals for reconciliation.
- Mount both in: `EditExpenseClaimDialog`, `RecordExpenseDialog` / expense edit, `EditBillDialog` / view, `EditPurchaseOrderDialog` / view, `EditVendorDialog` / vendor details.

### Edge function
One new function `analyze-purchase-attachments` (adapted from `analyze-je-attachments`):
- Input: `{ entityType, entityId }`.
- Fetches attachments from `purchase_attachments`, downloads via signed URLs, sends multimodal request to `google/gemini-2.5-flash` through Lovable AI Gateway.
- Returns structured JSON (vendor, date, currency, subtotal, tax breakdown, total, line items, category suggestion) + narrative + reconciliation vs the entity's own totals.
- Manual JWT verification; `verify_jwt = false` in config.
- For **vendors**, the schema also returns legal name, tax ID (BN/EIN/VAT), address, contact, banking (routing/account/IBAN) for one-click profile fill.

### Auto-populate on create
Reuse existing `useAnalyzeReceipt` pattern (already handles PDF/image → structured data) for Bill/Expense/PO/Vendor create dialogs — add an "Upload & scan" button that pre-fills the form before insert. No new backend needed for this path.

## Out of scope
- No changes to existing per-line `receipt_url` on expense claim lines (kept for backward compatibility).
- No batch re-analysis of historical records.
- No changes to GL posting logic.

## Rollout order
1. Migration + bucket + RLS.
2. Shared hook + components.
3. Edge function.
4. Wire into the five dialogs (parallel edits).
5. Auto-populate on create dialogs.
