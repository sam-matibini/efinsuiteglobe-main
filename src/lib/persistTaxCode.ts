/**
 * Persist a tax code that may only exist in the client (derived from settings
 * or synthesized as a paid/ITC sibling). Update by id, then by org+code,
 * then insert so the Sales Tax settings editor can save virtual rows.
 */
import { isPaidRetailTaxCode } from '@/lib/retailTaxRateCatalog';

const CLIENT_ONLY_KEYS = new Set([
  'isVirtual',
  'is_virtual',
  'created_at',
  'id',
  'organization_id',
]);

const OPTIONAL_SCHEMA_COLUMNS = ['applies_to', 'paid_name'] as const;

export function sanitizeTaxCodeWrite(updates: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (CLIENT_ONLY_KEYS.has(key) || value === undefined) continue;
    out[key] = value;
  }
  if (typeof out.tax_type === 'string' && out.tax_type === 'purchase') {
    // DB seeds and check constraints use "purchases"; the editor uses "purchase".
    out.tax_type = 'purchases';
  }
  if (!out.applies_to && typeof out.code === 'string' && isPaidRetailTaxCode(out.code, null)) {
    out.applies_to = 'purchases';
  }
  return out;
}

export function stripOptionalSchemaColumns(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  for (const col of OPTIONAL_SCHEMA_COLUMNS) delete next[col];
  return next;
}

export function isMissingColumnError(
  error: { message?: string; code?: string } | null | undefined,
  columns: readonly string[] = OPTIONAL_SCHEMA_COLUMNS,
): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  const looksLikeMissingColumn =
    code === 'PGRST204' ||
    code === '42703' ||
    msg.includes('schema cache') ||
    msg.includes('column');
  if (!looksLikeMissingColumn) return false;
  return columns.some((col) => msg.includes(col.toLowerCase()));
}

type QueryResult<T> = { data: T | null; error: { message?: string; code?: string } | null };

export interface TaxCodeWriter {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => any;
    };
    insert: (values: Record<string, unknown>) => {
      select: () => { single: () => Promise<QueryResult<Record<string, unknown>>> };
    };
  };
}

function finishSelect(query: any) {
  return query.select().maybeSingle() as Promise<QueryResult<Record<string, unknown>>>;
}

async function updateMatching(
  supabase: TaxCodeWriter,
  body: Record<string, unknown>,
  filters: Array<[string, string]>,
): Promise<QueryResult<Record<string, unknown>>> {
  let query: any = supabase.from('tax_codes').update(body);
  for (const [column, value] of filters) {
    query = query.eq(column, value);
  }
  return finishSelect(query);
}

async function insertRow(
  supabase: TaxCodeWriter,
  body: Record<string, unknown>,
): Promise<QueryResult<Record<string, unknown>>> {
  return supabase.from('tax_codes').insert(body).select().single();
}

export async function persistTaxCodeUpdate(
  supabase: TaxCodeWriter,
  args: { id: string; organizationId: string; updates: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  const { id, organizationId, updates } = args;
  let body: Record<string, unknown> = {
    ...sanitizeTaxCodeWrite(updates),
    updated_at: new Date().toISOString(),
  };

  const runUpdate = (filters: Array<[string, string]>, payload: Record<string, unknown>) =>
    updateMatching(supabase, payload, filters);

  let result = await runUpdate(
    [['id', id], ['organization_id', organizationId]],
    body,
  );
  if (isMissingColumnError(result.error)) {
    body = stripOptionalSchemaColumns(body);
    result = await runUpdate(
      [['id', id], ['organization_id', organizationId]],
      body,
    );
  }
  if (result.error) throw result.error;
  if (result.data) return result.data;

  const code = typeof body.code === 'string' ? body.code : undefined;
  if (code) {
    result = await runUpdate(
      [['organization_id', organizationId], ['code', code]],
      body,
    );
    if (result.error) throw result.error;
    if (result.data) return result.data;
  }

  const insertBody: Record<string, unknown> = {
    ...body,
    id,
    organization_id: organizationId,
    is_exempt: body.is_exempt ?? false,
    is_zero_rated: body.is_zero_rated ?? false,
    is_compound: body.is_compound ?? false,
    is_active: body.is_active ?? true,
  };

  let inserted = await insertRow(supabase, insertBody);
  if (isMissingColumnError(inserted.error)) {
    inserted = await insertRow(supabase, stripOptionalSchemaColumns(insertBody));
  }
  if (inserted.error) {
    const message = inserted.error.message || '';
    if (inserted.error.code === '23505' && code) {
      const again = await runUpdate(
        [['organization_id', organizationId], ['code', code]],
        body,
      );
      if (again.error) throw again.error;
      if (again.data) return again.data;
    }
    if (/invalid input syntax for type uuid/i.test(message)) {
      const { id: _omit, ...withoutId } = insertBody;
      const retry = await insertRow(supabase, withoutId);
      if (retry.error) throw retry.error;
      if (retry.data) return retry.data;
    }
    throw inserted.error;
  }
  if (!inserted.data) {
    throw new Error('Failed to save tax code.');
  }
  return inserted.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EnsurePersistedTaxCodeInput {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  rate?: number | null;
  jurisdiction?: string | null;
  tax_type?: string | null;
  is_recoverable?: boolean | null;
  is_compound?: boolean | null;
  is_active?: boolean | null;
  gl_collected_account_id?: string | null;
  gl_paid_account_id?: string | null;
  applies_to?: string | null;
  paid_name?: string | null;
}

/**
 * Return a tax_codes.id that exists for this org. Virtual GST-ITC / derived
 * picker ids are inserted (or matched by code) so FK columns like
 * bank_transactions.tax_code_id can store them.
 */
export async function ensurePersistedTaxCode(
  supabase: any,
  organizationId: string,
  taxCode: EnsurePersistedTaxCodeInput | null | undefined,
): Promise<string | null> {
  if (!organizationId || !taxCode) return null;
  const id = (taxCode.id || '').trim();
  const code = (taxCode.code || '').trim();
  if (!id && !code) return null;

  const lookup = async (column: string, value: string, extra?: Array<[string, string]>) => {
    let query: any = supabase.from('tax_codes').select('id');
    query = query.eq(column, value);
    for (const [col, val] of extra || []) query = query.eq(col, val);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data?.id as string | undefined) || null;
  };

  if (id && UUID_RE.test(id)) {
    const existing = await lookup('id', id);
    if (existing) return existing;
  }
  if (code) {
    const byCode = await lookup('code', code, [['organization_id', organizationId]]);
    if (byCode) return byCode;
  }

  if (id && !UUID_RE.test(id) && !code) return null;

  const persistId = id && UUID_RE.test(id)
    ? id
    : (globalThis.crypto?.randomUUID?.() ?? `${organizationId.slice(0, 8)}-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`);

  const saved = await persistTaxCodeUpdate(supabase, {
    id: persistId,
    organizationId,
    updates: {
      code: code || 'TAX',
      name: taxCode.name || code || 'Tax',
      rate: Number(taxCode.rate ?? 0),
      jurisdiction: taxCode.jurisdiction ?? null,
      tax_type: taxCode.tax_type || code || 'GST',
      is_recoverable: taxCode.is_recoverable ?? true,
      is_compound: taxCode.is_compound ?? false,
      is_active: taxCode.is_active ?? true,
      gl_collected_account_id: taxCode.gl_collected_account_id ?? null,
      gl_paid_account_id: taxCode.gl_paid_account_id ?? null,
      applies_to: taxCode.applies_to ?? undefined,
      paid_name: taxCode.paid_name ?? undefined,
    },
  });
  return (typeof saved.id === 'string' && saved.id) || persistId;
}
