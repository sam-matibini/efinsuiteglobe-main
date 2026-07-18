# Subscription Gateway — Completed

All planned phases have been implemented and the project builds successfully.

## Completed Phases

1. **Trial + Proration UX** — `preview-plan-change` action, trial status, switch-plan confirmation dialogs.
2. **Admin Subscription Controls** — Extend demo period, manual overrides, and discounts (global / per-org).
3. **Discount Library** — `discount_presets` table, automatic Stripe coupon provisioning, promo-code revocation warnings on preset edits.
4. **Org Switch Optimization** — Client-side redirect to dashboard with query-key invalidation and route-tree remounting.
5. **Route Access Guard** — Module and subscription-based route protection via `RouteAccessGuard`.
6. **Session Verification** — `verify-checkout-session` action on the success page.
7. **Usage Limit Enforcement** — `useUsageLimits` gating in Users/Employees settings.
8. **Promo Codes** — In-app promo code field with live discounted price preview on plan cards.
9. **Audit Logs** — `SubscriptionAuditLogTab` for admin override and discount events.
10. **Downgrade / Cancel Flow** — Cancellation dialogs with reason/feedback, downgrade impact warnings.
11. **Discount Preset Editing** — Edit dialog with Stripe coupon replacement and promo-code revocation warning.
12. **Webhook Hardening** — Mandatory signature verification, timing-safe comparison, `stripe_webhook_events` idempotency table, new event handlers, and 200-vs-500 error policy.

## Deployed Edge Functions

- `admin-subscription-override`
- `stripe-integration`
- `stripe-webhook`

## Next Steps

- Configure the Stripe webhook endpoint to listen to the events listed in the previous summary.
- Verify `STRIPE_WEBHOOK_SECRET` is set in Supabase and matches the Stripe dashboard.
- If desired, add an admin UI to browse `stripe_webhook_events`.
