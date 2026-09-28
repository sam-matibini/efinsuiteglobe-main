/**
 * Portal filings (CRA GST/HST, US state) are finished on the authority's site.
 * A direct filing is an API the software is allowed to call, such as HMRC MTD.
 */
export function isDirectEfile(packet: { canDirectSubmit: boolean }): boolean {
  return packet.canDirectSubmit === true;
}

/**
 * Confirmation copied from the authority. Short placeholders are refused so a
 * return is not marked filed without a real reference.
 */
export function authorityConfirmation(value: string): string | null {
  const cleaned = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{5,}$/.test(cleaned)) return null;
  return cleaned;
}
