# Subscription Wall Implementation Plan

## Overview

Add subscription-based feature gating to the existing module system. Features stay visible in the sidebar for all users, but clicking a locked one opens an upgrade prompt. Platform admins (`role='admin'`) bypass all checks. A new **Office Use** free tier gives full access to organizations without a paid plan. Office Use is a demo/admin-only plan — shown in checkout **only** to admin users. New orgs must pick a plan at creation time.

## Current State

Two disconnected systems today:


| System         | Purpose                       | Location                                                           |
| -------------- | ----------------------------- | ------------------------------------------------------------------ |
| Stripe billing | Checkout, payments, plan mgmt | `subscriptions` + `pricing_plans`, edge functions, admin UI        |
| Module access  | Which features an org can use | `organization_modules`, `useEnabledModules`, `roleModuleAccess.ts` |


Gap: nothing ties "org pays for Professional" to "org can use Fixed Assets/Budgeting/Inventory." A free org and a $299/mo org currently have identical feature access.

Key files: `useEnabledModules.ts`, `roleModuleAccess.ts`, `layout/Sidebar.tsx`, `SubscriptionCheckout.tsx`, `admin/AdminSubscriptions.tsx`, `supabase/functions/stripe-integration`, `supabase/functions/stripe-webhook`.

---

## Phase 1 — Foundation (Data Layer)

### 1.1 `src/hooks/useSubscription.ts` (new)

Fetches current org's active subscription joined with `pricing_plans`.
Returns: `subscription`, `plan`, `isLoading`, `isActive` (status in `active`/`trialing`), `isPaid`, `planTier` (`office_use` | `starter` | `professional` | `enterprise`), `hasFeature(code)`, `refetch`.

- No active row → `planTier: 'office_use'`.
- Admins → `hasFeature()` always `true`.
- React Query key: `['subscription', organizationId]`.

### 1.2 `src/hooks/useUsageLimits.ts` (new)

Counts `organization_members` and `employees` for current org, compares to `plan.max_users` / `plan.max_employees` (`null` = unlimited).
Returns: counts, maxes, `isUsersAtLimit`, `isEmployeesAtLimit`, `canAddUser`, `canAddEmployee`, `isLoading`. Admins bypass.

### 1.3 `src/config/planModuleAccess.ts` (new)

Plan-tier → module list, mirroring `roleModuleAccess.ts`.


| Plan               | Modules                                                              | max_users | max_employees | Price   |
| ------------------ | -------------------------------------------------------------------- | --------- | ------------- | ------- |
| Office Use (Admin) | All                                                                  | ∞         | ∞             | Free    |
| Starter            | GL, AP, AR, Banking, Reporting, Payroll, Treasury                    | 5         | 25            | $49/mo  |
| Professional       | + Fixed Assets, Budgeting, Inventory, DocSign, Communication, Leases | 25        | 100           | $129/mo |
| Enterprise         | + Practice Management, Donations, Accountant Dashboard               | ∞         | ∞             | $299/mo |


Exports `PLAN_MODULE_ACCESS` and `isModuleInPlan(code, tier)`.

---

## Phase 2 — Integration

### 2.1 Extend `useEnabledModules`

Add a third check after role + org-module: `planIncludes`. Admins skip the plan check. One change propagates everywhere `isModuleEnabled` is used.

### 2.2 Sidebar shows locked items (`layout/Sidebar.tsx`)

Today, non-enabled modules are filtered out. Change to:

- role blocked → hide (unchanged)
- org module disabled → hide (unchanged)
- org enabled but not in plan → show with `locked: true`,  click opens `SubscriptionUpgradeModal` instead of navigating
- otherwise → show normally

### 2.3 `src/components/SubscriptionUpgradeModal.tsx` (new)

Dialog showing the minimum required plan, its features, current plan, and an "Upgrade Now" button → `/subscription/checkout?plan=<tier>`. Props: `open`, `onOpenChange`, `requiredModule`, `currentPlanTier`.

### 2.4 `SubscriptionCheckout.tsx` updates

- Read `?plan=` query param to pre-highlight the recommended plan.
- Hide the **Office Use** plan card unless viewer is a platform admin (`useAuth().isAdmin`).

---

## Phase 3 — Enforcement

### 3.1 Usage limit enforcement

- `settings/UsersSettingsTab.tsx`: disable Invite User when `!canAddUser`, tooltip with plan limit + upgrade link.
- `payroll/EmployeesList.tsx`: same for Add Employee.
- Admins bypass.

### 3.2 Subscription route guard (`src/App.tsx`)

`SubscriptionRoute` wrapper: if a subscription exists but is `canceled` and expired, redirect to `/subscription/reactivation`. Feature-level gating stays through the sidebar/modal, so most routes remain reachable.

### 3.3 `src/pages/SubscriptionReactivation.tsx` (new)

Shows expired plan details and a Reactivate button that creates a new Stripe checkout session for the previous plan via `stripe-integration`.

### 3.4 New-org creation must pick a plan

Update the create-organization flow (org creation dialog / signup path) to require plan selection before the org is created — non-admins should not be shown Office Use.

---

## Phase 4 — Polish

### 4.1 `settings/BillingSettingsTab.tsx` (new)

Owner-visible tab: current plan + price, monthly/yearly toggle, usage bars (`X/Y` users and employees), upgrade/downgrade buttons, billing history if available.

### 4.2 Migration: seed Office Use plan

New migration inserting an `office_use` pricing plan (price 0, max_users ∞, max_employees ∞, features per matrix, `is_active=true`, low `sort_order` so it appears first for admins).

### 4.3 Existing orgs

Orgs without a subscription row automatically resolve to Office Use through `useSubscription` — no backfill needed.

---

## Technical Notes

- Admin bypass everywhere: check `useAuth().isAdmin` before any plan / limit gate.
- `planTier` derivation: prefer a stable `tier` column on `pricing_plans` if present; otherwise map by plan `name` (case-insensitive) with a fallback to `office_use`. The migration should ensure the tier value is stored/derivable.
- React Query cache invalidation after checkout success (`['subscription', orgId]`, `['usage-limits', orgId]`) so the UI unlocks immediately.
- Webhook (`stripe-webhook`) already updates `subscriptions.status`; no backend changes needed for gating.
- Keep all copy/UI in presentation layer; no changes to accounting business logic.

## Out of Scope

- Rewriting the Stripe integration or webhook logic.
- Per-seat metering beyond `max_users` / `max_employees`.
- Proration UX beyond what Stripe Checkout already provides.
- Restyling the sidebar beyond the locked-item affordance.