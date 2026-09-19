# Sandbox and live API access, gated by verification and contract

Today anyone with a workspace can mint a live key and call the API without limit. This change makes sandbox free and open, and live access something a company has to earn and pay for.

## How it will work for a new customer

1. **Sign up → sandbox straight away.** A new workspace can create sandbox keys immediately, no approval. Sandbox never touches real sanctions lists or real bank connections: it returns realistic, predictable test results so partners can build against the API safely. Sandbox usage is unlimited and never billed.
2. **Apply for live access.** In the console, an admin opens "Go live" and completes three steps:
   - Business details and documents (registered name, number, country, address, directors, and the beneficial owners).
   - Our own business verification runs automatically on what they submitted — registry-style checks, owner screening against the sanctions and PEP lists, the 25% ownership and 50% sanctions rules — and produces a pass / review / fail with the reasons shown.
   - The commercial agreement: they either accept it on screen (we record who accepted, when, from which address, and which version) or, for larger clients, your staff record that a signed copy was received and attach it.
3. **You confirm.** The application appears in App admin with the verification result, the ownership picture and the contract state. You approve or decline with a note. Nothing goes live without your click.
4. **Live keys unlock.** Once approved and on a plan, the admin can create live keys. Until then the live option is visible but locked, with a line saying exactly what is outstanding.

## Stopping free use of the API

Every API call is checked before it does any work:

- **No key / revoked key** → refused, as today.
- **Sandbox key** → allowed, simulated results, not billed.
- **Live key without approval, without a signed contract, or on a suspended or cancelled account** → refused with a clear reason and how to fix it.
- **Over the included volume** → refused once the month's allowance is used up, telling them to upgrade; you can lift it instantly from App admin by raising their included volume or changing their plan.
- **Burst protection** → a per-key ceiling on calls per minute so one integration can't hammer the service.

Every refusal is a clean, documented error the partner's code can read, and every live call keeps counting toward their invoice as it does now.

## What you get in App admin

- A **Live access** queue: pending applications, the automatic verification outcome, the contract status, and Approve / Decline.
- On each company: verification result, contract (accepted on screen or uploaded copy), approval history, and buttons to suspend or restore live access.
- Usage against allowance already shown per month; blocked calls appear in the audit trail.

## Technical notes

- New tables: `org_applications` (org, submitted business details jsonb, verification result, status pending/approved/declined, reviewer, notes), `org_contracts` (org, version, accepted_by/accepted_at/ip, or uploaded file path, status), `api_rate_counters` (key, minute bucket) for burst control. Grants + RLS: org members read their own, platform staff read all, service role writes.
- `organizations` gains `live_access` (locked/approved/suspended) and `live_approved_at`; `api_keys` creation of `environment: "live"` is refused server-side unless `live_access = 'approved'` and a contract row is accepted.
- `authenticateApiRequest` in `src/lib/api-gateway.server.ts` becomes the single entitlement gate: loads the key, org, subscription and month's `usage_counters` in one pass and returns `402 payment_required`, `403 live_access_required`, `429 rate_limited` or the existing `401`s. Every `/api/public/v1/*` route inherits this with no route changes.
- Sandbox behaviour: `ApiContext.environment === "sandbox"` short-circuits the screening, watchlist and Plaid paths to a deterministic simulator (`src/lib/sandbox.server.ts`) keyed off the subject name — e.g. names containing "test-sanctioned" return a hit — and `countUsage` skips billing. Sandbox records are tagged so they never mix with live case lists.
- The applicant's own KYB reuses the existing engine (`ownership.ts`, `screening-core.server.ts`, `address-rules.ts`) rather than new logic.
- New console route `console/go-live`, new admin route `admin/applications`; the Developers page gains a short "Sandbox vs live" section explaining the keys, the test values and the error codes.

## Out of scope

No card payments — invoices stay as they are. No automatic re-verification of existing customers on a schedule; that can follow later.
