## Bulk User Invitations

Add a "Bulk Invite" action to the Users settings tab that lets admins invite many users at once, either by uploading a CSV/Excel file or pasting a list.

### UI (frontend only additions)

New `BulkInviteDialog` component opened from a "Bulk Invite" button next to the existing single-invite button in `UsersSettingsTab.tsx`.

Two tabs inside the dialog:
1. **Upload file** — accepts `.csv`, `.xlsx`. Shows a "Download template" link (email,role). Parsed with existing `xlsx`/CSV utilities already used by the import engine.
2. **Paste list** — textarea, one entry per line: `email` or `email,role`. Also accepts comma/semicolon-separated emails with a single role dropdown applied to all.

After parsing, a preview table shows every row with:
- email, role (editable per row via dropdown), status badge

Row validation runs client-side and marks each row as:
- **Valid** — well-formed email, valid role, not already a member, no pending invite
- **Invalid** — bad email format, unknown role, duplicate within the batch
- **Skipped** — already a member / already has a pending invitation (fetched from `organization_members` + `organization_invitations`)

### Seat-cap enforcement

Uses `useUsageLimits` to read `maxUsers` and current `userCount`. Valid rows are counted against remaining seats:

- If `validRows > remainingSeats` → **block sending entirely**, show a red banner: "This batch would exceed your plan limit (X seats remaining, Y valid invites). Remove rows or upgrade your plan." The Send button is disabled.
- Invalid/skipped rows are always shown in a report section but never block; they're simply not sent.

Admins (`isAdmin`) bypass the cap, matching existing behavior in `useUsageLimits`.

### Sending

On confirm, iterate valid rows and call the existing `send-invitation` edge function once per row (sequential with small concurrency, e.g. 3 at a time, to avoid Resend rate limits). Progress bar updates as each completes.

Final results screen shows:
- ✅ Sent (count + emails)
- ⚠️ Skipped (already member / already invited)
- ❌ Failed (with error message per row)
- CSV export button for the failed list so admins can fix and retry

### Files to add
- `src/components/settings/BulkInviteDialog.tsx`
- `src/components/settings/bulkInviteTemplate.ts` (template CSV generator + row parser/validator)

### Files to modify
- `src/components/settings/UsersSettingsTab.tsx` — add "Bulk Invite" button and wire dialog

### Out of scope
- No changes to the `send-invitation` edge function; reused as-is.
- No new database tables — `organization_invitations` already handles idempotency.
- No changes to role definitions.
