# Billing & Subscription UI in Settings

Add a new **Billing** tab to `src/pages/Settings.tsx` that lets org admins manage their subscription end-to-end.

## What the user sees

New "Billing" tab renders `BillingSettingsTab` with three sections:

1. **Current subscription card**
   - Plan name, price, billing cycle (monthly/yearly), status badge (active / trialing / past_due / canceled), current period end, and "cancels on …" notice when `cancel_at_period_end` is true.
   - Actions: **Change plan** (routes to existing `/subscription/checkout`), **Switch to yearly/monthly**, **Cancel subscription** (with confirm dialog → sets cancel_at_period_end), **Reactivate** (when scheduled to cancel).
   - Empty state when no active sub: CTA button to `/subscription/checkout`.

2. **Payment method**
   - Shows the default card brand + last4 + exp (fetched from Stripe via new action).
   - **Update payment method** button → opens Stripe Customer Portal in a new tab, scoped to the payment-method-update flow.

3. **Billing history**
   - Table of past invoices from Stripe: date, description, amount, status, and a "Download" link to Stripe's hosted invoice PDF.
   - **Manage billing on Stripe** button opens the full Customer Portal (invoices + card + cancel).

All destructive actions are gated behind org admin role (reuse `useAuth().isAdmin` / org owner check already used elsewhere in Settings).

## Backend (extend `supabase/functions/stripe-integration/index.ts`)

Existing `manage-subscription` already handles `cancel`, `reactivate`, `change-plan` — reuse as is. Add three new actions:

- `create-billing-portal-session` — inputs `{ organizationId, returnUrl, flow? }`. Looks up `subscriptions.stripe_customer_id`, calls Stripe `/billing_portal/sessions` with optional `flow_data[type]=payment_method_update`, returns `{ url }`.
- `get-payment-method` — returns default card `{ brand, last4, exp_month, exp_year }` by reading the customer's `invoice_settings.default_payment_method` (or first attached card).
- `list-invoices` — returns up to 24 recent Stripe invoices for the customer: `{ id, number, created, amount_paid, currency, status, hosted_invoice_url, invoice_pdf }`.

All three require an authenticated caller who belongs to the org (verify via JWT + `organization_members`), same pattern as existing actions.

## Frontend files

- `src/pages/Settings.tsx` — add `<TabsTrigger value="billing">` with `CreditCard` icon and `<TabsContent value="billing">` rendering `<BillingSettingsTab />`.
- `src/components/settings/BillingSettingsTab.tsx` — new. Uses `useSubscription()` for current plan, and three `useQuery` calls to the new edge actions for card + invoices. Mutations for cancel / reactivate / open-portal via `supabase.functions.invoke('stripe-integration', …)`. Confirmation dialog for cancel. Toasts via `sonner`.

## Technical details

- No DB migration required — `subscriptions` already stores `stripe_customer_id`, `stripe_subscription_id`, `cancel_at_period_end`, `current_period_end`.
- Stripe Customer Portal must be configured once in the Stripe dashboard (test + live); mention this in the closing message but do not block on it — the "Manage on Stripe" button surfaces the Stripe error if not configured.
- Return URL for portal sessions = `${origin}/settings?tab=billing`; update Settings to honor a `?tab=` query param so the user lands back on Billing.
- Reuse existing plan-tier filtering: hide `office_use` from any plan-switch shortcut unless `isAdmin`.
- No changes to `planModuleAccess.ts` or `useSubscription.ts`.
