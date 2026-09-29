# eterfaceID Integration API v1

Goal: let eFinMoney, eFinsuite and any other system do everything the console does, over a documented HTTP API with API keys and webhooks.

## What exists today

Working, key-authenticated and company-scoped: list/create cases, read one case with its checks, hits, owners and transactions, run a name screening, record a transaction. Webhooks already sign and deliver `case.created`.

## What gets added

**Identity verification**
- Start a hosted verification session: we return a secure one-time link the customer opens to submit ID, selfie and liveness; the result comes back by webhook. Link expires, single use, tied to one case.
- Server-to-server alternative: submit document fields/images and a selfie directly, get the same checks and results back.
- Read a session's status and outcome.

**Business verification (KYB)**
- Add and read beneficial owners, run the ownership calculation (effective percentages, UBO flags, the 50% sanctions rule) and get the result back.

**Screening and monitoring**
- Re-screen a case on demand; list screening hits; set a hit's disposition (true / false positive).
- List transactions and their alerts for a case; list open monitoring alerts; acknowledge or close an alert.

**Bank-confirmed identity (Plaid)**
- Create a bank-link session for a case, and read the bank identity comparison result. Only active when Plaid is switched on.

**Decisions and reports**
- Approve or reject a case with a note (same rules and audit trail as the console).
- Draft a regulatory report for a case and mark it filed; list reports.

**Housekeeping**
- `GET /v1/ping` — key check, returns the company and environment.
- Consistent errors, pagination (`limit`, `cursor`), and idempotency keys on every create so a retry never duplicates a case or transaction.
- CORS preflight so browser-side partner apps can call read endpoints.
- Every call counted against the company's usage so it lands on their invoice.

**Webhooks**
Signed events for: case created, verification completed, decision made, screening hit found, alert opened, transaction flagged, report filed. The same signing secret and delivery log already in Settings.

**Developer docs**
The public Developers page becomes a real reference: getting a key, sandbox vs live, authentication, every endpoint with request/response examples, error codes, webhook payloads and signature verification, plus a copy-paste quick start. A machine-readable OpenAPI file is served at `/api/public/v1/openapi.json` so eFinMoney and eFinsuite can import it into Postman or generate a client.

## Technical notes

- New routes under `src/routes/api/public/v1/` following the existing pattern: `createFileRoute` + `server.handlers`, `authenticateApiRequest`, org-scoped queries through the service client, Zod validation, `jsonResponse`.
- Shared helpers added to `src/lib/api-gateway.server.ts`: pagination parsing, idempotency lookup, CORS headers, usage recording.
- New table `api_idempotency` (org_id, key, endpoint, response jsonb, created_at; unique on org_id+key) with grants and staff/service-scoped RLS, plus `verification_sessions` gains a hosted-link token hash and expiry.
- Hosted verification page at a public route that resolves the token, renders the existing document/selfie capture components, writes through the existing verification server functions, then fires the webhook.
- Business logic is reused, not duplicated: `verification.functions.ts`, `screening.functions.ts`, `monitoring.functions.ts`, `ownership.ts`, `plaid.functions.ts`.
- OpenAPI spec generated from one source file so docs and spec cannot drift.

## Out of scope

No card payments, no per-endpoint rate limiting (flagged as a later item), no client SDK packages — the OpenAPI file covers client generation.
