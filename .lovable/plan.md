# Subscription Follow-ups — Batch 1

Tackling **#1 Session verification** and **#5 Usage-limit enforcement UX** now. Later batches (#2+#4, then #6+#7, then discuss #3) are noted at the end but not built in this pass.

---

## #1 — Verify Stripe session on `SubscriptionSuccess`

**Problem:** The page renders "Subscription Activated!" purely from a URL param. A cancelled/failed/tampered `session_id` still shows success, and the local `subscriptions` row may not be refreshed yet if the webhook is slow.

**Backend — `supabase/functions/stripe-integration/index.ts**`

- Add a new action `verify-checkout-session`:
  - Input: `{ session_id }`.
  - Auth: require a valid user JWT; resolve the caller's org.
  - Call Stripe `GET /v1/checkout/sessions/{id}?expand[]=subscription&expand[]=customer`.
  - Confirm `session.metadata.organization_id` matches caller's org (prevents cross-org probing).
  - Return `{ status: 'complete'|'open'|'expired', payment_status, subscription_status, plan_name, current_period_end, amount_total, currency }`.
  - If `status='complete'` but our `subscriptions` row is still stale, upsert from the Stripe subscription object so the UI doesn't have to wait for the webhook.

**Frontend — `src/pages/SubscriptionSuccess.tsx**`

- Replace empty `useEffect` with a `useQuery` calling `verify-checkout-session`.
- Three render states:
  1. **Loading:** spinner + "Confirming your subscription…"
  2. **Complete:** current success UI, plus plan name, next billing date, and amount charged pulled from the verify response.
  3. **Pending / open / expired / mismatch:** warning card ("We couldn't confirm this checkout") with a retry button and a link back to `/subscription/checkout`.
- On complete, call `useSubscription().refetch()` and `queryClient.invalidateQueries({ queryKey: ['subscription'] })` so the rest of the app sees the new plan immediately.
- If `session_id` is missing entirely, show the mismatch state (don't fabricate success).

---

## #5 — Usage-limit enforcement UX

**Problem:** `useUsageLimits` already computes `isUsersAtLimit` / `isEmployeesAtLimit` with `canAddUser` / `canAddEmployee`, but no UI consumes them. Users on Starter can silently exceed seat/employee caps.

**Shared piece**

- Extend `SubscriptionUpgradeModal` to accept an optional `reason: 'limit_users' | 'limit_employees'` and render limit-specific copy ("You've reached your plan's user limit (X of Y)") instead of the module-lock copy when `reason` is set. `requiredModule` stays optional.

**Add-user flow (invitations)**

- Locate the "Invite user" / "Add member" entry point (organization settings / members page — will confirm during implementation).
- Before opening the invite dialog, read `useUsageLimits()`. If `!canAddUser`, open `SubscriptionUpgradeModal` with `reason='limit_users'` and `requiredPlan` = next tier that raises `max_users`, instead of the invite dialog.
- Also disable the invite submit button (with tooltip) if the check is bypassed by a deep link.
- Add a check for when user has no subscription too

**Add-employee flow**

- Same treatment in the employees page's "New employee" action, gated by `canAddEmployee` with `reason='limit_employees'`.

**Server-side safety net (defense in depth, no new endpoint)**

- Add a DB trigger `enforce_org_usage_limits` on `organization_members` INSERT and `employees` INSERT that reads the active plan's `max_users` / `max_employees` and raises if the count would exceed. Skipped for platform admins (via `has_role(auth.uid(),'admin')`) so overrides still work.
- This closes the gap where a determined user hits Supabase directly.

**Admin bypass**

- `useUsageLimits` already exempts `isAdmin`. The trigger mirrors this via `has_role`.

---

## Technical details (for the implementer)

- `verify-checkout-session` uses the same Stripe key + CORS helper as other actions in `stripe-integration/index.ts`; no new secret needed.
- Session ownership check: prefer `metadata.organization_id` (we already set it on create) over trusting the caller's default org, in case the user switched orgs between checkout and return.
- The upsert-on-verify path must be idempotent with the webhook (match on `stripe_subscription_id`, don't duplicate rows).
- Trigger uses `SECURITY DEFINER` + `SET search_path = public` and reads `pricing_plans.max_users` / `max_employees` via `subscriptions` join. Bypass condition: `NEW`-org has no active subscription row → allow (free tier decision stays app-side) OR the calling role is admin.
- No changes to `useSubscription`, `planModuleAccess`, or the admin discount/override surfaces in this batch.

---

## Out of scope for this batch (queued)

- **Next:** #2 in-app promo code field on `SubscriptionCheckout` + #4 admin audit log viewer.
- **Then:** #6 cancel / downgrade-at-period-end flow + #7 preset editing in `DiscountsTab`.
- **Discuss after:** #3 webhook hardening (needs a walkthrough of every event we handle).