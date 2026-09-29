# Finish verifying eterfaceid.com in Resend

The DKIM and SPF records for eterfaceid.com are now added at IONOS. What remains is a short confirmation sequence — no app changes.

## Steps

1. **Check the records are publicly visible** — look up the three records (resend._domainkey TXT, send TXT, send MX) from here to confirm they have propagated.
2. **Run Resend's domain verification** — ask Resend to verify eterfaceid.com (domain id f20e62f8-0f03-46c2-ba76-88e4014bf293). If DNS has not fully propagated yet, wait a few minutes and retry.
3. **Send a test email** — from App admin > Integrations, send a test email and confirm the send log shows it accepted, going out from support@eterfaceid.com.
4. **Confirm a real email to an external address** — send a team invitation (or test email) to an address that is not your own and confirm it is accepted, proving emails now reach customers.

## After this

- Every email (invites, welcomes, decisions, alerts, report confirmations) goes out from support@eterfaceid.com and reaches anyone.
- The one item that stays open is switching Resend to your own API key — reopen the reconnect card whenever you are ready.

## Technical details

- Verification goes through the existing Resend connector (connection std_01m2p7tk6desrrd3ayf7fhrh75) via the gateway; no code or settings change in the app.
- The sender address in App admin > Company details is already support@eterfaceid.com; nothing to edit.
- If verification reports a record mismatch, compare the issued values against what IONOS shows and correct the record there.
