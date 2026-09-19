# Make your account the administrator

Your account (smatibini.sm@gmail.com) was created a moment ago and its email is confirmed. It currently has the lowest level of access — view only — because the temporary test account I made earlier took the "first account becomes administrator" slot.

## What I will change

1. Give your account full administrator access: work cases, decide screening matches, record transactions, build reports, manage people's access, create API keys and webhooks.
2. Remove the administrator access from the temporary test account (qa.temp@example.com) so it can no longer do anything. Its sign-in record can't be deleted from here, but with no access level it is inert.
3. Record both changes in the audit trail, the same way any access change is recorded.

## After that

Sign out and back in at the sign-in page, and the console will show everything, including Settings, where you can invite and set the access level for the rest of your team.

## Technical notes

- Update `public.user_roles`: set role `admin` for user `d9b1f840-e1e0-4fd9-9194-3502adda28c1`, delete the `admin` row for `228ee2b9-a474-4d94-b7a0-9e5b01d5d175`.
- Insert matching `audit_events` rows (`role.granted`, `role.revoked`) so the change is not silent.
- This is data only — no schema change, no code change.
