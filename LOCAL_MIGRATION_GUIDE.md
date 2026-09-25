# efinsuite Globe — Local Migration Guide

> **Target audience:** Senior developer taking over this codebase outside of Lovable.  
> **Last updated:** 2026-03-04

---

## Table of Contents

1. [Tech Stack Overview](#1-tech-stack-overview)
2. [Local Setup Instructions](#2-local-setup-instructions)
3. [Environment Variables](#3-environment-variables)
4. [Supabase Architecture](#4-supabase-architecture)
5. [Supabase Edge Functions](#5-supabase-edge-functions)
6. [External APIs & Third-Party Services](#6-external-apis--third-party-services)
7. [Lovable-Specific Code to Remove/Refactor](#7-lovable-specific-code-to-removerefactor)

---

## 1. Tech Stack Overview

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Framework** | React | ^18.3.1 | SPA, no SSR |
| **Build tool** | Vite | ^5.4.19 | With SWC plugin (`@vitejs/plugin-react-swc`) |
| **Language** | TypeScript | ^5.8.3 | Strict mode OFF (`strict: false` in tsconfig) |
| **Routing** | react-router-dom | 7.1.1 | `<BrowserRouter>` with `<Routes>`/`<Route>` |
| **Styling** | Tailwind CSS | ^3.4.17 | + `tailwindcss-animate`, `@tailwindcss/typography` |
| **Component library** | shadcn/ui | N/A (vendored) | Components live in `src/components/ui/` |
| **State management** | TanStack React Query | ^5.83.0 | For server state; React `useState`/`useContext` for local state |
| **Forms** | react-hook-form + zod | ^7.61.1 / ^3.25.76 | With `@hookform/resolvers` |
| **Backend** | Supabase | ^2.90.1 | Auth, Postgres, Storage, Edge Functions (Deno) |
| **PWA** | vite-plugin-pwa | ^1.2.0 | InjectManifest strategy with custom `sw.js` |
| **Charts** | Recharts | ^2.15.4 | |
| **PDF** | pdf-lib, pdfjs-dist, jspdf | Various | Generation, parsing, flattening |
| **Excel** | xlsx (SheetJS) | ^0.18.5 | Import/export spreadsheets |
| **Voice/Telephony** | @twilio/voice-sdk | ^2.18.0 | Browser-based VOIP calling |
| **Banking** | react-plaid-link | ^4.1.1 | Plaid Link integration |

### Path Aliases

`@/` maps to `./src/` (configured in `tsconfig.json` and `vite.config.ts`).

---

## 2. Local Setup Instructions

### Prerequisites

- **Node.js** ≥ 18 (LTS recommended)
- **npm** or **bun** (project includes `bun.lockb`; either works)
- **Supabase CLI** (`npm install -g supabase`) — for edge functions
- A Supabase project (existing or new)

### Steps

```bash
# 1. Clone the repository
git clone <your-repo-url> efinsuite-globe
cd efinsuite-globe

# 2. Install dependencies
npm install
# or: bun install

# 3. Create your .env file (see Section 3 below)
cp .env.example .env   # then fill in values

# 4. Start the dev server
npm run dev
# App runs at http://localhost:8080

# 5. (Optional) Build for production
npm run build          # outputs to dist/
npm run preview        # preview the production build
```

### Supabase Local Development

```bash
# Link to your Supabase project
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>

# Run migrations
supabase db push

# Serve edge functions locally
supabase functions serve --env-file ./supabase/.env.local

# Deploy edge functions to production
supabase functions deploy <function-name>
# Or deploy all:
supabase functions deploy
```

---

## 3. Environment Variables

Create a `.env` file in the project root. **All client-side variables must be prefixed with `VITE_`.**

### Client-Side (Vite — exposed to browser)

```env
# ── Supabase Connection ──────────────────────────────────
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
VITE_SUPABASE_PROJECT_ID=<project-ref>

# ── App Configuration ────────────────────────────────────
VITE_PUBLIC_APP_URL=https://yourdomain.com   # Used for DocSign signing links
```

### Server-Side (Supabase Edge Functions — Deno runtime)

These are set as **Supabase secrets** (not in `.env`). Set them via:

```bash
supabase secrets set KEY=value
```

| Variable | Description | Used By |
|----------|-------------|---------|
| `SUPABASE_URL` | Auto-provided by Supabase runtime | All edge functions |
| `SUPABASE_ANON_KEY` | Auto-provided by Supabase runtime | All edge functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided by Supabase runtime | All edge functions (admin ops) |
| `LOVABLE_API_KEY` | Lovable AI proxy key — **must be replaced** (see Section 7) | `accounting-assistant`, `ai-coa-generator`, `ai-rate-update`, `ai-jurisdiction-setup`, `ai-asset-classify`, `alice-sheets-assistant`, `compose-ai-assistant`, `td1-ai-assist` |
| `SENDGRID_API_KEY` | SendGrid email delivery | `sendgrid-integration`, `sendgrid-inbound-webhook` |
| `MAILCHIMP_TRANSACTIONAL_API_KEY` | Mandrill/Mailchimp transactional email | `mailchimp-transactional` |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | All Twilio functions |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | `twilio-webhook`, `twilio-voice` |
| `TWILIO_API_KEY_SID` | Twilio API key (SK…) | `twilio-voice-token` |
| `TWILIO_API_KEY_SECRET` | Twilio API key secret | `twilio-voice-token` |
| `TWILIO_TWIML_APP_SID` | TwiML App SID (AP…) | `twilio-twiml-app`, `twilio-voice-token`, `twilio-inbound-voice` |
| `TWILIO_PHONE_NUMBER` | Twilio phone number (+17789020442) | `twilio-send-message`, `twilio-twiml-app`, `twilio-inbound-voice` |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp sandbox number | `twilio-send-message` |
| `PLAID_CLIENT_ID` | Plaid API client ID | `ai-bank-connect`, `plaid-integration` |
| `PLAID_SECRET` | Plaid API secret | `ai-bank-connect`, `plaid-integration` |
| `PLAID_ENVIRONMENT` | `sandbox` / `development` / `production` | `ai-bank-connect`, `plaid-integration` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `stripe-integration`, `collect-invoice-payment` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `stripe-webhook` |
| `ELEVENLABS_API_KEY` | ElevenLabs text-to-speech | `elevenlabs-tts` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API (if used directly) | Various AI functions |

---

## 4. Supabase Architecture

### 4.1 Database Tables

The project has **100+ tables**. Below are the major table groups organized by module:

#### Core / Multi-Tenant

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant org container; nearly every table has `organization_id` FK |
| `organization_members` | Maps users to organizations with roles |
| `profiles` | User profile data (mirrors `auth.users` with additional fields) |
| `user_roles` | RBAC role assignments (enum: `admin`, `moderator`, `subscriber`, `user`, `super_admin`) |
| `audit_logs` | System-wide audit trail |
| `onboarding_tasks` | User onboarding checklist |
| `user_signatures` | Stored signature images for DocSign |

#### Chart of Accounts & General Ledger

| Table | Purpose |
|-------|---------|
| `accounts` | Chart of accounts (hierarchical via `parent_id`) |
| `account_aliases` | Alternate codes/names for accounts |
| `journal_entries` | GL journal entry headers |
| `journal_entry_lines` | Individual debit/credit lines |
| `coa_templates` / `coa_template_accounts` | Pre-built chart of accounts templates |
| `cca_classes` | Capital Cost Allowance classes (Canadian tax) |

#### Banking

| Table | Purpose |
|-------|---------|
| `bank_accounts` | Bank account records with optional Plaid connection |
| `bank_transactions` | Imported/manual bank transactions |
| `bank_reconciliations` | Reconciliation sessions |

#### Sales (AR)

| Table | Purpose |
|-------|---------|
| `customers` | Customer master data |
| `invoices` / `invoice_lines` | Sales invoices |
| `credit_notes` / `credit_note_lines` | Customer credit notes |
| `quotes` / `quote_lines` | Sales quotes |
| `payments` | Customer payment records |
| `recurring_invoices` / `recurring_invoice_lines` | Auto-generating invoices |
| `products_services` | Product/service catalog |

#### Purchases (AP)

| Table | Purpose |
|-------|---------|
| `vendors` | Vendor master data |
| `bills` / `bill_lines` / `bill_taxes` | Purchase bills |
| `purchase_orders` / `purchase_order_lines` | Purchase orders |
| `vendor_credits` / `vendor_credit_lines` | Vendor credit notes |
| `expense_claims` / `expense_claim_lines` | Employee expense claims |

#### Payroll (Canadian)

| Table | Purpose |
|-------|---------|
| `employees` | Employee master records |
| `employee_td1` | TD1 tax declaration forms |
| `pay_runs` / `pay_stubs` | Payroll processing |
| `tax_slips` | T4/T4A/RL-1 generation |
| `roe_records` | Record of Employment |
| `remittances` | CRA/RQ remittance tracking |
| `payroll_settings` | Organization payroll config |

#### Fixed Assets

| Table | Purpose |
|-------|---------|
| `fixed_assets` | Asset register |
| `asset_disposals` | Asset disposal records |
| `asset_movements` | Location/custody transfers |
| `asset_revaluations` | Revaluation journal |
| `asset_audit_trail` | Asset change history |
| `depreciation_entries` | Calculated depreciation |

#### Budgeting

| Table | Purpose |
|-------|---------|
| `budget_masters` | Budget headers (annual/multi-year) |
| `budget_line_items` | Period-by-period budget amounts |
| `budget_versions` | Version control for budgets |
| `budget_actuals` | Actual vs. budget snapshots |
| `budget_ai_forecasts` | AI-generated forecasts |
| `budget_drivers` / `budget_assumptions` | Driver-based budgeting |
| `budget_hierarchy` | Consolidation hierarchy |
| `budget_approvals` / `budget_audit_logs` | Approval workflow & audit |

#### DocSign (Document Signing)

| Table | Purpose |
|-------|---------|
| `documents` | Uploaded documents for signing |
| `document_fields` | Signature/initial field placements |
| `document_signers` | External signer records with tokens |

#### Communication

| Table | Purpose |
|-------|---------|
| `messages` | SMS/WhatsApp/Email message log |
| `communication_contacts` | Contact book |
| `communication_senders` | Sender identities |
| `communication_templates` | Message templates |
| `communication_identity` / `communication_identity_channels` | Org identity config |
| `voice_calls` / `voice_call_recordings` | Call records |
| `voice_wallets` / `voice_wallet_transactions` | Prepaid voice credit |
| `voice_rates` | Per-country voice rates |

#### Donations (Non-Profit / T3010)

| Table | Purpose |
|-------|---------|
| `donors` | Donor records |
| `donations` | Donation transactions |
| `donation_receipts` | Official tax receipts |
| `pledges` / `pledge_payments` | Pledge tracking |
| `fundraising_campaigns` | Campaign management |

#### Tax & Jurisdiction

| Table | Purpose |
|-------|---------|
| `jurisdictions` | Tax jurisdictions |
| `tax_rates` | GST/HST/PST rates |
| `tax_settings` | Per-org tax config |
| `countries` | Country reference data |

#### Practice Management

| Table | Purpose |
|-------|---------|
| `pm_clients` / `pm_engagements` | Accounting firm clients |
| `pm_staff` / `pm_time_entries` | Staff time tracking |
| `pm_invoices` / `pm_invoice_lines` | Client billing |
| `pm_tasks` / `pm_task_assignments` | Task management |
| `pm_timesheets` / `pm_timesheet_entries` | Timesheet approval |

#### Inventory

| Table | Purpose |
|-------|---------|
| `inventory_items` / `inventory_transactions` | Stock tracking |
| `inventory_locations` / `inventory_categories` | Warehousing |

#### Approvals

| Table | Purpose |
|-------|---------|
| `approval_workflows` / `approval_workflow_steps` | Configurable approval chains |
| `approval_requests` / `approval_actions` | Document approval tracking |

#### AI Features

| Table | Purpose |
|-------|---------|
| `ai_setup_logs` | AI-assisted setup audit trail |
| `ai_sheets_conversations` | AI Sheets chat history |

#### Subscriptions & Billing

| Table | Purpose |
|-------|---------|
| `subscription_plans` / `subscriptions` | Stripe-based SaaS subscriptions |

#### Compilation Reports

| Table | Purpose |
|-------|---------|
| `compilation_reports` / `compilation_report_versions` | Accountant compilation reports |
| `compilation_audit_trail` | Change tracking |

### 4.2 Database Views

| View | Purpose |
|------|---------|
| `detailed_ledger_view` | Joins journal entries with lines for ledger reports |
| `combined_tax_rates` | Aggregated tax rates by jurisdiction |

### 4.3 Database Functions (RPCs)

| Function | Purpose |
|----------|---------|
| `has_role(_user_id, _role)` | SECURITY DEFINER — checks `user_roles` table without RLS recursion |
| `is_org_member(_user_id, _org_id)` | Checks organization membership |

### 4.4 Database Enums

Key custom enums (see full list in `src/integrations/supabase/types.ts` → `Constants.public.Enums`):

- `account_type`: asset, liability, equity, income, expense
- `app_role`: admin, moderator, subscriber, user, super_admin
- `employee_status`, `employment_type`, `pay_frequency`, `pay_run_status`
- `journal_entry_status`, `journal_type`
- `message_channel`, `message_direction`, `message_status`
- `donation_type`, `donation_status`, `donor_type`
- `equity_type`, `fund_type`, `province_code`
- `module_type`, `task_status`, `task_priority`
- And many more — see the types file for the complete list.

### 4.5 Storage Buckets

| Bucket | Purpose | Public? | Notes |
|--------|---------|---------|-------|
| `docsign-documents` | DocSign PDFs (original, signed, finalized), AI file uploads | **Yes** (public URLs) | Used by `file-convert`, `pdf-to-spreadsheet`, `embed-pdf-signatures`, `finalize-document` |
| `documents` | Shared invoice PDFs, credit note PDFs, compilation reports | **Yes** (public URLs) | Used by `InvoiceShareDialog`, `finalize-document` for certificates |
| `organization-logos` | Organization logo uploads | **Yes** (public URLs) | Used by `OrganizationLogoUpload` component |

**CORS Configuration** (apply to all buckets):

```json
{
  "AllowedOrigins": ["*"],
  "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}
```

### 4.6 Row Level Security (RLS)

**Core principles:**

1. **Multi-tenant isolation**: Most tables restrict access via `organization_id` using `is_org_member(auth.uid(), organization_id)`.
2. **No permissive `USING(true)`**: All policies require authenticated users with verified org membership.
3. **Admin operations**: Use `has_role(auth.uid(), 'admin')` — a `SECURITY DEFINER` function that bypasses RLS to check the `user_roles` table.
4. **Reference data** (e.g., `cca_classes`, `voice_rates`, `countries`): Read-only for authenticated members; write restricted to admins.
5. **Payroll tables**: Extra-restricted — only org members with appropriate roles.
6. **DocSign**: `document_fields` access is restricted to document owners or signers with valid tokens; the `docsign-signer-portal` edge function uses the service role key to bypass RLS for external signers.

**Important**: If you add new tables, always add RLS policies following these patterns. Never expose data cross-tenant.

### 4.7 Realtime

Tables with realtime enabled (via `supabase_realtime` publication):
- `messages` — for live chat/SMS/WhatsApp updates

---

## 5. Supabase Edge Functions

All edge functions live in `supabase/functions/<name>/index.ts` and run on **Deno**.

> **JWT verification** is disabled for all functions (`verify_jwt = false` in `config.toml`). Functions handle auth internally by reading the `Authorization` header and verifying via `supabase.auth.getUser()`.

### Complete Function Reference

#### AI & Intelligence

| Function | Purpose | Trigger | Secrets Required |
|----------|---------|---------|-----------------|
| `accounting-assistant` | Alice AI Business Advisor — streaming chat with accounting context | Client POST (streaming) | `LOVABLE_API_KEY`¹, `SUPABASE_SERVICE_ROLE_KEY` |
| `alice-sheets-assistant` | AI Sheets chat — spreadsheet-aware AI assistant | Client POST (streaming) | `LOVABLE_API_KEY`¹, `SUPABASE_SERVICE_ROLE_KEY` |
| `compose-ai-assistant` | AI-powered message composition (email/SMS drafts) | Client POST | `LOVABLE_API_KEY`¹ |
| `ai-asset-classify` | AI classification of fixed assets into CCA classes | Client POST | `LOVABLE_API_KEY`¹ |
| `ai-coa-generator` | AI-generated chart of accounts by industry | Client POST | `LOVABLE_API_KEY`¹ |
| `ai-jurisdiction-setup` | AI-detected tax jurisdiction setup | Client POST | `LOVABLE_API_KEY`¹, `SUPABASE_SERVICE_ROLE_KEY` |
| `ai-rate-update` | AI-powered tax/exchange rate updates | Client POST | `LOVABLE_API_KEY`¹, `SUPABASE_SERVICE_ROLE_KEY` |
| `ai-bank-connect` | Plaid bank connection + AI categorization | Client POST | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENVIRONMENT` |
| `td1-ai-assist` | AI assistance for TD1 tax form completion | Client POST | `LOVABLE_API_KEY`¹ |

> ¹ `LOVABLE_API_KEY` is Lovable's proprietary AI proxy. **You must replace this** — see [Section 7](#7-lovable-specific-code-to-removerefactor).

#### Document Processing

| Function | Purpose | Trigger | Secrets Required |
|----------|---------|---------|-----------------|
| `file-convert` | File conversion (DOCX/images/CSV → PDF, text extraction) | Client POST | `SUPABASE_SERVICE_ROLE_KEY` |
| `flatten-pdf` | Flatten PDF form fields and annotations | Client POST | `SUPABASE_SERVICE_ROLE_KEY` |
| `pdf-to-spreadsheet` | Extract tabular data from PDFs to Excel | Client POST | `LOVABLE_API_KEY`¹, `SUPABASE_SERVICE_ROLE_KEY` |

#### DocSign (Document Signing)

| Function | Purpose | Trigger | Secrets Required |
|----------|---------|---------|-----------------|
| `docsign-signer-portal` | External signer portal — get doc, add fields, submit | Client POST / External link | `SUPABASE_SERVICE_ROLE_KEY` |
| `embed-pdf-signatures` | Burns signature images into PDF bytes | Client POST | `SUPABASE_SERVICE_ROLE_KEY` |
| `finalize-document` | Final signature embedding, SHA-256 hash, Certificate of Completion | Client POST | `SUPABASE_SERVICE_ROLE_KEY` |

#### Communication

| Function | Purpose | Trigger | Secrets Required |
|----------|---------|---------|-----------------|
| `sendgrid-integration` | Send emails via SendGrid | Client POST | `SENDGRID_API_KEY` |
| `sendgrid-inbound-webhook` | Receive inbound emails from SendGrid | SendGrid webhook POST | `SUPABASE_SERVICE_ROLE_KEY` |
| `mailchimp-transactional` | Send emails via Mailchimp/Mandrill | Client POST | `MAILCHIMP_TRANSACTIONAL_API_KEY` |
| `twilio-send-message` | Send SMS/WhatsApp messages | Client POST | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WHATSAPP_NUMBER` |
| `twilio-webhook` | Receive Twilio status callbacks | Twilio webhook POST | `TWILIO_AUTH_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` |
| `twilio-voice` | Voice call management, recording proxy | Client POST | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| `twilio-voice-token` | Generate Twilio Access Tokens for browser VOIP | Client POST | `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_TWIML_APP_SID` |
| `twilio-twiml-app` | TwiML webhook — handles outbound call routing | Twilio TwiML webhook | `TWILIO_PHONE_NUMBER` |
| `twilio-inbound-voice` | Handle inbound voice calls | Twilio webhook | `TWILIO_TWIML_APP_SID`, `TWILIO_PHONE_NUMBER`, `SUPABASE_SERVICE_ROLE_KEY` |
| `voice-orchestrator` | PSTN-to-PSTN call bridging | Client POST | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| `voice-transcribe` | Transcribe voice recordings | Client POST | `LOVABLE_API_KEY`¹ |
| `whatsapp-audio` | Process WhatsApp audio messages | Twilio webhook | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| `elevenlabs-tts` | Text-to-speech via ElevenLabs | Client POST | `ELEVENLABS_API_KEY` |
| `send-sms-otp` | SMS OTP verification | Client POST | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |

#### Authentication & User Management

| Function | Purpose | Trigger | Secrets Required |
|----------|---------|---------|-----------------|
| `log-auth-event` | Log login/logout/failed attempts | Client POST (fire-and-forget) | `SUPABASE_SERVICE_ROLE_KEY` |
| `admin-create-user` | Admin: create users with pre-set roles | Client POST | `SUPABASE_SERVICE_ROLE_KEY` |
| `send-invitation` | Send org invite emails | Client POST | `SENDGRID_API_KEY` or `MAILCHIMP_TRANSACTIONAL_API_KEY` |
| `accept-invitation` | Process invitation acceptance | Client POST | `SUPABASE_SERVICE_ROLE_KEY` |
| `resend-integration` | Email sending via Resend (fallback) | Client POST | Resend API key (if configured) |

#### Payments & Billing

| Function | Purpose | Trigger | Secrets Required |
|----------|---------|---------|-----------------|
| `stripe-integration` | Stripe operations (plans, subscriptions, health) | Client POST | `STRIPE_SECRET_KEY` |
| `stripe-webhook` | Stripe event handler | Stripe webhook POST | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| `collect-invoice-payment` | Generate Stripe payment links for invoices | Client POST | `STRIPE_SECRET_KEY` |
| `plaid-integration` | Plaid Link token creation + health checks | Client POST | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENVIRONMENT` |

#### Rate Management

| Function | Purpose | Trigger | Secrets Required |
|----------|---------|---------|-----------------|
| `apply-rate-update` | Apply AI-suggested rate updates to the database | Client POST | `SUPABASE_SERVICE_ROLE_KEY` |

### Deploying Edge Functions

```bash
# Deploy a single function
supabase functions deploy accounting-assistant --no-verify-jwt

# Deploy all functions
for dir in supabase/functions/*/; do
  name=$(basename "$dir")
  supabase functions deploy "$name" --no-verify-jwt
done

# Set secrets
supabase secrets set SENDGRID_API_KEY=SG.xxxxx
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxx
# ... etc.

# View function logs
supabase functions logs accounting-assistant
```

### Local Edge Function Development

```bash
# Serve all functions locally with env vars
supabase functions serve --env-file ./supabase/.env.local

# Test a specific function
curl -X POST http://localhost:54321/functions/v1/sendgrid-integration \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-anon-key>" \
  -d '{"action": "health-check"}'
```

Create `supabase/.env.local` for local development:

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<your-local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-local-service-role-key>
SENDGRID_API_KEY=SG.xxxxx
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
# ... add all required secrets
```

---

## 6. External APIs & Third-Party Services

| Service | Purpose | SDK/Method | Dashboard |
|---------|---------|-----------|-----------|
| **Supabase** | Database, Auth, Storage, Edge Functions | `@supabase/supabase-js` | https://supabase.com/dashboard |
| **SendGrid** | Transactional email (primary) | REST API via edge function | https://app.sendgrid.com |
| **Mailchimp Transactional (Mandrill)** | Transactional email (secondary) | REST API via edge function | https://mandrillapp.com |
| **Twilio** | SMS, WhatsApp, Voice (PSTN), browser VOIP | REST API + `@twilio/voice-sdk` | https://console.twilio.com |
| **ElevenLabs** | Text-to-speech (Alice/Gemini voices) | REST API via edge function | https://elevenlabs.io |
| **Stripe** | SaaS subscriptions, invoice payments | REST API via edge function | https://dashboard.stripe.com |
| **Plaid** | Bank account linking & transaction sync | REST API + `react-plaid-link` | https://dashboard.plaid.com |
| **pdf-lib** | Client-side PDF generation/manipulation | npm package (client-side) | N/A |
| **pdfjs-dist** | Client-side PDF rendering/parsing | npm package (client-side) | N/A |
| **jspdf** | Client-side PDF generation | npm package (client-side) | N/A |
| **SheetJS (xlsx)** | Excel file read/write | npm package (client-side) | N/A |
| **JsBarcode** | Barcode generation | npm package (client-side) | N/A |
| **docx** | DOCX file generation | npm package (client-side) | N/A |
| **JSZip** | ZIP file creation | npm package (client-side) | N/A |

### Email Infrastructure

- **Sender**: `info@efinsuite.com`
- **Required DNS**: SPF, DKIM, DMARC records on `efinsuite.com`
- **Inbound**: SendGrid Inbound Parse webhook → `sendgrid-inbound-webhook` function

### Voice Infrastructure

- **SMS/Voice number**: +17789020442
- **WhatsApp Sandbox**: +14155238886 (recipients must opt-in with `join <keyword>`)
- **TwiML App**: Configure callback URL to `<supabase-url>/functions/v1/twilio-twiml-app`
- **Inbound voice**: Configure Twilio number webhook to `<supabase-url>/functions/v1/twilio-inbound-voice`
- **Status callbacks**: Configure to `<supabase-url>/functions/v1/twilio-webhook`

### Stripe Webhooks

Configure webhook endpoint in Stripe Dashboard:
- URL: `<supabase-url>/functions/v1/stripe-webhook`
- Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`

---

## 7. Lovable-Specific Code to Remove/Refactor

### 7.1 `lovable-tagger` (Dev Plugin)

**File:** `vite.config.ts` (line 5, 38)

```typescript
// REMOVE this import:
import { componentTagger } from "lovable-tagger";

// REMOVE this plugin:
mode === "development" && componentTagger(),
```

**Action:** Remove the import and plugin line. Then uninstall the package:

```bash
npm uninstall lovable-tagger
```

### 7.2 `LOVABLE_API_KEY` — AI Proxy Replacement

**This is the most critical migration task.** All AI-powered edge functions use `LOVABLE_API_KEY` to call Lovable's AI proxy (`https://api.lovable.dev/...` or similar). This proxy routes to models like Gemini and GPT.

**Affected functions** (9 total):
- `accounting-assistant`
- `alice-sheets-assistant`
- `compose-ai-assistant`
- `ai-asset-classify`
- `ai-coa-generator`
- `ai-jurisdiction-setup`
- `ai-rate-update`
- `td1-ai-assist`
- `pdf-to-spreadsheet` (for AI-enhanced extraction)

**Migration steps:**

1. **Choose your AI provider**: OpenAI, Google Gemini, or Anthropic.
2. **Get API keys** from your chosen provider.
3. **In each affected edge function**, find the section that calls Lovable's AI proxy and replace it:

```typescript
// BEFORE (Lovable proxy):
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
  body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [...] }),
});

// AFTER (direct OpenAI example):
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
  body: JSON.stringify({ model: "gpt-4o", messages: [...] }),
});
```

4. Set new secrets: `supabase secrets set OPENAI_API_KEY=sk-...`
5. Remove the old secret: `supabase secrets unset LOVABLE_API_KEY`

### 7.3 Lovable Preview URL Detection

**File:** `src/hooks/useDocuments.ts` (line ~384-388)

```typescript
// This code detects Lovable preview URLs and falls back to the published URL.
// REPLACE with your actual production domain:
const isPreviewOrigin = currentOrigin.includes('.lovableproject.com');
const publishedBaseUrl = 'https://efinsuite.com';
```

**Action:** Replace with your production domain:

```typescript
const baseUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
```

Remove the `isPreviewOrigin` check and the `publishedBaseUrl` constant entirely.

### 7.4 `lovable_ai` / `efinsuite_ai` Source Labels

**File:** `src/components/settings/AutoRateUpdatesTab.tsx` (lines ~685, ~867)

```typescript
// These display labels reference 'lovable_ai' as a data source.
// Change to your own AI branding:
log.ai_source === 'lovable_ai' ? 'EfinSuite AI' : ...
```

**Action:** Keep or rename as desired. The `lovable_ai` string may also exist in database records — update any existing data if needed.

### 7.5 `.lovable` Directory

**Directory:** `.lovable/`

This contains Lovable platform configuration (plan files, etc.). **Delete the entire directory.**

```bash
rm -rf .lovable
```

### 7.6 `tailwind.config.lov.json`

**File:** `src/tailwind.config.lov.json`

This is a Lovable-specific tailwind config snapshot. Check if `tailwind.config.ts` references it. If not, delete it.

### 7.7 Service Worker & Version Polling

**File:** `src/main.tsx`

The version polling system (`checkForUpdates`, `version.json`, `sw-updated` events) and the `versionJsonPlugin` in `vite.config.ts` are designed for Lovable's deployment flow. 

**Action:** Keep if you want auto-update detection in your own hosting, or simplify to a standard Vite PWA setup. The code is generic and doesn't depend on Lovable infrastructure.

### 7.8 `__BUILD_TS__` Global

**File:** `vite.config.ts` (line 30)

```typescript
__BUILD_TS__: JSON.stringify(buildTimestamp),
```

This is used by the version detection system. Keep if you keep the version polling, otherwise remove both the define and references in `main.tsx`.

### 7.9 Auto-Generated Files

These files are auto-generated by Lovable Cloud and should be regenerated from your own Supabase project:

| File | Action |
|------|--------|
| `src/integrations/supabase/client.ts` | Regenerate with `supabase gen types typescript` or keep as-is (it's a standard Supabase client) |
| `src/integrations/supabase/types.ts` | Regenerate: `supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts` |
| `.env` | Replace with your own Supabase project credentials |
| `supabase/config.toml` | Replace `project_id` with your project ref |

### 7.10 Summary Checklist

- [ ] Remove `lovable-tagger` from `vite.config.ts` and `package.json`
- [ ] Delete `.lovable/` directory
- [ ] Delete `src/tailwind.config.lov.json` (if unused)
- [ ] Replace `LOVABLE_API_KEY` with direct AI provider keys in all 9 edge functions
- [ ] Update `useDocuments.ts` to remove Lovable preview URL detection
- [ ] Update `.env` with your own Supabase project credentials
- [ ] Update `supabase/config.toml` project ID
- [ ] Regenerate `types.ts` from your Supabase project
- [ ] Set up all Supabase secrets (see Section 3)
- [ ] Create storage buckets with correct policies (see Section 4.5)
- [ ] Configure Twilio webhooks to point to your Supabase edge function URLs
- [ ] Configure Stripe webhooks to point to your Supabase edge function URLs
- [ ] Configure SendGrid Inbound Parse to point to your Supabase edge function URL
- [ ] Set up DNS records for email deliverability (SPF/DKIM/DMARC)
- [ ] Test all edge functions after migration

---

## Appendix: Project File Structure

```
├── public/                     # Static assets (favicon, PWA icons, sw.js)
├── src/
│   ├── assets/                 # Images, logos (imported as ES6 modules)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui base components
│   │   ├── admin/              # Admin panel components
│   │   ├── assets/             # Fixed asset management
│   │   ├── banking/            # Bank reconciliation
│   │   ├── budgeting/          # Budget management
│   │   ├── communication/      # Email/SMS/WhatsApp/Voice
│   │   ├── dashboard/          # Main dashboard, AI assistants
│   │   ├── docsign/            # Document signing
│   │   ├── donations/          # Non-profit donation management
│   │   ├── invoices/           # Invoice management
│   │   ├── payroll/            # Canadian payroll
│   │   ├── settings/           # Organization settings
│   │   └── ...                 # Other module components
│   ├── config/                 # App configuration constants
│   ├── data/                   # Static data (tax tables, etc.)
│   ├── hooks/                  # Custom React hooks (data fetching, auth)
│   │   ├── useAuth.tsx         # Auth context provider
│   │   ├── useAccounts.ts      # Chart of accounts CRUD
│   │   ├── useDocuments.ts     # DocSign document operations
│   │   └── ...                 # ~50+ custom hooks
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts       # Supabase client instance
│   │       └── types.ts        # Auto-generated DB types (17,749 lines)
│   ├── lib/                    # Utility libraries
│   ├── pages/                  # Route page components
│   │   ├── auth/               # Login, Signup, ForgotPassword
│   │   ├── admin/              # Admin pages
│   │   └── ...                 # All other pages
│   ├── types/                  # Shared TypeScript types
│   ├── utils/                  # Utility functions
│   ├── App.tsx                 # Root component with all routes
│   ├── main.tsx                # Entry point, SW registration
│   └── index.css               # Tailwind base + design tokens
├── supabase/
│   ├── config.toml             # Supabase project config
│   ├── migrations/             # SQL migration files
│   └── functions/              # 39 Edge Functions (Deno)
├── tailwind.config.ts          # Tailwind configuration
├── vite.config.ts              # Vite build configuration
└── package.json
```

---

*Good luck with the migration! This is a large, feature-rich codebase. Tackle it module by module.*
