// on-sign-complete
// Called from the signing page after a signer submits their signature.
// Checks whether all signers are done; if so, marks the document completed
// and emails everyone. Otherwise emails the owner a progress update.
//
// Auth: x-signer-token header (same token used on the signing page).
// No user JWT required — signers are not Supabase auth users.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signer-token',
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
  if (!apiKey) { console.warn('RESEND_API_KEY not set — skipping email'); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) console.error(`Resend ${res.status}:`, await res.text().catch(() => ''));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const signerToken = req.headers.get('x-signer-token');
  if (!signerToken) return json({ error: 'Missing x-signer-token' }, 401);

  const body = await req.json().catch(() => ({})) as { document_id?: string };
  const documentId = body.document_id;
  if (!documentId) return json({ error: 'document_id required' }, 400);

  // Validate the signer token belongs to this document and is signed
  const { data: signer, error: sErr } = await admin
    .from('document_signers')
    .select('id, email, name, status, document_id')
    .eq('signing_token', signerToken)
    .eq('document_id', documentId)
    .maybeSingle();

  if (sErr || !signer) return json({ error: 'Invalid signer token' }, 403);
  if (signer.status !== 'signed') return json({ error: 'Signer has not completed signing' }, 400);

  // Load document
  const { data: doc } = await admin
    .from('documents')
    .select('id, title, organization_id, owner_id, status')
    .eq('id', documentId)
    .single();
  if (!doc) return json({ error: 'Document not found' }, 404);

  // Skip if already completed (idempotent)
  if (doc.status === 'completed') return json({ status: 'completed', message: 'Already completed' });

  // Load all signers
  const { data: allSigners } = await admin
    .from('document_signers')
    .select('id, email, name, status')
    .eq('document_id', documentId);

  const pending = (allSigners ?? []).filter(s => !['signed', 'declined'].includes(s.status));
  const allDone = pending.length === 0;

  // Org name for email
  const { data: org } = await admin
    .from('organizations')
    .select('name')
    .eq('id', doc.organization_id)
    .maybeSingle();
  const orgName = org?.name ?? 'eFinsuite';

  // Owner email
  const { data: ownerData } = await admin.auth.admin.getUserById(doc.owner_id);
  const ownerEmail = ownerData?.user?.email;

  if (allDone) {
    // Mark document completed
    await admin
      .from('documents')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', documentId);

    const docUrl = `${APP_URL}/docsign`;

    // Email every signer
    for (const s of allSigners ?? []) {
      await sendEmail(
        s.email,
        `Signing complete: ${doc.title}`,
        completionHtml({ recipientName: s.name ?? s.email, documentTitle: doc.title, orgName, docUrl }),
      );
    }

    // Email owner if they're not already one of the signers
    const signerEmails = new Set((allSigners ?? []).map(s => s.email));
    if (ownerEmail && !signerEmails.has(ownerEmail)) {
      await sendEmail(
        ownerEmail,
        `All parties signed: ${doc.title}`,
        completionHtml({ recipientName: 'Document owner', documentTitle: doc.title, orgName, docUrl }),
      );
    }

    return json({ status: 'completed', message: 'Document completed. Emails sent to all parties.' });
  }

  // Still waiting on others — notify owner of progress
  if (ownerEmail) {
    await sendEmail(
      ownerEmail,
      `${signer.name || signer.email} signed ${doc.title}`,
      progressHtml({
        signerName: signer.name ?? signer.email,
        documentTitle: doc.title,
        orgName,
        pendingCount: pending.length,
        docUrl: `${APP_URL}/docsign`,
      }),
    );
  }

  return json({ status: 'pending', pending: pending.length, message: 'Owner notified of progress.' });
});

// ─── Email templates ──────────────────────────────────────────────────────────

function completionHtml({
  recipientName, documentTitle, orgName, docUrl,
}: {
  recipientName: string; documentTitle: string; orgName: string; docUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <div style="background:#0f172a;padding:24px 32px">
    <span style="color:#fff;font-size:18px;font-weight:700">eFinsuite DocSign</span>
  </div>
  <div style="padding:32px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;width:56px;height:56px;line-height:56px;background:#d1fae5;border-radius:50%;font-size:28px;text-align:center">✓</div>
    </div>
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;text-align:center">All parties have signed</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px;text-align:center">
      <strong>${documentTitle}</strong> is now fully executed.
    </p>
    <p style="margin:0 0 24px;color:#374151;font-size:14px">Hi ${recipientName}, all signers have completed <strong>${documentTitle}</strong>. The document is fully executed.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${docUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:600">View Documents</a>
    </div>
  </div>
  <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
    <p style="margin:0;color:#9ca3af;font-size:11px">Powered by eFinsuite DocSign &middot; ${orgName}</p>
  </div>
</div>
</body>
</html>`;
}

function progressHtml({
  signerName, documentTitle, orgName, pendingCount, docUrl,
}: {
  signerName: string; documentTitle: string; orgName: string; pendingCount: number; docUrl: string;
}): string {
  const pending = `${pendingCount} signer${pendingCount !== 1 ? 's' : ''} still need${pendingCount === 1 ? 's' : ''} to sign.`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <div style="background:#0f172a;padding:24px 32px">
    <span style="color:#fff;font-size:18px;font-weight:700">eFinsuite DocSign</span>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827">${signerName} signed your document</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
      <strong>${signerName}</strong> has signed <strong>${documentTitle}</strong>.
    </p>
    <p style="margin:0 0 24px;color:#374151;font-size:14px">${pending}</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${docUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:15px;font-weight:600">View Document</a>
    </div>
  </div>
  <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
    <p style="margin:0;color:#9ca3af;font-size:11px">Powered by eFinsuite DocSign &middot; ${orgName}</p>
  </div>
</div>
</body>
</html>`;
}
