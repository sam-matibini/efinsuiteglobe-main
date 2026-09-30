/**
 * Object paths inside the organization-logos bucket.
 *
 * Storage policies allow a member to write only when the first folder is
 * their organization id. A path that starts with "invoice-logos" is rejected.
 */
function safeExtension(fileNameOrExt: string): string {
  const raw = fileNameOrExt.includes('.') ? fileNameOrExt.split('.').pop() || '' : '';
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
}

export function invoiceLogoObjectPath(organizationId: string, fileName: string, now = Date.now()): string {
  // One folder only, and it is the organization id. The same shape as the
  // organization logo uploads that already succeed. A path that starts with
  // "invoice-logos" makes a storage policy cast fail and the upload is rejected.
  return `${organizationId}/invoice-logo-${now}.${safeExtension(fileName)}`;
}

export function organizationLogoObjectPath(organizationId: string, fileName: string, now = Date.now()): string {
  return `${organizationId}/logo-${now}.${safeExtension(fileName)}`;
}

/** Path of an existing object, taken from its public URL. Query strings are ignored. */
export function logoObjectPathFromPublicUrl(url: string): string | null {
  const marker = '/organization-logos/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const raw = url.slice(index + marker.length).split('?')[0].split('#')[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
