# EfinSuite Globe — Project Report

**Generated:** 2026-02-10  
**Published URL:** https://efinsuite.com  
**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Lovable Cloud (Supabase)

---

## 1. Executive Summary

EfinSuite Globe is a **full-featured, multi-tenant cloud accounting platform** built on Lovable Cloud. It provides a complete double-entry bookkeeping system with GAAP/IFRS/ASPE compliance, multi-currency support, global localization, and a wide range of financial modules spanning general ledger, accounts receivable/payable, payroll, banking, fixed assets, budgeting, inventory, and more. The platform targets small-to-medium businesses, accounting firms, and NPO/charity organizations across multiple jurisdictions.

---

## 2. Technology Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| UI Components | shadcn/ui (Radix primitives), Recharts, Framer Motion |
| State Management | TanStack React Query v5 |
| Routing | React Router v7 |
| Backend / Database | Lovable Cloud (PostgreSQL via Supabase) |
| Edge Functions | 34 Deno-based serverless functions |
| Auth | Email/password with email verification |
| PDF Generation | jspdf, pdf-lib, pdfjs-dist |
| Document Export | docx (Word), xlsx (Excel) |
| Communications | Twilio (Voice, SMS, WhatsApp), SendGrid, Mailchimp, ElevenLabs TTS |
| Payments | Stripe integration |
| Banking | Plaid integration |

---

## 3. Module Inventory

### 3.1 Core Accounting (General Ledger)
- **Chart of Accounts** — Hierarchical, multi-level with header/detail accounts, AI-powered CoA generator
- **Journal Entries** — Full double-entry with database-enforced balance validation (13 triggers)
- **General Ledger** — Account-level transaction history
- **Detailed Ledger** — Multi-dimensional forensic accounting with cost centers, projects, dimensions
- **Trial Balance** — As-of-date calculation with opening/period/closing columns
- **Fiscal Year Close** — Automated closing entries with CLOSE-* pattern, retained earnings rollforward

### 3.2 Financial Statements (GAAP/IFRS/ASPE Compliant)
- **Balance Sheet** — Hierarchical subtotals, contra account handling, comparative periods
- **Income Statement** — Revenue/COGS/OpEx/Other classification, multi-period comparison
- **Cash Flow Statement** — Indirect method with operating/investing/financing activities
- **Changes in Equity** — Retained earnings rollforward, ties to Balance Sheet
- **Consolidated Statements** — Multi-entity consolidation support
- **Management Reports** — Compilation engagement reports with PDF/Word export

### 3.3 Accounts Receivable
- **Customers** — Contact management with tax numbers
- **Invoices** — Full lifecycle (draft → sent → paid → void), PDF generation with branding
- **Quotes** — Quote-to-invoice conversion
- **Credit Notes** — Customer credit management
- **Recurring Invoices** — Automated billing cycles
- **Customer Payments** — Payment matching and application
- **Aging Reports** — AR aging analysis

### 3.4 Accounts Payable
- **Vendors** — Vendor management
- **Bills** — Purchase recording with multi-line items, tax calculation
- **Purchase Orders** — PO lifecycle management
- **Vendor Credits** — Credit application
- **Recurring Bills** — Automated recurring expenses
- **Expense Claims** — Employee expense submission and approval
- **Expenses** — Direct expense recording

### 3.5 Banking & Reconciliation
- **Bank Accounts** — Multi-account management with GL linking
- **Bank Transactions** — Import, categorize, match to GL
- **Transaction Rules** — AI-assisted auto-categorization rules
- **Bank Reconciliation** — Statement matching with history tracking
- **Credit Cards** — Dedicated credit card management with reconciliation
- **Plaid Integration** — Automated bank feed connection

### 3.6 Payroll (Canadian Localized + Global)
- **Employee Management** — Full HR profiles, onboarding workflow
- **Pay Runs** — Salary/hourly processing with automatic deduction calculation
- **Payroll Calculator** — CPP/EI/Federal/Provincial tax calculations (Canadian)
- **Global Payroll** — Localization engine supporting multiple countries
- **Timesheets** — Time tracking with approval workflow
- **Employee Self-Service** — Employee portal for pay stubs, tax slips
- **Pay Stubs** — PDF generation
- **Tax Slips** — T4/T4A generation (Canadian)
- **ROE Records** — Record of Employment (Canadian)
- **Remittances** — Government remittance tracking
- **Journal Posting** — Automatic GL integration with duplicate prevention

### 3.7 Sales Tax
- **Multi-jurisdiction Tax** — GST/HST/QST/PST with combined rates
- **Tax Calculation Engine** — Split tax calculator for Canadian provinces
- **Sales Tax Reporting** — Period-based tax filing support

### 3.8 Inventory
- **Product/Service Catalog** — Items with SKU, pricing, tax codes
- **Inventory Tracking** — Stock levels and movements
- **Inventory Adjustments** — Write-offs and corrections
- **Inventory Valuations** — Cost methods (FIFO, weighted average)

### 3.9 Fixed Assets
- **Asset Register** — Complete lifecycle tracking
- **Depreciation** — Multiple methods (straight-line, declining balance, etc.)
- **Disposals** — Sale/write-off with gain/loss calculation and GL posting
- **Revaluations** — Fair value adjustments with journal entries
- **Movements** — Location/department/custodian tracking
- **Audit Trail** — Full asset change history
- **AI Classification** — Automated asset categorization

### 3.10 Leases (IFRS 16 / ASC 842)
- **Lease Management** — Right-of-use asset and lease liability tracking
- **GL Integration** — Automated journal entries for lease accounting

### 3.11 Budgeting & Forecasting
- **Budget Masters** — Multi-type budgets (operating, capital, cash flow, project)
- **Budget Line Items** — 12-period detail with account linking
- **Budget Versions** — Version control and comparison
- **Budget Variance** — Actual vs. budget analysis
- **Production Budgets** — Manufacturing-specific budgets
- **AI Forecasting** — ML-powered budget predictions
- **Budget Hierarchy** — Multi-level consolidation (company → division → department)
- **Budget Approvals** — Workflow-based approval process

### 3.12 Donations (NPO/Charity — CRA Compliant)
- **Donation Management** — Donor tracking, receipt generation
- **ASNPO Compliance** — Accounting Standards for Not-for-Profit Organizations
- **Tax Receipts** — CRA-compliant charitable donation receipts

### 3.13 Document Management & E-Signatures
- **DocSign** — Document preparation, signing workflow
- **Public Signer Portal** — External signers can sign without login
- **PDF Embedding** — Signature embedding into documents
- **File Conversion** — Document format conversion via edge function

### 3.14 Communication Hub
- **Multi-channel** — Email (SendGrid/Mailchimp), SMS, WhatsApp, Voice
- **Twilio Integration** — Voice calls, SMS OTP, WhatsApp messaging
- **ElevenLabs TTS** — Text-to-speech for voice communications
- **Templates** — Reusable communication templates
- **Identity Management** — Sender identity configuration

### 3.15 Reports Centre
- All financial statements accessible from central hub
- Comparative period analysis (multi-year)
- Excel and PDF export for all reports
- Accountant dashboard with compilation tools
- Practice management dashboard

---

## 4. Database Architecture

### 4.1 Schema Overview
The database contains **60+ tables** spanning all modules. Key table groups:

| Group | Tables |
|-------|--------|
| Core GL | `accounts`, `journal_entries`, `journal_entry_lines`, `financial_periods` |
| AR | `customers`, `invoices`, `invoice_lines`, `invoice_taxes`, `customer_payments` |
| AP | `vendors`, `bills`, `bill_lines`, `bill_taxes`, `vendor_payments` |
| Banking | `bank_accounts`, `bank_transactions`, `bank_reconciliations`, `credit_cards` |
| Payroll | `employees`, `pay_runs`, `pay_run_lines`, `pay_run_deductions`, `timesheets` |
| Assets | `fixed_assets`, `asset_disposals`, `asset_revaluations`, `asset_movements` |
| Budget | `budget_masters`, `budget_line_items`, `budget_versions`, `budget_actuals` |
| Import | `import_batches`, `import_batch_rows`, `account_aliases`, `import_mapping_templates` |
| Admin | `organizations`, `user_profiles`, `user_roles`, `audit_logs` |
| Tax | `jurisdictions`, `tax_rates`, `countries` |

### 4.2 Double-Entry Integrity (Database-Level Enforcement)
The system enforces accounting integrity through **13 database triggers**:

1. **Balanced Entry Enforcement** — Rejects any journal entry where debits ≠ credits (0.001 tolerance)
2. **Posted Entry Protection** — Prevents modification of posted journal entry lines
3. **Account Validation** — Blocks posting to header or non-posting accounts
4. **Organization Validation** — Ensures account org matches entry org
5. **Auto Balance Recalculation** — Recalculates account balances on journal line changes
6. **Opening Balance Validation** — Ensures opening balances satisfy the accounting equation
7. **Reconciliation Protection** — Prevents modification of reconciled bank/CC transactions

### 4.3 Key Database Functions
- `recalculate_account_balance(account_id)` — Derives balance from opening + posted entries
- `recalculate_all_account_balances(org_id)` — Batch recalculation
- `validate_trial_balance(org_id)` — Balance verification
- `verify_trial_balance_integrity(org_id, date)` — Point-in-time integrity check

---

## 5. Edge Functions (34 Serverless Functions)

| Function | Purpose |
|----------|---------|
| `accounting-assistant` | AI-powered accounting help |
| `ai-coa-generator` | AI chart of accounts generation |
| `ai-asset-classify` | AI fixed asset classification |
| `ai-bank-connect` | AI banking connection |
| `ai-jurisdiction-setup` | AI jurisdiction configuration |
| `ai-rate-update` / `apply-rate-update` | Exchange/tax rate updates |
| `compose-ai-assistant` | Multi-model AI composition |
| `td1-ai-assist` | Canadian TD1 form assistance |
| `plaid-integration` | Bank feed connectivity |
| `stripe-integration` | Payment processing |
| `sendgrid-integration` | Email delivery |
| `resend-integration` | Email delivery (alternative) |
| `mailchimp-transactional` | Transactional email |
| `twilio-*` (8 functions) | Voice, SMS, WhatsApp, OTP |
| `elevenlabs-tts` | Text-to-speech |
| `voice-orchestrator` / `voice-transcribe` | Voice call management |
| `docsign-signer-portal` | E-signature portal |
| `embed-pdf-signatures` | PDF signature embedding |
| `file-convert` | Document conversion |
| `flatten-pdf` | PDF flattening |
| `pdf-to-spreadsheet` | PDF data extraction |
| `send-invitation` | User invitation emails |
| `send-sms-otp` | SMS verification |
| `admin-create-user` | Admin user provisioning |

---

## 6. Frontend Architecture

### 6.1 File Statistics
| Category | Count |
|----------|-------|
| Pages | 75+ |
| Custom Hooks | 110+ |
| Component Directories | 34 |
| Data/Config Files | 9 |
| Utility Libraries | 20+ |

### 6.2 Key Architectural Patterns
- **Multi-tenant** — `OrganizationProvider` context scopes all data to current organization
- **Auth Guard** — `ProtectedRoute` / `AuthRoute` wrappers with loading states
- **Admin RBAC** — `AdminRoute` component with role-based access control
- **Report Filters** — `ReportFiltersProvider` for consistent date/period filtering across reports
- **Module System** — `useEnabledModules` hook controls feature visibility per organization
- **NPO Detection** — Automatic ASNPO compliance for NPO/charity/religious organizations

### 6.3 Design System
- shadcn/ui components with Tailwind CSS semantic tokens
- HSL-based color system with dark mode support
- Consistent layout via `AppLayout` component with sidebar navigation

---

## 7. Security & Compliance

### 7.1 Authentication
- Email/password with email verification (no auto-confirm)
- Password reset flow via email
- SMS OTP for additional verification
- User invitation system with secure accept flow

### 7.2 Authorization
- Row-Level Security (RLS) policies on all tables
- Organization-scoped data isolation
- RBAC permission system (admin, manager, accountant, viewer roles)
- Admin-only routes and operations

### 7.3 Audit Trail
- `audit_logs` table tracking all entity changes
- `asset_audit_trail` for fixed asset changes
- `budget_audit_logs` for budget modifications
- `import_audit_logs` for import operations
- Immutable posted entries (reversals only)

### 7.4 Accounting Compliance
- GAAP / IFRS / ASPE compliant financial statements
- CRA-compliant payroll (Canadian)
- ASNPO-compliant for NPO organizations
- Double-entry enforcement at database level
- Fiscal year closing with proper retained earnings rollforward

---

## 8. Integrations

| Integration | Purpose | Type |
|-------------|---------|------|
| Plaid | Bank feeds | Edge Function |
| Stripe | Payment processing | Edge Function |
| Twilio | Voice, SMS, WhatsApp | Edge Functions (8) |
| SendGrid | Email delivery | Edge Function |
| Mailchimp | Transactional email | Edge Function |
| ElevenLabs | Text-to-speech | Edge Function |
| Lovable AI | AI features (CoA gen, forecasting, classification) | Built-in |

---

## 9. Export & Reporting Capabilities

| Format | Use Cases |
|--------|-----------|
| PDF | Invoices, pay stubs, T4 tax slips, ROE, reconciliation reports, compilation reports, financial statements |
| Excel (XLSX) | Trial balance, detailed ledger, financial statements, payroll reports |
| Word (DOCX) | Compilation engagement reports |
| Barcode | Invoice/document barcodes (JsBarcode) |

---

## 10. Import Engine

A comprehensive data migration system supporting:
- **Formats:** CSV, XLS, XLSX with auto-detection
- **Sources:** QuickBooks, Sage, Xero, SAP, Oracle, Dynamics, FreshBooks, Wave, Zoho, Custom
- **Features:** Dynamic column mapping, COA matching (exact/alias/fuzzy/manual), multi-currency/FX, debit/credit normalization, validation engine, two posting modes, rollback capability
- **Workflow:** Draft → Validating → Validated → Posting → Posted

---

## 11. Localization

### 11.1 Multi-Currency
- Organization base currency with transaction-level currency support
- Exchange rates (manual and AI-assisted updates)
- Multi-currency financial reporting

### 11.2 Multi-Jurisdiction Tax
- Canadian provinces: GST, HST, QST, PST with combined rates
- Tax code management with recoverable/non-recoverable classification
- Jurisdiction-aware transaction processing

### 11.3 Payroll Localization
- Canadian payroll: CPP, EI, Federal/Provincial tax tables
- Global payroll defaults for multiple countries
- Country-specific banking institution data

---

## 12. Project Statistics Summary

| Metric | Value |
|--------|-------|
| Total Pages | 75+ |
| Custom React Hooks | 110+ |
| Edge Functions | 34 |
| Database Tables | 60+ |
| Database Triggers | 13+ |
| Component Directories | 34 |
| External Integrations | 7 |
| Supported Industries | 10+ (including NPO, charity, religious) |
| Export Formats | 4 (PDF, Excel, Word, Barcode) |
| Import Sources | 10+ |

---

## 13. Key Design Decisions

1. **Database-level integrity** — Accounting rules enforced via PostgreSQL triggers, not application code
2. **Multi-tenant from day one** — Organization-scoped RLS on all tables
3. **GAAP-first financial statements** — All reports follow standard accounting formulas with closing entry exclusion logic
4. **Modular architecture** — Feature flags per organization via module system
5. **AI-augmented** — AI assists with CoA generation, asset classification, forecasting, and bank categorization without replacing manual control
6. **Comprehensive audit trail** — Every financial change is traceable

---

*End of Report*
