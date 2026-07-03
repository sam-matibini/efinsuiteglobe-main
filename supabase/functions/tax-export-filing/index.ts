// supabase/functions/tax-export-filing/index.ts
// Exports a filing period's data as CSV or XML for upload to CRA / state portals.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ExportInput {
  period_id: string;
  format?: 'csv' | 'xml';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const escXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!),
  );

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as ExportInput;
    if (!body.period_id || typeof body.period_id !== 'string') {
      return new Response(JSON.stringify({ error: 'period_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const fmt = body.format ?? 'csv';
    if (fmt !== 'csv' && fmt !== 'xml') {
      return new Response(JSON.stringify({ error: "format must be 'csv' or 'xml'" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: period, error: periodErr } = await sb
      .from('tax_filing_periods')
      .select(
        'id, organization_id, period_start, period_end, due_date, status, tax_authority_id, tax_authorities(name, region, reporting_currency)',
      )
      .eq('id', body.period_id)
      .maybeSingle();

    if (periodErr || !period) {
      return new Response(JSON.stringify({ error: 'Period not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orgId = (period as any).organization_id as string;
    const start = (period as any).period_start as string;
    const end = (period as any).period_end as string;
    const auth = (period as any).tax_authorities ?? {};
    const authorityId = (period as any).tax_authority_id as string | null;

    interface ExportRow {
      source: string;
      ref: string;
      date: string;
      tax_type: string;
      tax_code: string;
      jurisdiction: string;
      rate: number;
      taxable: number;
      tax: number;
      recoverable: boolean;
    }

    const rows: ExportRow[] = [];
    let totalCollected = 0;
    let totalItc = 0;

    // GL-derived tax movements (single source of truth across invoices, bills,
    // expenses, bank categorisations, and manual journal entries).
    const { data: movements, error: movErr } = await (sb.rpc as any)(
      'get_tax_movements_by_code',
      { p_org_id: orgId, p_start_date: start, p_end_date: end },
    );
    if (movErr) {
      return new Response(JSON.stringify({ error: movErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const m of (movements ?? []) as any[]) {
      if (authorityId && m.authority_id && m.authority_id !== authorityId) continue;
      const taxAmount = Number(m.tax_amount ?? 0);
      const taxableAmount = Number(m.taxable_amount ?? 0);
      const recoverable = m.is_recoverable !== false;
      rows.push({
        source: m.side === 'collected' ? 'sales' : 'purchases',
        ref: m.account_code ?? m.code ?? '',
        date: end,
        tax_type: m.tax_type ?? 'sales',
        tax_code: m.code ?? '',
        jurisdiction: m.jurisdiction ?? '',
        rate: Number(m.rate ?? 0),
        taxable: taxableAmount,
        tax: taxAmount,
        recoverable,
      });
      if (m.side === 'collected') totalCollected += taxAmount;
      else if (recoverable) totalItc += taxAmount;
    }

    totalCollected = round2(totalCollected);
    totalItc = round2(totalItc);
    const netPayable = round2(totalCollected - totalItc);

    if (fmt === 'csv') {
      const header = [
        'Source',
        'Reference',
        'Date',
        'Tax Type',
        'Tax Code',
        'Jurisdiction',
        'Rate %',
        'Taxable',
        'Tax',
        'Recoverable',
      ];
      const csvLines: string[] = [header.join(',')];
      for (const r of rows) {
        csvLines.push(
          [
            r.source,
            r.ref,
            r.date,
            r.tax_type,
            r.tax_code,
            r.jurisdiction,
            r.rate,
            r.taxable.toFixed(2),
            r.tax.toFixed(2),
            r.recoverable ? 'yes' : 'no',
          ]
            .map((v) => {
              const s = String(v);
              return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            })
            .join(','),
        );
      }
      csvLines.push('');
      csvLines.push(`Totals,,,,,,,${totalCollected.toFixed(2)},${totalItc.toFixed(2)},`);
      csvLines.push(`Net Payable,,,,,,,,${netPayable.toFixed(2)},`);
      return new Response(csvLines.join('\n'), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="tax_filing_${start}_${end}.csv"`,
        },
      });
    }

    const xmlRows = rows
      .map(
        (r) =>
          `  <Transaction source="${escXml(r.source)}" ref="${escXml(r.ref)}" date="${r.date}">` +
          `<TaxType>${escXml(r.tax_type)}</TaxType>` +
          `<TaxCode>${escXml(r.tax_code)}</TaxCode>` +
          `<Jurisdiction>${escXml(r.jurisdiction)}</Jurisdiction>` +
          `<Rate>${r.rate}</Rate>` +
          `<Taxable>${r.taxable.toFixed(2)}</Taxable>` +
          `<Tax>${r.tax.toFixed(2)}</Tax>` +
          `<Recoverable>${r.recoverable}</Recoverable>` +
          `</Transaction>`,
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TaxFilingExport>
  <Authority>${escXml(auth?.name ?? '')}</Authority>
  <Region>${escXml(auth?.region ?? '')}</Region>
  <Currency>${escXml(auth?.reporting_currency ?? 'CAD')}</Currency>
  <PeriodStart>${start}</PeriodStart>
  <PeriodEnd>${end}</PeriodEnd>
  <Totals>
    <TaxCollected>${totalCollected.toFixed(2)}</TaxCollected>
    <InputTaxCredits>${totalItc.toFixed(2)}</InputTaxCredits>
    <NetPayable>${netPayable.toFixed(2)}</NetPayable>
  </Totals>
  <Transactions>
${xmlRows}
  </Transactions>
</TaxFilingExport>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="tax_filing_${start}_${end}.xml"`,
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
