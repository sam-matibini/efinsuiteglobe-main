export interface ExtractedInvoiceLine {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  tax_rate: number | null;
}

export interface InvoiceExtraction {
  vendor_name: string | null;
  document_number: string | null;
  document_date: string | null;
  due_date: string | null;
  terms: string | null;
  currency: string | null;
  subtotal: number | null;
  tax_total: number | null;
  grand_total: number | null;
  lines: ExtractedInvoiceLine[];
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

const isoDate = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

/** Defensively normalize whatever the AI returned into a usable extraction. */
export function normalizeExtraction(raw: unknown): InvoiceExtraction | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const lines = Array.isArray(r.lines) ? r.lines : [];
  return {
    vendor_name: str(r.vendor_name),
    document_number: str(r.document_number),
    document_date: isoDate(r.document_date),
    due_date: isoDate(r.due_date),
    terms: str(r.terms),
    currency: str(r.currency),
    subtotal: num(r.subtotal),
    tax_total: num(r.tax_total),
    grand_total: num(r.grand_total),
    lines: lines
      .map((l) => {
        const o = (l ?? {}) as Record<string, unknown>;
        return {
          description: str(o.description) ?? '',
          quantity: num(o.quantity),
          unit_price: num(o.unit_price),
          tax_rate: num(o.tax_rate),
        };
      })
      .filter((l) => l.description.length > 0),
  };
}

/** Simple normalized-token match of an extracted vendor name against existing vendors. */
export function matchVendor<T extends { id: string; name: string }>(
  vendors: T[],
  name?: string | null,
): T | null {
  if (!name) return null;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(inc|llc|ltd|limited|corp|corporation|co|company|plc|gmbh|sa|nv|pty)\b/g, '')
      .replace(/[^a-z0-9]+/g, '');
  const target = norm(name);
  if (!target) return null;
  return (
    vendors.find((v) => norm(v.name) === target) ??
    vendors.find((v) => {
      const n = norm(v.name);
      return n.length > 2 && (n.includes(target) || target.includes(n));
    }) ??
    null
  );
}
