/**
 * Shared CRA XML helpers for Supabase Edge Functions (Deno).
 *
 * Mirror of src/lib/efile/craXmlUtils.ts. Edge Functions run in Deno and
 * cannot import from `src/`, so we keep a small self-contained copy here.

 * CRA 2027 schema integration: multi-year schema selection + soft validation
 * with graceful degradation (missing .xsd files produce a warning, not a
 * hard failure). Add the actual schema files/regex when the final 2027 schema
 * drops.
 */

/** Map a tax year to the CRA schema year. */
export function schemaForTaxYear(year: number): "2026" | "2027" {
  return year >= 2027 ? "2027" : "2026";
}

/** Standard CRA XML escaping. */
export function xmlEscape(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** 2-dp amount, no thousands separators. */
export function formatCraAmount(n: number | null | undefined): string {
  return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
}

/** Remove empty optional tags (CRA Oct 2025 rule). */
export function omitEmptyOptionalTags(xml: string): string {
  return xml
    .replace(/<([A-Za-z_][\w.:-]*)\s*><\/\1>/g, "")
    .replace(/<([A-Za-z_][\w.:-]*)\s*\/\s*>/g, "");
}

/** T619 Electronic Transmittal version label. */
export function t619Version(schemaYear: "2026" | "2027"): string {
  return `T619-${schemaYear.slice(2)}`;
}
