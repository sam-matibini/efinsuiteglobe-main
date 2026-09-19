# Verify eterfaceid.com in Resend and go live

The TXT record (`resend-domain-verification=458b9d3df3bcfc8022b4648fed4294e5`) is confirmed publicly visible on eterfaceid.com.

## Steps

1. **Verify the domain claim** — call Resend's claim-verify endpoint for eterfaceid.com through the connector gateway (domain id f20e62f8-0f03-46c2-ba76-88e4014bf293, claim id 2019aedd-6cfb-401a-abe5-d12c4100600b).
2. **Collect the DKIM/SPF records** Resend issues after the claim succeeds and give them to Sam to paste at IONOS (Domain → DNS), with exact host and value for each.
3. **Wait for Sam's confirmation** that the DKIM/SPF records are added, then re-check verification status. (DNS can take minutes to a few hours to propagate.)
4. **Once Resend shows the domain verified** — send a test email from App admin > Integrations to a real external address and confirm the email log shows it accepted.
5. **Update project memory** with the verified sender domain (support@eterfaceid.com).

## Notes

- Sender address is already `support@eterfaceid.com`, so no app changes are needed — once the domain verifies, invites, decisions, alerts and reports all reach customers.
- If the claim fails, retry once after a few minutes (DNS caching), then report back.
