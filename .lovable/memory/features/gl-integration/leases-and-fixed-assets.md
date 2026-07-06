---
name: leases-and-fixed-assets-gl-integration
description: Fixed asset acquisitions and lease commencements must post journal entries so TB/BS/IS reflect them
type: feature
---

Financial reports (Trial Balance, Income Statement, Balance Sheet) read ONLY from `journal_entry_lines` joined to `journal_entries` where `status IN ('posted','reversed')`. They do NOT read `fixed_assets` or `leases` tables directly. Therefore:

1. **Fixed Asset creation** (`useCreateFixedAsset` in `src/hooks/useFixedAssets.ts`) posts a JE `FA-ACQ-{asset_number}`: DR `asset_account_id`, CR `offset_account_id`, only when both accounts and a positive cost are provided. The resulting JE id is stored on `fixed_assets.acquisition_journal_id`. The `AddFixedAssetDialogEnhanced` requires `asset_account_id` and `offset_account_id` (Cash/Bank/AP/Opening Balance Equity) before submit.

2. **Lease creation** (`useCreateLease` in `src/hooks/useLeases.ts`) posts a JE `LEASE-COMM-{lease_number}`: DR `rou_asset_account_id` = `rou_asset_initial`, CR `lease_liability_account_id` = `present_value_payments`. Skipped with a warning toast when `rou_asset_initial ≠ present_value_payments` (IDCs/incentives require a manual offset). The JE id is stored on `leases.commencement_journal_id`. `AddLeaseDialog` requires both ROU and Liability accounts before create.

3. **Periodic postings** (`RunAmortizationDialog` for assets, `useBatchLeasePaymentPosting` for leases) already existed and still handle depreciation and payment JEs — they depend on the depreciation expense / accumulated depreciation / interest expense accounts being mapped on each row.

Never add reporting paths that read `fixed_assets.book_value` or `leases.lease_liability_current` directly for financial statements — always go through the GL.
