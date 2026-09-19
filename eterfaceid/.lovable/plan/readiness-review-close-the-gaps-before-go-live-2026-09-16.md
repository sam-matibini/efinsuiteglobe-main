# Readiness review: close the gaps before go-live

I went through the app as it stands. Most of it is working: the console, screening, documents and liveness, transactions, reports, teams, and the new app admin all load and run. Below are the real gaps I found, and the plan to close them.

## What's missing today

1. **Approving or rejecting a case sends no email.** The decision is saved from the browser directly, so the "case decisions" notification never fires and the decision isn't consistently recorded in the audit trail.
2. **No welcome email when someone signs up and creates their own company.** Only people who join by invitation get one.
3. **Ongoing rescreening isn't scheduled.** Watchlists refresh automatically, but nothing re-checks existing customers against the updated lists, so a person who becomes sanctioned after onboarding is never flagged.
4. **Usage counts only document checks.** Selfie/liveness checks and risk assessments aren't counted, so invoices would under-bill.
5. **Emails can only reach your own address right now.** Until a sending domain of yours is verified, the email provider refuses delivery to anyone else — invitations to colleagues would silently fail.
6. **No plans are configured yet**, so the public pricing page still shows placeholder prices and no company has a plan or invoice to bill against.
7. **The customer-facing API and webhooks haven't been re-tested** since every record became company-scoped.
8. **Two watchlists are incomplete**: the UK list loaded empty and the US OFAC list didn't finish.

## Plan

**Fix the wiring**
- Move case approve/reject to the server: save the decision, write the audit entry, count it, and email the assigned reviewer and the case creator.
- Send the welcome email when a new company workspace is created.
- Count selfie/liveness checks and risk assessments toward monthly usage.

**Add ongoing rescreening**
- A scheduled job that, after each watchlist refresh, re-screens every open/approved case against records that changed, opens a monitoring alert and a new match for anything found, and emails the company's admins and analysts.

**Verify end to end**
- Sign up a fresh test company, invite a colleague, accept the invite, run a case through document, liveness, screening, transaction and report, and confirm each email is logged.
- Call the customer API with a key from one company and confirm it cannot see another company's data; fire a webhook and confirm the delivery log.
- Re-run the UK and US OFAC list loads and confirm record counts.
- Clean up all test data afterwards.

**Left for you**
- The sending domain for emails (I'll set it up once you tell me which domain to use).
- Real prices in the app admin, plus your company address, contact details and tax number — those replace the remaining orange placeholders on the public site and on invoices.

## Technical notes

- New `decideCase` server function in `src/lib/verification.functions.ts` (auth + `can_write` gate), replacing the direct Supabase update in `console.cases.$caseId.tsx`; sends `case.decision` via `notifyOrg`.
- `createOrganization` in `teams.functions.ts` sends `team.welcome`.
- `recordUsage(..., "verifications")` added to `submitSelfie` and `runRiskAssessment`.
- New `src/routes/api/public/hooks/rescreen.ts`, guarded by `x-cron-secret` like the watchlist hook: pages through cases per org, reuses `scoreMatch`/`match_watchlist_names`, inserts only new `entity_id` hits, opens `monitoring_alerts`, notifies via `notifyOrg("screening.hit")`.
- No schema changes required.
