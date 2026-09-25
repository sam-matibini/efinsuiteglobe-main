// Sends a branded CRA tax-payment confirmation receipt email and logs the event.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BRAND_NAME = 'efinsuite';
const BRAND_COLOR = '#0f172a';
const ACCENT = '#0ea5e9';

const TYPE_LABEL: Record<string, string> = {
  source_deductions: 'CRA Source Deductions (PD7A)',
  gst_hst: 'GST/HST Remittance',
  corporate_tax: 'Corporate Income Tax',
  provision: 'Income Tax Provision',
  withholding: 'Withholding Tax',
  other: 'Other Tax Payment',
};

function esc(s: unknown) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
function fmt(n: number | null | undefined, currency = 'CAD') {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${esc(currency)}`;
}

function buildHtml(opts: {
  payment: Record<string, any>;
  org: Record<string, any> | null;
  cra: Record<string, any> | null;
}) {
  const { payment, org, cra } = opts;
  const periodLabel = payment.period_start && payment.period_end
    ? `${payment.period_start} – ${payment.period_end}` : '—';
  const isPayroll = payment.payment_type === 'source_deductions';

  const pd7aRows = isPayroll && payment.income_tax != null ? `
    <tr><td style="padding:8px 0;color:#374151;">Income tax (Federal + Provincial)</td><td style="padding:8px 0;text-align:right;font-variant-numeric:tabular-nums;">${fmt(payment.income_tax, payment.currency)}</td></tr>
    <tr><td style="padding:8px 0;color:#374151;">CPP — employee</td><td style="padding:8px 0;text-align:right;font-variant-numeric:tabular-nums;">${fmt(payment.cpp_employee, payment.currency)}</td></tr>
    <tr><td style="padding:8px 0;color:#374151;">CPP — employer</td><td style="padding:8px 0;text-align:right;font-variant-numeric:tabular-nums;">${fmt(payment.cpp_employer, payment.currency)}</td></tr>
    <tr><td style="padding:8px 0;color:#374151;">EI — employee</td><td style="padding:8px 0;text-align:right;font-variant-numeric:tabular-nums;">${fmt(payment.ei_employee, payment.currency)}</td></tr>
    <tr><td style="padding:8px 0;color:#374151;">EI — employer (1.4×)</td><td style="padding:8px 0;text-align:right;font-variant-numeric:tabular-nums;">${fmt(payment.ei_employer, payment.currency)}</td></tr>
  ` : '';

  const headerInfo = isPayroll ? `
    <p style="margin:4px 0;color:#374151;font-size:13px;">Number of employees: <strong>${esc(payment.number_of_employees ?? '—')}</strong></p>
    <p style="margin:4px 0;color:#374151;font-size:13px;">Gross payroll: <strong>${fmt(payment.gross_payroll, payment.currency)}</strong></p>
  ` : '';

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;">
    <div style="background:${BRAND_COLOR};padding:20px 24px;border-radius:8px 8px 0 0;">
      <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">${BRAND_NAME}</div>
      <div style="color:#cbd5e1;font-size:12px;margin-top:4px;">Payment confirmation receipt</div>
    </div>
    <div style="padding:28px 24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px;">
      <h1 style="margin:0 0 4px;font-size:20px;color:#111827;">CRA Payment Receipt</h1>
      <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">Reference: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${esc(payment.reference)}</code></p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="vertical-align:top;width:50%;padding-right:12px;">
            <div style="font-weight:700;color:#111827;font-size:13px;">Employer</div>
            <div style="color:#374151;font-size:13px;">${esc(org?.name ?? '—')}</div>
            <div style="color:#6b7280;font-size:12px;">${esc(org?.address ?? '')}</div>
          </td>
          <td style="vertical-align:top;width:50%;">
            <div style="font-weight:700;color:#111827;font-size:13px;">Account</div>
            <div style="color:#374151;font-size:13px;">${esc(cra?.account_name ?? TYPE_LABEL[payment.payment_type] ?? payment.payment_type)}</div>
            <div style="color:#6b7280;font-size:12px;">${cra ? esc(cra.full_account_number) : ''}</div>
          </td>
        </tr>
      </table>

      <div style="background:#eff6ff;padding:14px 16px;border-radius:6px;margin:16px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="color:#111827;font-size:14px;">${esc(TYPE_LABEL[payment.payment_type] ?? payment.payment_type)}</strong>
          <span style="color:#374151;font-size:13px;">Period: ${esc(periodLabel)}</span>
        </div>
        ${headerInfo}
      </div>

      ${pd7aRows ? `<table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;">${pd7aRows}</table>` : ''}

      <div style="background:${BRAND_COLOR};color:#ffffff;padding:14px 16px;border-radius:6px;margin-top:16px;display:flex;justify-content:space-between;align-items:center;">
        <strong style="font-size:14px;letter-spacing:0.04em;">TOTAL REMITTANCE PAID</strong>
        <strong style="font-size:18px;font-variant-numeric:tabular-nums;">${fmt(payment.amount, payment.currency)}</strong>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:12px;color:#6b7280;">
        <tr><td style="padding:4px 0;">Payment method</td><td style="padding:4px 0;text-align:right;color:#111827;text-transform:capitalize;">${esc(String(payment.payment_method ?? '').replace(/_/g,' '))}</td></tr>
        <tr><td style="padding:4px 0;">Paid date</td><td style="padding:4px 0;text-align:right;color:#111827;">${esc((payment.paid_at ?? '').slice(0,10) || '—')}</td></tr>
        <tr><td style="padding:4px 0;">Confirmation #</td><td style="padding:4px 0;text-align:right;color:#111827;font-family:monospace;">${esc(payment.confirmation_number ?? '—')}</td></tr>
      </table>

      <p style="margin:24px 0 0;color:#9ca3af;font-size:11px;">
        This is an automated confirmation generated by ${BRAND_NAME} after your CRA remittance was processed. Keep this receipt for your records.
      </p>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined,
    );

    const body = await req.json().catch(() => ({}));
    const { tax_payment_id, recipient_email, recipient_name } = body || {};
    if (!tax_payment_id || typeof tax_payment_id !== 'string') {
      return new Response(JSON.stringify({ error: 'tax_payment_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: payment, error: pErr } = await supabase
      .from('tax_payments').select('*').eq('id', tax_payment_id).single();
    if (pErr || !payment) {
      return new Response(JSON.stringify({ error: 'Payment not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: org } = await supabase
      .from('organizations').select('name, address').eq('id', payment.organization_id).maybeSingle();

    let cra: any = null;
    if (payment.cra_account_id) {
      const { data } = await supabase
        .from('cra_program_accounts').select('account_name, full_account_number').eq('id', payment.cra_account_id).maybeSingle();
      cra = data;
    }

    // Resolve recipient: explicit > payment.metadata.receipt_recipients[0] > nothing
    const fallbackEmail = payment?.metadata?.receipt_recipients?.[0];
    const to = (recipient_email && typeof recipient_email === 'string') ? recipient_email : fallbackEmail;
    if (!to) {
      return new Response(JSON.stringify({ error: 'No recipient email provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const html = buildHtml({ payment, org, cra });
    const subject = `CRA payment receipt — ${payment.reference} ($${Number(payment.amount).toFixed(2)} ${payment.currency})`;

    const { data: sendRes, error: sErr } = await supabase.functions.invoke('resend-integration', {
      body: { action: 'send-email', to, subject, html, includeBranding: true },
    });
    if (sErr) throw sErr;

    await supabase.from('tax_payment_events').insert({
      organization_id: payment.organization_id,
      tax_payment_id: payment.id,
      event_type: 'receipt_sent',
      recipient: to,
      payload: { subject, recipient_name: recipient_name ?? null },
    });

    return new Response(JSON.stringify({ success: true, send: sendRes }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('send-tax-payment-receipt error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
