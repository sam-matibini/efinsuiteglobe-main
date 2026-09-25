# Memory: features/import-engine
Updated: 2026-01-19

## Trial Balance & Opening Balance Import Engine

A comprehensive import system for migrating data from external accounting systems supporting:
- Trial balance imports (period-based, year-end, adjustment, consolidated)
- Prior-year opening balance imports

### Database Schema
- `import_batches` - Tracks import sessions with status workflow (draft → validating → validated → posting → posted)
- `import_batch_rows` - Individual line items with account matching and validation
- `account_aliases` - Legacy code mapping for migration from different systems
- `import_mapping_templates` - Reusable column mapping configurations
- `import_audit_logs` - Full audit trail for compliance

### Key Features
1. **Multi-format Support**: CSV, XLS, XLSX with auto-detection
2. **Dynamic Column Mapping**: Flexible mapping with templates
3. **COA Matching Engine**: Exact, alias, fuzzy, and manual matching
4. **Multi-currency/FX**: Source, system, or manual exchange rates
5. **Debit/Credit Normalization**: Separate columns or single balance
6. **Validation Engine**: Pre-posting checks for balance, accounts, currencies
7. **Two Posting Modes**: Opening balance (direct) or journal entry
8. **Rollback Capability**: Full reversal with audit trail

### Hooks
- `useImportBatches` - CRUD for import batches
- `useImportBatchRows` - Manage import rows
- `useAccountMatching` - COA matching logic
- `useAccountAliases` - Legacy code mappings
- `useImportMappingTemplates` - Saved column mappings
- `useImportPosting` - Post/reverse imports

### Supported Source Systems
QuickBooks, Sage, Xero, SAP, Oracle, Dynamics, FreshBooks, Wave, Zoho, Custom
