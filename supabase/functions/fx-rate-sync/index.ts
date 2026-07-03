// FX Rate Sync — pulls daily rates from open.er-api.com (current) or
// frankfurter.dev (historical), and inserts into exchange_rates per org.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ErApiResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
}

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

// Year-anchored fallback rates vs USD for currencies not on Frankfurter
const FALLBACK_RATES_BY_YEAR: Record<string, Record<string, number>> = {
  '2024': { NGN: 900, GHS: 12.0, ZMW: 25.0, KES: 155, BIF: 2850, AED: 3.6725, SAR: 3.75 },
  '2025': { NGN: 1500, GHS: 14.5, ZMW: 27.0, KES: 129, BIF: 2900, AED: 3.6725, SAR: 3.75 },
  '2026': { NGN: 1550, GHS: 15.0, ZMW: 27.5, KES: 129, BIF: 2900, AED: 3.6725, SAR: 3.75 },
};
const DEFAULT_FALLBACK = FALLBACK_RATES_BY_YEAR['2026'];

function fallbackVsUsd(code: string, date: string): number | undefined {
  const year = date.slice(0, 4);
  return (FALLBACK_RATES_BY_YEAR[year] || DEFAULT_FALLBACK)[code];
}

const FRANKFURTER_SUPPORTED = new Set([
  'AUD','BGN','BRL','CAD','CHF','CNY','CZK','DKK','EUR','GBP','HKD','HUF','IDR',
  'ILS','INR','ISK','JPY','KRW','MXN','MYR','NOK','NZD','PHP','PLN','RON','SEK',
  'SGD','THB','TRY','USD','ZAR',
]);

const MAX_DAYS_PER_CALL = 120;

function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function fetchHistoricalRates(date: string, base: string, targets: string[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const frankTargets = targets.filter(t => FRANKFURTER_SUPPORTED.has(t) && t !== base);
  if (frankTargets.length > 0 && FRANKFURTER_SUPPORTED.has(base)) {
    try {
      const url = `https://api.frankfurter.dev/v1/${date}?base=${base}&symbols=${frankTargets.join(',')}`;
      const r = await fetch(url);
      if (r.ok) {
        const j: FrankfurterResponse = await r.json();
        for (const [k, v] of Object.entries(j.rates || {})) {
          if (typeof v === 'number' && v > 0) result[k] = v;
        }
      }
    } catch (e) {
      console.error(`Frankfurter ${date} failed:`, (e as Error).message);
    }
  }
  // USD-pivot fallback for non-supported currencies (year-anchored)
  for (const t of targets) {
    if (result[t]) continue;
    if (t === base) continue;
    const tUsd = t === 'USD' ? 1 : fallbackVsUsd(t, date);
    const bUsd = base === 'USD' ? 1 : fallbackVsUsd(base, date);
    if (tUsd && bUsd) {
      result[t] = tUsd / bUsd;
    }
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }
    const mode: 'current' | 'backfill' = body?.mode === 'backfill' ? 'backfill' : 'current';
    const today = new Date().toISOString().slice(0, 10);
    const requestedStart: string = body?.startDate || '2024-01-01';
    const endDate: string = body?.endDate || today;

    // Optional: filter to a specific org if Authorization is present
    const authHeader = req.headers.get('Authorization');
    let scopedOrgId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace('Bearer ', '');
      const { data: claims } = await userClient.auth.getClaims(token);
      if (claims?.claims?.sub) {
        const { data: profile } = await admin
          .from('profiles')
          .select('current_organization_id')
          .eq('user_id', claims.claims.sub)
          .maybeSingle();
        scopedOrgId = (profile as any)?.current_organization_id || null;
      }
    }

    let orgsQuery = admin
      .from('organizations')
      .select('id, currency')
      .eq('multi_currency_enabled', true);
    if (scopedOrgId) orgsQuery = orgsQuery.eq('id', scopedOrgId);
    const { data: orgs, error: orgErr } = await orgsQuery;
    if (orgErr) throw orgErr;

    let totalInserted = 0;
    let daysProcessed = 0;
    let nextStartDate: string | null = null;
    let chunkEndDate = endDate;
    let allDates: string[];

    if (mode === 'backfill') {
      const fullDates = eachDate(requestedStart, endDate);
      const chunk = fullDates.slice(0, MAX_DAYS_PER_CALL);
      allDates = chunk;
      if (fullDates.length > MAX_DAYS_PER_CALL) {
        const next = new Date(chunk[chunk.length - 1] + 'T00:00:00Z');
        next.setUTCDate(next.getUTCDate() + 1);
        nextStartDate = next.toISOString().slice(0, 10);
        chunkEndDate = chunk[chunk.length - 1];
      }
    } else {
      allDates = [today];
    }

    for (const org of orgs || []) {
      const baseCurrency = (org as any).currency || 'USD';

      const { data: currencies } = await admin
        .from('currencies')
        .select('code')
        .eq('organization_id', org.id)
        .eq('is_active', true);

      const targets = (currencies || [])
        .map((c: any) => c.code)
        .filter((c: string) => c !== baseCurrency);
      if (targets.length === 0) continue;

      const { data: existing } = await admin
        .from('exchange_rates')
        .select('effective_date, from_currency, to_currency')
        .eq('organization_id', org.id)
        .gte('effective_date', allDates[0])
        .lte('effective_date', allDates[allDates.length - 1]);
      const existingKeys = new Set(
        (existing || []).map((r: any) => `${r.effective_date}|${r.from_currency}|${r.to_currency}`),
      );

      for (const date of allDates) {
        let rates: Record<string, number> = {};
        if (mode === 'current') {
          const apiResp = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
          if (apiResp.ok) {
            const apiJson: ErApiResponse = await apiResp.json();
            if (apiJson.result === 'success') {
              for (const t of targets) {
                const v = apiJson.rates[t];
                if (typeof v === 'number' && v > 0) rates[t] = v;
              }
            }
          }
        } else {
          rates = await fetchHistoricalRates(date, baseCurrency, targets);
        }

        const rows: any[] = [];
        for (const [target, fwd] of Object.entries(rates)) {
          if (!fwd || fwd <= 0) continue;
          const fwdKey = `${date}|${baseCurrency}|${target}`;
          const invKey = `${date}|${target}|${baseCurrency}`;
          const src = mode === 'backfill'
            ? (FRANKFURTER_SUPPORTED.has(target) && FRANKFURTER_SUPPORTED.has(baseCurrency)
                ? 'frankfurter.dev (historical)'
                : 'fallback (annual anchor)')
            : 'open.er-api.com';
          if (!existingKeys.has(fwdKey)) {
            rows.push({
              organization_id: org.id,
              from_currency: baseCurrency,
              to_currency: target,
              rate: fwd,
              effective_date: date,
              source: src,
            });
            existingKeys.add(fwdKey);
          }
          if (!existingKeys.has(invKey)) {
            rows.push({
              organization_id: org.id,
              from_currency: target,
              to_currency: baseCurrency,
              rate: 1 / fwd,
              effective_date: date,
              source: src,
            });
            existingKeys.add(invKey);
          }
        }

        if (rows.length > 0) {
          const { error: insErr, count } = await admin
            .from('exchange_rates')
            .insert(rows, { count: 'exact' });
          if (insErr) {
            console.error(`Insert failed for org ${org.id} date ${date}:`, insErr.message);
          } else {
            totalInserted += count || rows.length;
          }
        }
        daysProcessed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        inserted: totalInserted,
        days: daysProcessed,
        startDate: mode === 'backfill' ? requestedStart : today,
        endDate: mode === 'backfill' ? chunkEndDate : today,
        finalEndDate: endDate,
        nextStartDate,
        orgs: orgs?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    console.error('fx-rate-sync error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
