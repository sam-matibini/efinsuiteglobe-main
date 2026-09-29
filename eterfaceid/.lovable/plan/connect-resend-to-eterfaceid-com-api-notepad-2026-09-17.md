# Connect Resend to eterfaceID.com + API notepad

## 1. Emails send from eterfaceID.com via Resend

Today every email goes out as `support@efin.money`, which Resend refuses (that
domain is not verified in the Resend account), so only your own Gmail receives
anything. Switching the sender to eterfaceID.com requires the domain to be
verified inside the Resend account.

Steps:

1. **You, in Resend:** sign in at resend.com → Domains → Add domain → enter
   `eterfaceid.com`. Resend shows a short list of DNS records (DKIM/SPF). Add
   those records where eterfaceID.com's DNS is managed (your domain's DNS
   provider), then click Verify in Resend. Verification usually takes minutes
   to a few hours.
2. **Me, in the app:** change the sender address in App admin > Company details
   from `support@efin.money` to `support@eterfaceid.com` so every email
   (invites, welcomes, decisions, alerts, reports, test) uses the new domain.
3. Send a test email from App admin > Integrations and confirm the send log
   shows it accepted, then confirm a team invitation reaches a real external
   address.

Nothing else changes: the Resend connection, templates, notification switches
and the email log all stay as they are. Until verification completes, sends to
other people keep being refused by Resend — that is expected, not a bug.

## 2. API notepad in App admin (track every API you want to add)

A simple wish-list of integrations on App admin > Integrations, below the
existing provider switches. For each entry: name, what it is for, status
(idea / waiting on keys / connecting / live), and notes (e.g. where the key
comes from, monthly cost). Entries can be added, edited, and marked "live"
once connected. Only eterfaceID staff see it.

Technical: a new staff-only table (RLS restricted to platform staff, same as
the other App admin tables) holding the entries; the Integrations admin page
gains an "API wish list" panel; no connection logic — it is a tracker that
tells us what to wire up next, and keys for new APIs always go into the
secure store, never shown.

## 3. Task list entry

Add to the roadmap: "API notepad — track and add new APIs; entries live in
App admin > Integrations; connecting a listed API needs its keys."

## Verification

- Test email from App admin > Integrations logs as sent from
  support@eterfaceid.com.
- Wish-list entries save, edit and display on the Integrations page.
- Typecheck and build pass.
