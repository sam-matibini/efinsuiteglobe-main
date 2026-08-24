/**
 * Write sales_tax_settings even when hosted Postgres is missing the RST-paid
 * columns (claim_gst_hst_itc, vat_*_account_id, …). Missing fields are stored
 * on organizations.efinconnect_preferences.retailSalesTaxesPaid until the
 * migration is applied.
 */
import { missingColumnFromError } from '@/lib/postgrestSchema';

export const RST_PAID_PREF_KEY = 'retailSalesTaxesPaid';

export const RST_PAID_SCHEMA_COLUMNS = [
  'claim_input_tax',
  'claim_gst_hst_itc',
  'claim_pst_paid',
  'vat_collected_account_id',
  'vat_paid_account_id',
] as const;

export type RstPaidSchemaColumn = (typeof RST_PAID_SCHEMA_COLUMNS)[number];

export type RstPaidFallback = Partial<Record<RstPaidSchemaColumn, boolean | string | null>>;

const UUID_KEYS = new Set([
  'gst_collected_account_id',
  'gst_paid_account_id',
  'pst_collected_account_id',
  'pst_paid_account_id',
  'vat_collected_account_id',
  'vat_paid_account_id',
]);

export function sanitizeSalesTaxSettingsPayload(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) continue;
    if (UUID_KEYS.has(key) && (value === '' || value === undefined)) {
      out[key] = null;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function pickRstPaidFallback(payload: Record<string, unknown>): RstPaidFallback {
  const out: RstPaidFallback = {};
  for (const col of RST_PAID_SCHEMA_COLUMNS) {
    if (col in payload) out[col] = payload[col] as RstPaidFallback[RstPaidSchemaColumn];
  }
  return out;
}

export function mergeRstPaidSettings<T extends Record<string, unknown>>(
  row: T | null | undefined,
  fallback: RstPaidFallback | null | undefined,
): T {
  const base = { ...(row || {}) } as T;
  const fb = fallback || {};
  for (const col of RST_PAID_SCHEMA_COLUMNS) {
    if (!(col in base) && col in fb) {
      (base as Record<string, unknown>)[col] = fb[col];
    }
  }
  if (!('claim_input_tax' in base)) (base as Record<string, unknown>).claim_input_tax = true;
  if (!('claim_gst_hst_itc' in base)) (base as Record<string, unknown>).claim_gst_hst_itc = true;
  if (!('claim_pst_paid' in base)) (base as Record<string, unknown>).claim_pst_paid = false;
  return base;
}

export function readRstPaidFallback(prefs: unknown): RstPaidFallback {
  if (!prefs || typeof prefs !== 'object') return {};
  const nested = (prefs as Record<string, unknown>)[RST_PAID_PREF_KEY];
  if (!nested || typeof nested !== 'object') return {};
  return { ...(nested as RstPaidFallback) };
}

export function writeRstPaidFallback(prefs: unknown, fallback: RstPaidFallback): Record<string, unknown> {
  const current = prefs && typeof prefs === 'object' ? { ...(prefs as Record<string, unknown>) } : {};
  current[RST_PAID_PREF_KEY] = {
    ...readRstPaidFallback(current),
    ...fallback,
  };
  return current;
}

type QueryResult<T> = { data: T | null; error: { message?: string; code?: string } | null };

export async function upsertSalesTaxSettingsRow(
  write: (payload: Record<string, unknown>) => Promise<QueryResult<Record<string, unknown>>>,
  settings: Record<string, unknown>,
): Promise<{ row: Record<string, unknown>; omitted: string[]; fallback: RstPaidFallback }> {
  let payload = sanitizeSalesTaxSettingsPayload(settings);
  const omitted: string[] = [];
  const fallback = pickRstPaidFallback(payload);

  for (let i = 0; i < 12; i += 1) {
    const result = await write(payload);
    const missing = missingColumnFromError(result.error);
    if (missing) {
      omitted.push(missing);
      delete payload[missing];
      if (RST_PAID_SCHEMA_COLUMNS.includes(missing as RstPaidSchemaColumn)) {
        for (const col of RST_PAID_SCHEMA_COLUMNS) {
          if (col in payload) {
            omitted.push(col);
            delete payload[col];
          }
        }
      }
      continue;
    }
    if (result.error) throw result.error;
    if (!result.data) throw new Error('Sales tax settings save returned no rows.');
    return { row: result.data, omitted, fallback };
  }
  throw new Error('Sales tax settings schema is missing too many columns to save.');
}
