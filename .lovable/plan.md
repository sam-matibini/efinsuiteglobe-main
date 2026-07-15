# Delete Organization Feature

Add a "Delete Organization" action in Settings that removes the org and its dependent records safely via a Supabase edge function with authorization checks.

## 1. Edge function: `delete-organization`

New file: `supabase/functions/delete-organization/index.ts`

- Accepts `{ organization_id: string, confirm_name: string }`.
- Validates JWT from `Authorization` header using anon client → resolves `user.id`.
- Uses service-role client for privileged checks and deletes.
- Authorization checks (all must pass):
  - Caller is a member of the org with role `owner`, OR caller has global `admin` role in `user_roles`.
  - `confirm_name` matches the organization's `name` exactly (typed-to-confirm safeguard).
- Deletes the organization row. Relies on existing `ON DELETE CASCADE` FKs for dependent tables; for tables without cascade, explicitly delete in order:
  - `organization_members`, `organization_invitations`, `organization_modules`, `subscriptions`, `audit_logs` (for this org), then `organizations`.
  - Wrap in a Postgres function `public.delete_organization_cascade(org_id uuid)` (SECURITY DEFINER) called via `supabase.rpc` to keep the deletion atomic. The function re-verifies the caller passed in `_actor uuid` is owner/admin.
- Writes a final `audit_logs` entry (action `organization.deleted`) before the row is removed.
- Returns `{ success: true }` or a 4xx with error message. CORS enabled.

## 2. Database migration

New migration adds `public.delete_organization_cascade(_org_id uuid, _actor uuid)`:
- `SECURITY DEFINER`, `search_path = public`.
- Verifies `_actor` is owner via `organization_members` or admin via `has_role(_actor,'admin')`.
- Performs ordered DELETE on child tables that lack cascade, then `DELETE FROM organizations WHERE id = _org_id`.
- Grants EXECUTE to `authenticated`.

## 3. Frontend: Delete button + confirmation dialog

Edit `src/pages/Settings.tsx` (General tab):

- Add a "Danger Zone" card at the bottom of the General tab, only rendered when the current user's role in this org is `owner` (or `isAdmin`). Uses `organization_members` role fetched via existing hooks.
- Card contains a red "Delete Organization" button that opens `DeleteOrganizationDialog`.

New component: `src/components/settings/DeleteOrganizationDialog.tsx`

- shadcn `AlertDialog` with:
  - Warning text listing what will be deleted (members, invitations, subscription, modules, and all org data via cascade).
  - Text input requiring the user to type the organization's exact name to enable the destructive button.
  - "Delete permanently" button calls `supabase.functions.invoke('delete-organization', { body: { organization_id, confirm_name } })`.
- On success:
  - Clear `current_organization_id` from `localStorage`.
  - `queryClient.clear()`.
  - Toast success, then `window.location.href = '/'` (redirect to landing/dashboard; org context provider will pick the next available org or the create-org flow).
- On error: toast the returned message.

## Technical notes

- Owner check on the client is UX-only; the edge function + RPC enforce authorization server-side.
- No changes to existing RLS policies required — deletion is executed with service-role via the SECURITY DEFINER RPC.
- Admins (global `user_roles.admin`) can also delete any org, matching the existing admin-bypass pattern used elsewhere in the app.

## Out of scope

- Soft-delete / 30-day recovery window (can be added later; matches Lovable account-deletion pattern if desired).
- Bulk org deletion from the admin panel (already partly present via `ManageOrganizationsDialog` — unchanged here).
- Stripe subscription cancellation side effects.
