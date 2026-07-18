## Phase 3 — Downgrade/Cancel polish (#6) + Discount preset editing (#7)

Cancel and change-plan wiring already exist. This phase closes the remaining UX and admin gaps.

---

### Part A — Downgrade & Cancel flow (#6)

**A1. Downgrade guardrails on `SubscriptionCheckout`**
When the target plan is *lower* than the current one, before showing the proration confirm dialog:
- Compute impact using `useUsageLimits` + `planModuleAccess`:
  - users over target `max_users`
  - employees over target `max_employees`
  - modules enabled that the target plan doesn't include
- Show a "Review downgrade impact" panel inside the existing confirm dialog:
  - Red list of over-limit resources ("You have 12 employees, Starter allows 5")
  - Yellow list of modules that will be locked
  - Require an "I understand" checkbox before the "Confirm switch" button enables
- Proration preview stays as-is.

**A2. Cancel flow improvements in `BillingSettingsTab`**
- Add optional cancellation reason dropdown in the existing cancel `AlertDialog` (too expensive / missing features / switching tools / not using / other + free text). Sent to backend and stored via audit log.
- Add "Cancel immediately" secondary option (in addition to current end-of-period). Backed by a new branch in `manage-subscription` that calls Stripe `DELETE /subscriptions/{id}` when `immediate: true`.
- Show a clearer post-cancel state: banner with reactivate CTA (already present) plus the effective end date.

**A3. Backend: `stripe-integration` `manage-subscription`**
- Accept `subscriptionAction: 'cancel'` with `{ immediate?: boolean, reason?: string, feedback?: string }`.
- Immediate path: delete Stripe sub, mark local row `status='canceled'`, `canceled_at=now()`.
- Write an `audit_logs` entry (`action: 'subscription.cancel'`) with reason/feedback and mode.

---

### Part B — Discount preset editing (#7)

Stripe coupons are immutable for discount value/duration; only `name` and `metadata` are mutable. The edit UX must reflect that.

**B1. `DiscountsTab` — add Edit button per row**
Opens a dialog with two modes:
- **Safe edits** (no Stripe coupon replacement): `name`/label, `expiry` (if not yet redeemed count > 0 you can only extend, not shorten past now), `max_redemptions` — updates the Stripe coupon's mutable fields where allowed, otherwise updates preset row only and shows a notice.
- **Value/duration change**: since Stripe won't allow it, treat as "Replace":
  - Archive existing Stripe coupon (`POST /coupons/{id}` `deleted` isn't allowed — use `valid=false` via delete, or mark preset archived and create a new coupon).
  - Create a new Stripe coupon with new values.
  - Update the preset row with the new `stripe_coupon_id` (keeps preset UUID stable so any org already granted this preset keeps working; existing subscriptions keep their old coupon on Stripe's side — new applications use the new one).
  - Warn the admin in the dialog that in-flight subscriptions won't retroactively change.

**B2. Backend: `admin-subscription-override`**
- Add `update-preset` action: `{ preset_id, name?, max_redemptions?, expiry?, mode: 'safe' | 'replace', percent_off?, amount_off?, currency?, duration?, duration_in_months? }`.
- Safe mode → patch preset row + Stripe coupon `name`/metadata.
- Replace mode → delete old Stripe coupon, create new, update preset row.
- Audit log entry per edit.

**B3. UI polish**
- Show "In use by N orgs / N subscriptions" count on each preset (query `subscriptions.stripe_coupon_id`) so admins understand impact before editing.
- Disable "Replace" mode when redemptions exist unless admin confirms via a second checkbox.

---

### Technical notes

Files touched:
- `supabase/functions/stripe-integration/index.ts` — extend `manage-subscription` (immediate cancel + reason).
- `supabase/functions/admin-subscription-override/index.ts` — add `update-preset` action.
- `src/pages/SubscriptionCheckout.tsx` — downgrade impact panel inside confirm dialog.
- `src/components/settings/BillingSettingsTab.tsx` — reason capture + immediate cancel option.
- `src/components/admin/DiscountsTab.tsx` — Edit dialog, usage count column.
- `src/hooks/useUsageLimits.ts` — reused; no changes expected.

Out of scope (defer to phase 4 alongside #3 webhook discussion): grandfathering old coupons onto new preset values, dunning UX, invoice history tab.
