// send-for-signing
// Called by the frontend "Send" button. Emails each pending signer their
// unique first-party signing link (/docsign?token=...) via Resend.
// Updates signer status → sent, document status → sent.
// Fires document.sent webhook after emails go out.
//
// Requires: RESEND_API_KEY secret, RESEND_FROM_EMAIL secret (optional).
// Authorization: caller must be document owner or org member.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const APP_URL = 'https://efinsuite.com';
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'info@efinsuite.com';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY secret is not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`Resend ${res.status}: ${err}`);
  }
}

// Fire webhooks registered for this org that subscribe to the given event.
// Failures are logged but never thrown — webhooks must not block the main flow.
async function fireWebhooks(organizationId: string, event: string, payload: unknown): Promise<void> {
  const { data: hooks } = await admin
    .from('document_webhooks')
    .select('id, url, secret')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .contains('events', [event]);

  if (!hooks || hooks.length === 0) return;

  const body = JSON.stringify({ event, created_at: new Date().toISOString(), data: payload });

  await Promise.allSettled(
    hooks.map(async (hook: { id: string; url: string; secret: string | null }) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-EfinSuite-Event': event,
      };

      if (hook.secret) {
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(hook.secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        );
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
        headers['X-EfinSuite-Signature'] = `sha256=${Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
      }

      const res = await fetch(hook.url, { method: 'POST', headers, body });
      if (!res.ok) {
        console.warn(`webhook ${hook.id} → ${hook.url} returned ${res.status}`);
      }
    }),
  );
}

function signingEmailHtml({
  signerName, documentTitle, orgName, signingUrl, expiresAt,
}: {
  signerName: string;
  documentTitle: string;
  orgName: string;
  signingUrl: string;
  expiresAt?: string;
}): string {
  const expiry = expiresAt
    ? `<p style="margin:0 0 16px;color:#9ca3af;font-size:12px;text-align:center">Link expires ${new Date(expiresAt).toLocaleDateString('en-CA')}.</p>`
    : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <div style="background:#0f172a;padding:24px 32px">
    <span style="color:#ffffff;font-size:18px;font-weight:700">eFinsuite DocSign</span>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">You've been asked to sign a document</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
      <strong>${orgName}</strong> has sent you <strong>${documentTitle}</strong> for your electronic signature.
    </p>
    ${signerName ? `<p style="margin:0 0 24px;color:#374151;font-size:14px">Hi <strong>${signerName}</strong>,</p>` : ''}
    <p style="margin:0 0 24px;color:#374151;font-size:14px">
      Please click the button below to review and sign the document. It only takes a minute.
    </p>
    <div style="text-align:center;margin:32px 0">
      <a href="${signingUrl}"
         style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:600">
        Review &amp; Sign
      </a>
    </div>
    ${expiry}
    <p style="margin:24px 0 0;color:#9ca3af;font-size:12px">
      If the button doesn't work, copy this link:<br>
      <span style="color:#4f46e5;word-break:break-all">${signingUrl}</span>
    </p>
  </div>
  <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
    <p style="margin:0;color:#9ca3af;font-size:11px">
      Powered by eFinsuite DocSign &middot; This email was sent because ${orgName} added you as a signer.
    </p>
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  // Verify the caller's JWT
  const { data: { user }, error: userErr } = await admin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (userErr || !user) return json({ error: 'Invalid token' }, 401);

  const body = await req.json().catch(() => ({})) as { document_id?: string };
  const documentId = body.document_id;
  if (!documentId) return json({ error: 'document_id required' }, 400);

  // Load document
  const { data: doc, error: dErr } = await admin
    .from('documents')
    .select('id, title, organization_id, owner_id, status')
    .eq('id', documentId)
    .single();
  if (dErr || !doc) return json({ error: 'Document not found' }, 404);

  // Authorise: owner or org member
  if (doc.owner_id !== user.id) {
    const { data: mem } = await admin
      .from('organization_members')
      .select('id')
      .eq('organization_id', doc.organization_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!mem) return json({ error: 'Not authorised to send this document' }, 403);
  }

  // Org name for email branding
  const { data: org } = await admin
    .from('organizations')
    .select('name')
    .eq('id', doc.organization_id)
    .maybeSingle();
  const orgName = org?.name ?? 'eFinsuite';

  // Load signers that haven't signed or declined yet
  const { data: signers, error: sErr } = await admin
    .from('document_signers')
    .select('id, email, name, signing_token, signer_expires_at, status, signing_order')
    .eq('document_id', documentId)
    .not('status', 'in', '("signed","declined")')
    .order('signing_order');
  if (sErr) return json({ error: `Could not load signers: ${sErr.message}` }, 500);
  if (!signers || signers.length === 0) return json({ error: 'No pending signers on this document' }, 400);

  const results: { email: string; status: 'sent' | 'error'; error?: string }[] = [];

  for (const signer of signers) {
    const signingUrl = `${APP_URL}/docsign?token=${signer.signing_token}`;
    try {
      await sendEmail(
        signer.email,
        `Action required: sign "${doc.title}"`,
        signingEmailHtml({
          signerName: signer.name ?? '',
          documentTitle: doc.title,
          orgName,
          signingUrl,
          expiresAt: signer.signer_expires_at ?? undefined,
        }),
      );
      await admin.from('document_signers').update({ status: 'sent' }).eq('id', signer.id);
      results.push({ email: signer.email, status: 'sent' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      console.error(`send-for-signing: failed to email ${signer.email}:`, msg);
      results.push({ email: signer.email, status: 'error', error: msg });
    }
  }

  const sentCount = results.filter(r => r.status === 'sent').length;
  if (sentCount > 0) {
    await admin.from('documents').update({ status: 'sent' }).eq('id', documentId);

    // Fire document.sent webhook (fire-and-forget)
    fireWebhooks(doc.organization_id, 'document.sent', {
      document_id: doc.id,
      title: doc.title,
      organization_id: doc.organization_id,
      sent_to: results.filter(r => r.status === 'sent').map(r => r.email),
    }).catch(e => console.warn('fireWebhooks document.sent:', e));
  }

  return json({ sent: sentCount, total: signers.length, results });
});
