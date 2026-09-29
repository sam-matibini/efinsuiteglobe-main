# Accounts and teams

Turn the console from one shared workspace into a proper multi-company product: anyone can sign up, name their company, and invite colleagues by email. Each company sees only its own cases, documents, transactions, reports, keys and audit trail.

## What people will see

**Sign up**
- The sign-up screen asks for work email, password and company name.
- Creating the account creates the company and makes that person its owner.
- Sign-in stays as it is (email/password or Google). A Google sign-up with no team yet lands on a short "name your company or enter your invite" screen.

**Invited people**
- An owner or admin invites a colleague by email from Settings, choosing their access level.
- The invite link opens sign-up with the email pre-filled and the company already attached — accepting it puts them straight in the team, no company creation.
- Pending invites are listed with the option to resend or cancel. Invites expire after 14 days.

**Team settings**
- Settings gets a "Your team" section: company name, who is in it, each person's access level, pending invites.
- Access levels stay Admin / Analyst / Viewer, now scoped to the company. The person who signs up is Admin and cannot be removed by others; removing someone revokes their access immediately.
- API keys and webhooks become per-company, so one company's keys can never read another's cases.

**Header**
- The public site header keeps "Sign in" when signed out and shows the company name with a menu (Console, Team settings, Sign out) when signed in.

## Data separation

Every record already in the system gains an owning company, and the access rules are rewritten so a signed-in person can only ever read or write rows belonging to a company they are a member of. This covers cases, checks, addresses, owners, screening runs and hits, documents, selfies, verification sessions, device signals, risk factors, transactions and their alerts, monitoring alerts, regulatory reports, API keys, webhooks, deliveries, and the audit trail.

Sanctions and PEP watchlists stay shared — they are public reference data, identical for everyone.

Existing records (the demo cases, keys and audit entries created so far) are moved into your own company so nothing is lost.

## Technical section

New tables (all with grants, RLS, and updated_at triggers where relevant):
- `organizations` — name, slug, created_by.
- `organization_members` — org_id, user_id, role (reuses `app_role`), unique (org_id, user_id). Replaces the global `user_roles` as the authorization source; `user_roles` is kept and mirrored for backwards compatibility only until all call sites move.
- `organization_invites` — org_id, email (citext-normalised), role, token hash, invited_by, expires_at, accepted_at, revoked_at.

Security-definer helpers (search_path = public), used by every policy to avoid recursive RLS:
- `current_org_ids()` → set of org ids the caller belongs to
- `is_org_member(_org uuid)`, `has_org_role(_org uuid, _role app_role)`, `can_write_org(_org uuid)`

Migration steps:
1. Create the three tables + helpers.
2. Add `org_id uuid` to every tenant table; backfill from the current owner (or the first organization created for the existing admin); set NOT NULL; index `org_id`; FK to `organizations`.
3. Drop and recreate all RLS policies on those tables in terms of `is_org_member(org_id)` / `can_write_org(org_id)`, preserving the existing append-only rules (no delete on audit_events, documents, selfies, reports, deliveries).
4. Replace `handle_new_user()`: it no longer grants a global admin role; it only creates the `profiles` row. Team membership is created by the signup/accept server functions.

Server functions (`src/lib/teams.functions.ts`, all `requireSupabaseAuth` + audit-logged):
- `createOrganization({ name })` — refuses if the caller already belongs to one; inserts org + admin membership.
- `inviteMember({ email, role })` — admin-gated, stores a hashed random token, returns the invite link; email delivery via the existing transactional path if configured, otherwise the link is shown to copy.
- `acceptInvite({ token })` — validates hash/expiry, creates membership for the signed-in user, marks accepted.
- `revokeInvite`, `setMemberRole`, `removeMember` — admin-gated, cannot remove the last admin.

Client:
- `useSession.ts` gains `useOrganization()` (current org + role) backed by `organization_members`; `useRoles` reads the org-scoped role.
- `_authenticated/route.tsx` stays as-is; a new `console.onboarding.tsx` handles "signed in but no team" (create company or paste invite).
- `/auth` gains a company-name field in sign-up mode and reads `?invite=<token>` to pre-fill and auto-accept after confirmation.
- New route `/invite/$token` (public) → stores the token and forwards to `/auth`.
- Settings: new Team panel (members, role select, invite form, pending invites).
- Header: session-aware account menu with sign-out (cancel queries → clear cache → signOut → replace-navigate to `/auth`).

Public API: `authenticateApiRequest` resolves the key's `org_id` and every v1 route filters and inserts with that org, so API access is tenant-scoped too.
