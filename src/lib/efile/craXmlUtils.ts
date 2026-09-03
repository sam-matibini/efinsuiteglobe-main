/**
 * CRA 2027 XML Schema Integration — shared CRA XML utilities.
 *
 * Consolidates the XML escaping / envelope-building logic that was previously
 * duplicated across multiple generators, plus soft XSD validation with
 * graceful degradation.
 *
 * NOTE: Frontend-only. Supabase Edge Functions (Deno) cannot import from
 * `src/`; a mirror lives at `supabase/functions/_shared/cra-xml-utils.ts`.
 */
import {
  CraSchemaYear,
  DEFAULT_CRA_SCHEMA,
  T619_VERSION,
  schemaForTaxYear,
  CRA_SCHEMA_FILES,
  craSchemaPath,
} from './craSchemaVersion';

export { DEFAULT_CRA_SCHEMA, schemaForTaxYear, T619_VERSION };

/** Standard CRA XML escaping. */
export function xmlEscape(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Format a number as a CRA-expected decimal (2 dp, no thousands separators). */
export function formatCraAmount(n: number | null | undefined): string {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

/**
 * Strip empty optional tags from an XML document.
 *
 * CRA (effective Oct 2025) rejects submissions that include optional fields
 * without values — i.e. `<tag/>` or `<tag></tag>` must be removed. This helper
 * removes self-closing and immediately-empty elements. It is a lightweight,
 * regex-based pass suitable for the simple, predictable structures we emit.
 */
export function omitEmptyOptionalTags(xml: string): string {
  return xml
    // <name></name> → removed
    .replace(/<([A-Za-z_][\w.:-]*)\s*><\/\1>/g, '')
    // <name/> → removed. Keep whitespace-sensitive tags intact via negative lookbehind not needed for our simple output.
    .replace(/<([A-Za-z_][\w.:-]*)\s*\/\s*>/g, '');
}

/** Options for building the T619 Electronic Transmittal record. */
export interface T619Options {
  /** 15-char transmitter BN, e.g. "123456789RP0001". */
  transmitterNumber: string;
  /** Information-return type: T4, T4A, T5, T5018. */
  summaryType: string;
  taxYear: number;
  slipCount: number;
  /** Total amount across all slips in the file. */
  totalAmount: number;
  schemaYear?: CraSchemaYear;
}

/**
 * Build a CRA T619 Electronic Transmittal record header.
 * Returns null when the return type does not require a T619 wrapper.
 */
export function buildT619Header(opts: T619Options): string | null {
  const file = CRA_SCHEMA_FILES[opts.summaryType.toUpperCase()];
  if (!file || !file.requiresT619) return null;
  const schemaYear = opts.schemaYear ?? schemaForTaxYear(opts.taxYear);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<T619 xmlns="http://www.cra-arc.gc.ca/xmlns/return" schemaVersion="${T619_VERSION[schemaYear]}">`,
    `  <TransmitterNumber>${xmlEscape(opts.transmitterNumber)}</TransmitterNumber>`,
    `  <SummaryType>${xmlEscape(opts.summaryType.toUpperCase())}</SummaryType>`,
    `  <TaxYear>${opts.taxYear}</TaxYear>`,
    `  <SchemaVersion>${schemaYear}</SchemaVersion>`,
    `  <SlipCount>${opts.slipCount}</SlipCount>`,
    `  <TotalAmount>${formatCraAmount(opts.totalAmount)}</TotalAmount>`,
  ].join('\n');
}

/** Result of a soft XSD validation pass. */
export interface SchemaValidationResult {
  valid: boolean;
  /** Hard schema errors (element not found / wrong order / bad type). */
  errors: string[];
  /** Non-blocking observations (empty optional tags, casing, etc.). */
  warnings: string[];
  /** The schema year validated against, if any. */
  schemaYear?: CraSchemaYear;
  /** True when no schema file was available for this year/return type. */
  noSchema: boolean;
}

/**
 * Validate generated XML against a CRA XSD schema — SOFT validation.
 *
 * Graceful degradation design:
 *  - If the XSD file for the requested (year, returnType) is not present yet,
 *    returns a `valid: true, noSchema: true` result with a warning. This lets
 *    the whole system run before the final XSD files are dropped in.
 *  - Because we cannot safely run full XSD parsing in-browser without a heavy
 *    dependency, this performs a practical structural check (well-formedness,
 *    self-closing-optional-tag scan) plus reports the schema availability.
 *    Full XSD enforcement can be layered on in the Edge Function later.
 *
 * The result is NON-BLOCKING — callers surface it as a warning only.
 */
export async function validateXmlAgainstXsd(
  xml: string,
  year: CraSchemaYear,
  returnType: string,
): Promise<SchemaValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Presence of a schema is tracked via a STATIC manifest (import.meta.glob
  // needs statically analyzable paths). When you drop a real .xsd file into
  // craSchemas/{year}/, update CRA_SCHEMA_AVAILABILITY so the system picks it up.
  const schemaLoaded = craSchemaPath(year, returnType) !== null &&
    CRA_SCHEMA_AVAILABILITY[year]?.[returnType] === true;

  if (!schemaLoaded) {
    warnings.push(
      `Schema not available for ${year}/${returnType} (${craSchemaPath(year, returnType) ?? 'unknown path'}). ` +
      `Skipping XSD validation. Add the .xsd file and mark it in CRA_SCHEMA_AVAILABILITY to enable.`,
    );
    return { valid: true, errors, warnings, schemaYear: year, noSchema: true };
  }

  // Structural well-formedness check (basic).
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const parseErr = doc.querySelector('parsererror');
    if (parseErr) {
      errors.push(`XML is not well-formed: ${parseErr.textContent?.trim() ?? 'parser error'}`);
    }
  }

  // CRA Oct 2025 rule: optional tags without values must be removed.
  const emptyTags = findEmptyTags(xml);
  if (emptyTags.length) {
    warnings.push(
      `Empty optional tag(s) present which CRA will reject: ${emptyTags.join(', ')}. ` +
      `Run omitEmptyOptionalTags() before submitting.`,
    );
  }

  return { valid: errors.length === 0, errors, warnings, schemaYear: year, noSchema: false };
}

/**
 * Static manifest of which CRA XSD files are actually shipped for each year.
 * Populated as `.xsd` files are committed to craSchemas/{year}/. Keeping this
 * list in sync is the single action required when the final 2027 schema drops.
 */
export const CRA_SCHEMA_AVAILABILITY: Partial<Record<CraSchemaYear, Record<string, boolean>>> = {
  '2026': {
    T4: true,
    T4A: true,
    T5: true,
    T5018: true,
    GST34: false, // no GST/HST schema in the 2026 information-return package
  },
  '2027': {
    T4: false, // waiting on CRA final 2027 schema (early October)
    T4A: false,
    T5: false,
    T5018: false,
    GST34: false,
  },
};

/** Detect `<tag/>` / `<tag></tag>` empty elements. */
export function findEmptyTags(xml: string): string[] {
  const found: string[] = [];
  const re = /<([A-Za-z_][\w.:-]*)\s*\/\s*>|<([A-Za-z_][\w.:-]*)\s*><\/\2>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    found.push(m[1] || m[2]);
  }
  return [...new Set(found)];
}
