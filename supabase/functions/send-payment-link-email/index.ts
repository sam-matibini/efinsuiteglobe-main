// Sends a payment link email with efinsuite banner via the existing resend-integration.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BRAND_NAME = 'efinsuite';
const BRAND_COLOR = '#0f172a';
const ACCENT = '#0ea5e9';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function logEmailFailure(supabase: ReturnType<typeof createClient>, linkId: string, error: string) {
  await supabase.from('payment_link_events').insert({
    payment_link_id: linkId,
    event_type: 'email_failed',
    payload: { error },
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function buildHtml(opts: {
  payerName: string | null;
  amount: number;
  currency: string;
  description: string | null;
  reference: string;
  payUrl: string;
  orgName: string | null;
}) {
  const greeting = opts.payerName ? `Hi ${escapeHtml(opts.payerName)},` : 'Hello,';
  const desc = opts.description ? `<p style="margin:0 0 12px;color:#374151;font-size:14px;">${escapeHtml(opts.description)}</p>` : '';
  const from = opts.orgName ? `from <strong>${escapeHtml(opts.orgName)}</strong>` : '';
  const amount = `${opts.amount.toFixed(2)} ${escapeHtml(opts.currency)}`;
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:${BRAND_COLOR};padding:20px 24px;border-radius:8px 8px 0 0;">
      <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">${BRAND_NAME}</div>
      <div style="color:#cbd5e1;font-size:12px;margin-top:4px;">Secure payment request</div>
    </div>
    <div style="padding:28px 24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;">
      <p style="margin:0 0 12px;color:#111827;font-size:15px;">${greeting}</p>
      <p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.5;">
        You have a new payment request ${from} for
        <strong style="color:#111827;">${amount}</strong>
        (Ref: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:12px;">${escapeHtml(opts.reference)}</code>).
      </p>
      ${desc}
      <div style="text-align:center;margin:28px 0;">
        <a href="${opts.payUrl}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Pay ${amount}</a>
      </div>
      <p style="margin:16px 0 0;color:#6b7280;font-size:12px;line-height:1.5;">
        Or paste this link into your browser:<br>
        <a href="${opts.payUrl}" style="color:${ACCENT};word-break:break-all;">${opts.payUrl}</a>
      </p>
      <p style="margin:24px 0 0;color:#9ca3af;font-size:11px;">
        Powered by ${BRAND_NAME}. If you weren't expecting this email, you can safely ignore it.
      </p>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { link_id } = await req.json();
    if (!link_id || typeof link_id !== 'string') {
      return json({ error: 'link_id required' }, 400);
    }

    // RLS enforces org membership
    const { data: link, error: lErr } = await supabase
      .from('payment_links')
      .select('id, reference, amount, currency, description, payer_name, payer_email, organization_id, status')
      .eq('id', link_id)
      .single();
    if (lErr || !link) {
      return json({ error: 'Payment link not found' }, 404);
    }
    if (!link.payer_email) {
      return json({ error: 'No payer email on this link' }, 400);
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('name, email_from_name, email_from_address')
      .eq('id', link.organization_id)
      .single();

    const origin = req.headers.get('origin') || 'https://www.efinsuite.com';
    const payUrl = `${origin}/pay/${link.id}`;

    const html = buildHtml({
      payerName: link.payer_name,
      amount: Number(link.amount),
      currency: link.currency,
      description: link.description,
      reference: link.reference,
      payUrl,
      orgName: org?.name ?? null,
    });

    const subject = `Payment request: ${Number(link.amount).toFixed(2)} ${link.currency} — Ref ${link.reference}`;

    // Prefer org-level sender (Settings → Payments → Email sender); fall back to RESEND_FROM secret.
    const orgFromAddress = (org?.email_from_address ?? '').trim();
    const orgFromName = (org?.email_from_name ?? '').trim();
    const orgFrom = orgFromAddress
      ? (orgFromName ? `${orgFromName} <${orgFromAddress}>` : orgFromAddress)
      : '';
    const rawFrom = orgFrom || Deno.env.get('RESEND_FROM') || '';
    if (!rawFrom) {
      const error = 'Payment link created, but email was not sent because no sender is configured. Set the "From email" in Settings → Payments → Email sender, using a domain verified at resend.com/domains.';
      await logEmailFailure(supabase, link.id, error);
      return json({ success: false, setupRequired: true, error });
    }

    // Normalize common mistakes: surrounding whitespace/quotes, trailing punctuation
    const configuredFrom = rawFrom
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/[.,;]+$/, '')
      .trim();

    // Validate against Resend's accepted formats: `email@example.com` or `Name <email@example.com>`
    const emailOnly = /^[^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+$/;
    const nameWrapped = /^[^<>]+<\s*[^\s<>@"]+@[^\s<>@"]+\.[^\s<>@"]+\s*>$/;
    if (!emailOnly.test(configuredFrom) && !nameWrapped.test(configuredFrom)) {
      const error = 'Email not sent: the configured sender is not a valid email. Set "From email" in Settings → Payments → Email sender to a valid address on a domain verified at resend.com/domains.';
      await logEmailFailure(supabase, link.id, error);
      return json({ success: false, setupRequired: true, error });
    }

    // Send via Resend integration (direct fetch so we can read 4xx error bodies)
    const resendUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/resend-integration`;
    const resp = await fetch(resendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        apikey: Deno.env.get('SUPABASE_ANON_KEY')!,
      },
      body: JSON.stringify({
        action: 'send-email',
        to: link.payer_email,
        from: configuredFrom,
        subject,
        html,
        includeBranding: true,
      }),
    });
    let sendRes: any = null;
    try { sendRes = await resp.json(); } catch { /* ignore parse errors */ }
    if (!resp.ok || (sendRes && sendRes.success === false)) {
      const detail = sendRes?.error || sendRes?.message || `Resend returned ${resp.status}`;
      console.error('resend-integration failure:', resp.status, detail, 'body:', sendRes);
      let error = `Email send failed: ${detail}`;
      if (/domain is not verified/i.test(detail)) {
        error = `Email send failed: Resend says the sender domain is not verified for the API key currently configured. The RESEND_API_KEY in Lovable Cloud is from a different Resend account/team than the one where the domain is verified. Generate a new API key in the SAME Resend team where the domain appears as Verified (resend.com/api-keys), then update the RESEND_API_KEY secret.`;
      }
      await logEmailFailure(supabase, link.id, error);
      const setupRequired = /verify a domain|from address|sender|domain is not verified/i.test(detail);
      return json({ success: false, setupRequired, error });
    }

    // Best-effort event log
    await supabase.from('payment_link_events').insert({
      payment_link_id: link.id,
      event_type: 'email_sent',
      payload: { to: link.payer_email, subject },
    });

    return json({ success: true, send: sendRes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('send-payment-link-email error:', msg);
    return json({ error: msg }, 500);
  }
});
