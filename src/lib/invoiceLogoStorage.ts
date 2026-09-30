/**
 * Object path inside the organization-logos bucket.
 *
 * Storage policies allow a member to write only when the first folder is
 * their organization id. A path that starts with "invoice-logos" is rejected.
 */
export function invoiceLogoObjectPath(organizationId: string, fileName: string, now = Date.now()): string {
  const rawExt = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  return `${organizationId}/invoice-logos/logo-${now}.${ext}`;
}
