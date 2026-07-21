## Goal
Ensure every delete action across the app requires an explicit confirmation dialog before it fires.

## Approach

### 1. Add a shared `ConfirmDeleteDialog` component
Create `src/components/ui/confirm-delete-dialog.tsx` wrapping shadcn's `AlertDialog`. Props:
- `open`, `onOpenChange`
- `title` (default: "Delete this item?")
- `description` (default: "This action cannot be undone.")
- `itemName` (optional — shown in bold in the description)
- `confirmLabel` (default: "Delete"), `cancelLabel` (default: "Cancel")
- `onConfirm` (async supported; shows a loading state and disables buttons while pending)
- `destructive` styling on the confirm button (uses `bg-destructive` token)

This becomes the single canonical confirm-delete UI so we don't reinvent it per page.

### 2. Audit & wire it into every delete trigger
There are ~50 files with delete handlers. For each, either:
- **A.** Wrap the existing delete button in the new `ConfirmDeleteDialog` (typical row-action button that currently calls `handleDelete` directly), or
- **B.** Leave alone if it already has a proper confirm step (e.g. `DeleteOrganizationDialog`, `DeleteAssetDialog`, `DeleteEmployeeDialog`, `DeleteDocumentDialog`, `BulkDeleteDialog`, `TrialBalanceImportHistoryDialog`, and any existing `AlertDialog`-based flow).

Only unprotected delete calls get the new dialog — existing confirmations are kept as-is (no visual churn on flows the user already reviewed).

### 3. Files in scope (grouped)
Admin & subscriptions: `AdminSubscriptions.tsx`, `AdminOrganizations.tsx`, `AdminSettings.tsx`, `DiscountsTab.tsx`.
Settings: `UsersSettingsTab.tsx`, `InvoiceCustomFieldsSettings.tsx`, `Settings.tsx`.
Accounting: `JournalEntries.tsx`, `Invoices.tsx`, `Customers.tsx`, `ProductsServices.tsx`, `Expenses.tsx`, `Donations.tsx`, `BankAccounts.tsx`, `CreditCards.tsx`, `FixedAssets.tsx`, `Divisions.tsx`, `AllocationRules.tsx`, `SalesTax.tsx`, `TransactionRules.tsx`, `Budgets.tsx`, `SettlementReconciliation.tsx`, `TaxSlips.tsx`, `RoeRecords.tsx`, `TaxEFile.tsx`, `AccountantDashboard.tsx`, `DbAccountTree.tsx`.
Payroll: `PayRuns.tsx`, `EmployeesList.tsx`, `EmployeeTimesheets.tsx`, `TimesheetDetail.tsx`, `Employees.tsx`.
Treasury: `TaxPayments.tsx`, `PaymentLinks.tsx`, `ApprovalRules.tsx`.
Banking / import: `TransactionRulesPanel.tsx`, `TemplateManagementPanel.tsx` (banking), `ImportHistoryDialog.tsx`.
Communication: `SenderManagement.tsx`, `TemplateManagementPanel.tsx` (comm), `ContactsPanel.tsx`, `CommunicationHistoryPanel.tsx`.
Invoices / DocSign / Inventory / Practice / Dashboard: `InvoiceDetailPanel.tsx`, `SigningWorkflow.tsx`, `AnchoredField.tsx`, `DocumentEditor.tsx`, `DocSign.tsx`, `EditInventoryItemDialog.tsx`, `PMEngagementStaffTab.tsx`, `PMBillingTab.tsx`, `AISheets.tsx`.

For each file, the change pattern is: track a `pendingDelete` state (usually the row id / object), swap the direct-delete `onClick` for `setPendingDelete(item)`, and render one `<ConfirmDeleteDialog>` at the bottom of the component that calls the existing delete handler on confirm.

### 4. Scope note
This is a large sweep touching ~40+ files. To keep it reviewable, I'll implement it in one pass and rely on the existing build/typecheck to catch regressions — no behavior changes beyond adding the confirm step. If you'd rather I split it (e.g. Admin+Settings first, then accounting, then the rest), say the word.

## Technical Details

- The dialog uses `AlertDialog` from `src/components/ui/alert-dialog.tsx` so keyboard/escape/focus-trap behavior comes free.
- `onConfirm` accepts `() => void | Promise<void>`; while the promise is pending, both buttons are disabled and the confirm button shows a spinner via `Loader2`.
- No changes to any delete business logic, mutations, or edge functions — purely a UI guard layer.
- Existing custom delete dialogs are left in place to avoid regressing flows that already have richer confirmation (e.g. typing an org name).
