/**
 * CRA 2027 XML Schema Integration — schema version configuration.
 *
 * Single source of truth for which CRA XML schema year applies to a given tax
 * year. Supports multiple schema years (2026 + 2027) simultaneously so that
 * amended filings of prior years keep using the correct schema.
 *
 * This module is intentionally FRAMEWORK-AGNOSTIC (no Vite-specific globs, no
 * Deno-specific APIs) so it can be consumed by both:
 *   - the React frontend (src/lib/efile/...)
 *   - Supabase Edge Functions (via supabase/functions/_shared/cra-schema-version.ts)
 *
 * XSD resolution is FILE-DRIVEN at runtime. When CRA publishes the final 2027
 * schema (early October), drop the new .xsd files into craSchemas/2027/ and
 * bump the version metadata — no generator code changes required. Missing XSD
 * files degrade gracefully (validation reports "no schema available" rather
 * than failing the filing).
 */

/** Known CRA information-return schema years. */
export const CRA_SCHEMA_VERSIONS = ['2026', '2027'] as const;
export type CraSchemaYear = (typeof CRA_SCHEMA_VERSIONS)[number];

/** Default schema year for newly generated filings (2027+ tax years). */
export const DEFAULT_CRA_SCHEMA: CraSchemaYear = '2027';

/** Earliest tax year that uses the 2027 schema. */
export const SCHEMA_2027_START_YEAR = 2027;

/**
 * Map a tax year to the schema version that should be used.
 * 2027+ tax years → 2027 schema; earlier years → 2026 schema.
 * Always returns a valid CraSchemaYear (clamps unknown years to nearest).
 */
export function schemaForTaxYear(year: number): CraSchemaYear {
  return year >= SCHEMA_2027_START_YEAR ? '2027' : '2026';
}

/** T619 Electronic Transmittal record version label per schema year. */
export const T619_VERSION: Record<CraSchemaYear, string> = {
  '2026': 'T619-26',
  '2027': 'T619-27',
};

/**
 * Describes how to resolve the schemas for a given year.
 * Each return type maps to a file name under craSchemas/{year}/.
 */
export interface CraSchemaFile {
  /** CRA return-type key used in the XML root. */
  returnType: string;
  /** File name within an craSchemas/{year}/ directory. */
  fileName: string;
  /** True if a T619 transmittal must wrap this return type. */
  requiresT619: boolean;
}

/** Schema file lookup keyed by return type, shared across years. */
export const CRA_SCHEMA_FILES: Record<string, CraSchemaFile> = {
  T4:    { returnType: 'T4',          fileName: 'T4.xsd',      requiresT619: true },
  T4A:   { returnType: 'T4A',         fileName: 'T4A.xsd',     requiresT619: true },
  T5:    { returnType: 'T5',          fileName: 'T5.xsd',      requiresT619: true },
  T5018: { returnType: 'T5018',       fileName: 'T5018.xsd',   requiresT619: true },
  GST34: { returnType: 'GSTHSTReturn', fileName: 'GSTHST.xsd',  requiresT619: false },
};

/**
 * Resolve the relative, runtime-agnostic file path for a schema, e.g.
 * `2027/T5.xsd`.
 */
export function craSchemaPath(year: CraSchemaYear, returnType: string): string | null {
  const file = CRA_SCHEMA_FILES[returnType];
  if (!file) return null;
  return `${year}/${file.fileName}`;
}
