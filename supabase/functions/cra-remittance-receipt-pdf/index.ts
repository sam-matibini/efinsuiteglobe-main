// CRA Remittance Receipt PDF — returns base64 PDF for a tax_payment
import { createClient } from 'npm:@supabase/supabase-js@2';
import { jsPDF } from 'npm:jspdf@2.5.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { tax_payment_id } = await req.json();
    if (!tax_payment_id) {
      return new Response(JSON.stringify({ error: 'tax_payment_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: payment } = await supabase
      .from('tax_payments')
      .select('*, cra_program_accounts(account_name, full_account_number, program_code), bank_accounts(name), organizations(name)')
      .eq('id', tax_payment_id)
      .single();
    if (!payment) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const orgName = (payment as any).organizations?.name ?? 'Organization';
    const cra = (payment as any).cra_program_accounts;
    const bank = (payment as any).bank_accounts;

    doc.setFontSize(20); doc.text('CRA Remittance Receipt', 40, 60);
    doc.setFontSize(11); doc.setTextColor(120); doc.text(orgName, 40, 80);
    doc.setTextColor(0);

    let y = 120;
    const row = (k: string, v: string) => { doc.setFontSize(10); doc.setTextColor(120); doc.text(k, 40, y); doc.setTextColor(0); doc.setFontSize(11); doc.text(v, 220, y); y += 22; };

    row('Reference', payment.reference);
    row('Status', payment.status);
    row('Program', cra ? `${cra.account_name} (${cra.full_account_number})` : payment.payment_type);
    row('Tax type', payment.payment_type);
    row('Filing period', `${payment.period_start ?? '—'} → ${payment.period_end ?? '—'}${payment.filing_period_label ? ' (' + payment.filing_period_label + ')' : ''}`);
    row('Amount', `${Number(payment.amount).toLocaleString('en-CA', { style: 'currency', currency: payment.currency || 'CAD' })}`);
    row('Payment method', payment.payment_method);
    row('Payment rail', payment.payment_rail ?? '—');
    row('Funding bank', bank?.name ?? '—');
    row('Confirmation #', payment.confirmation_number ?? '—');
    row('Settlement ref', payment.settlement_reference ?? '—');
    row('Submitted at', payment.submitted_at ?? '—');
    row('Settled at', payment.settled_at ?? payment.paid_at ?? '—');
    if (payment.card_brand) row('Card', `${payment.card_brand} •••• ${payment.card_last4 ?? ''}`);

    doc.setFontSize(8); doc.setTextColor(140);
    doc.text(`Generated ${new Date().toISOString()} — efinsuite CRA Remittance Centre`, 40, 770);

    const base64 = doc.output('datauristring').replace('data:application/pdf;filename=generated.pdf;base64,', '');

    return new Response(JSON.stringify({ pdf_base64: base64, filename: `CRA-Receipt-${payment.reference}.pdf` }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('cra-remittance-receipt-pdf error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
