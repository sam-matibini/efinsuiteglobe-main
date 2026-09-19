# Switch Resend to your own API key

## What this is

Resend already powers every email the system sends (team invites, welcome, case decisions, alerts, report confirmations) through Lovable's managed Resend connection. You want the system to send through **your own Resend account and API key** instead, so sending volume, domains and logs live in your Resend dashboard.

## What will happen

1. **Reconnect with your key** — the Resend connection card opens; you choose to reconnect with your own API key (from your Resend dashboard → API Keys, starts with `re_`). No code changes are needed: every email the app sends keeps flowing through the same setup, now billed and logged under your Resend account.
2. **Verify it works** — I send a test email from App admin > Integrations and confirm it lands in the email log as "sent" under your key.
3. **Roadmap note** — the notepad records the switch as done, with the still-open follow-up below.

## Still open afterwards (unchanged)

- **Sending domain** — until a domain you own (e.g. eterfaceid.com) is verified in your Resend dashboard, emails can only be delivered to your own address. Verifying the domain in Resend is a step only you can do there (add the DNS records Resend shows you); once done, I update the sender address in App admin > Company details.

## Technical details

- The Resend connector is re-linked in BYOK mode via `standard_connectors--reconnect`; the linked `RESEND_API_KEY` env var then holds your key.
- `src/lib/email.server.ts` is untouched — it already routes through the connector gateway with `RESEND_API_KEY`; the key swap happens at the connection level.
- No downtime: emails keep sending with the managed key until your key is in place.
