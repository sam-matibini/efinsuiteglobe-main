## Plan: Backend for `/contact` form via Resend

### 1. New edge function `supabase/functions/send-contact-message/index.ts`
- Public (no JWT required — form is on unauthenticated `/contact` page).
- CORS-enabled (OPTIONS handler + headers on every response).
- Validates body with Zod: `name` (1–100), `email` (email, ≤255), `subject` (1–150), `message` (10–2000). Returns 400 with field errors on failure.
- Basic anti-abuse: honeypot field `website` (must be empty) + reject if body missing/oversized.
- Reads `RESEND_API_KEY` from env (already configured — used by existing `resend-integration`). If missing, returns 500 with a clear message.
- Sends two emails via `https://api.resend.com/emails`:
  1. **To support:** `to: support@efin.money`, `from: "efinsuite Contact <info@efinsuite.com>"` (matches existing `RESEND_FROM_EMAIL`), `reply_to: <submitter email>`, subject `"[Contact] <subject>"`, HTML body with name/email/subject/message (HTML-escaped).
  2. **Auto-acknowledgement to submitter:** short branded "we received your message" HTML, subject `"We received your message — efinsuite Globe"`.
- On Resend non-2xx, log status + body and return `{ error, status, details }` with the provider status.
- Success response: `{ success: true }`.

### 2. Wire the frontend form in `src/pages/Contact.tsx`
- Replace the current `mailto:` handoff in `handleSubmit` with `supabase.functions.invoke('send-contact-message', { body: parsed.data })`.
- Add hidden honeypot input `website` (visually hidden, `tabIndex={-1}`, `autoComplete="off"`) included in the payload.
- On success: keep the existing toast (adjusted copy: "Message sent — we'll reply within one business day."), reset the form.
- On error: read `FunctionsHttpError.context` for details, show destructive toast with a concise message.
- Keep Zod client-side validation as-is.

### 3. No config.toml change needed
Lovable-managed functions default to `verify_jwt = false` in this project, so the public contact endpoint works out of the box; the function still validates input server-side.

### Technical notes
- `from` uses the already-verified `info@efinsuite.com` (per existing `resend-integration` defaults) so we don't require any new domain setup.
- No new secrets required — `RESEND_API_KEY` is already present.
- No DB tables, migrations, or RLS changes.

### Out of scope
- Persisting submissions to a `contact_messages` table (can be added later if desired).
- Rate limiting beyond the honeypot.
