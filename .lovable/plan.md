
## Context

The eFinSign API key belongs to a single eFinSign-side organization (`023daa82-da86-4883-952f-85dc4f6a6ff7`). That org id is fixed for every request and does not correspond to our multi-tenant `organizations.id`. All documents our app creates on eFinSign live under that same eFinSign org, and we tell them apart by the `documents.efinsign_document_id` we stored locally.

Right now the proxy already routes per-document actions (`send`, `void`, `add_signer`, `refresh_status`, `download_signed`, `audit_log`, ...) through the local document row, so those are structurally fine. What's missing is:

1. Authorization — nothing verifies that the local document referenced by `id` actually belongs to the caller's current organization. A user in Org A could pass Org B's document id and drive eFinSign actions against it.
2. eFinSign-org-wide list endpoints (`list_templates`, `list_webhooks`, `usage`, `organization`) return the full eFinSign-org view across all our tenants. Callers should only see rows tied to documents in their own local org.

## Changes

### 1. Resolve the caller's local organization

In `Deno.serve` handler (after `getClaims`), read `payload.organization_id` (already sent by clients that call this proxy) and validate the user is a member via `organization_members`. Reject with 403 if missing/not a member. Pass `orgId` into every handler alongside `userId`.

Update the `handlers` signature to `(payload, ctx: { userId; orgId })`.

### 2. Enforce org ownership on every per-document action

Add a small helper `assertDocumentInOrg(localDocId, orgId)` that does a single `documents.select('organization_id').eq('id', localDocId).single()` and throws 403 if it doesn't match. Call it at the top of:

- `update_document`, `delete_document`, `send`, `void`, `remind`, `refresh_status`, `audit_log`, `download_signed`
- `add_signer`, `update_signer`, `delete_signer` (via `document_id`)
- `add_field`, `update_field`, `delete_field` (via `document_id`)
- `get_signing_url` — resolve signer → document_id first, then assert

`ensureEfinsignDocument` stays as-is; the guard runs before it.

`create_document` writes `organization_id = ctx.orgId` (ignore any client-supplied value) so a caller can't mint rows for another tenant.

### 3. Filter eFinSign-org-wide reads to the caller's tenant

The eFinSign API returns global (eFinSign-org-scoped) lists. We map them back to the caller's local org by looking at documents we have on record.

- `audit_log` — already keyed to one document, just needs the ownership guard above.
- `list_webhooks` and `register_webhook` / `delete_webhook` / `test_webhook` — webhooks are a platform-level concern (one webhook processes events for every tenant). Restrict these actions to platform admins (`has_role(user, 'admin')`). Non-admin callers get 403. No per-tenant filtering; this is intentionally global.
- `list_templates` / `get_template` / `delete_template` / `create_from_template` — templates on eFinSign are shared under the single API key. Two options; pick one:
  - (a) Restrict template management to platform admins as well, and allow `create_from_template` for any org member (since instantiating produces a new document we tag with the caller's org).
  - (b) Track a `template_owner_org_id` locally in a lightweight table and filter `list_templates` to templates the caller's org created. Heavier; defer.

  Recommendation: (a) for this pass. `create_from_template` writes the resulting document with `organization_id = ctx.orgId` and stores its returned eFinSign id so subsequent per-document actions inherit the ownership guard.
- `usage` and `organization` — these are eFinSign-org-level counters/settings. Restrict to platform admins. If a per-tenant usage view is needed later, compute it locally by counting `documents where organization_id = ctx.orgId AND efinsign_document_id is not null`.

### 4. Webhook handler (`efinsign-webhook`)

Out of scope for this change, but note: it already resolves the local document via `efinsign_document_id`, so tenant attribution is automatic. No edit needed unless we later want to skip events whose `efinsign_document_id` doesn't map to any local row (currently they're logged and no-op'd, which is fine).

### 5. Client changes

`useDocuments.ts` and other callers of `supabase.functions.invoke('efinsign-proxy', ...)` need to include `organization_id: currentOrganization.id` in the payload. Audit call sites:

- `src/hooks/useDocuments.ts` (all mutations + `useEfinsignUsage`)
- `src/pages/DocSignSign.tsx` (`get_signing_url` — no org needed if we resolve org via the signer's document; keep it optional there)
- `src/components/docsign/DocumentDetailDialog.tsx` (`download_signed`, `audit_log`, `refresh_status`)

Add a tiny helper `invokeEfinsign(action, payload)` in `src/lib/docsign/` that injects `organization_id` from `useOrganizationContext` to avoid repeating it.

## Technical notes

- The eFinSign side never receives our local `organization_id` — it stays a server-side authorization signal only.
- The literal eFinSign-side org id (`023daa82-...`) doesn't need to be stored anywhere; the API key implicitly scopes to it.
- No DB migration is required for this pass. `documents.organization_id` already exists and is what we filter on.
- Failure mode we're closing: today a signed-in user with any org membership can pass an arbitrary `documents.id` and act on it via the proxy because RLS is bypassed by the service-role client inside the function.

## Out of scope

- Per-tenant template libraries on eFinSign (would need a mapping table).
- Reworking the webhook to also cross-check org before status updates (safe today because updates are keyed by `efinsign_document_id`, which is unique).
