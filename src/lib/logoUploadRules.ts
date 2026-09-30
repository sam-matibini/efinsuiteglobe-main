/** Client-side ceiling shown in logo settings. */
export const LOGO_MAX_SOURCE_BYTES = 2 * 1024 * 1024;

/** Longest edge stored for a logo. Invoice headers only need a small image. */
export const LOGO_MAX_EDGE_PX = 1024;

/**
 * Stay under a 1MB object cap. The HSDE globe is 1.2MB, which passes the
 * 2MB picker check and is still rejected when the bucket limit is 1MB.
 */
export const LOGO_TARGET_BYTES = 900 * 1024;

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

function extensionOf(fileName: string): string {
  const raw = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function logoFileAllowed(file: { name: string; type: string; size: number }): { ok: true } | { ok: false; reason: 'type' | 'size' } {
  const type = (file.type || '').toLowerCase();
  const extension = extensionOf(file.name);
  const typeOk = type.startsWith('image/') || ALLOWED_EXTENSIONS.includes(extension);
  if (!typeOk) return { ok: false, reason: 'type' };
  if (file.size > LOGO_MAX_SOURCE_BYTES) return { ok: false, reason: 'size' };
  return { ok: true };
}

export function logoContentTypeForFile(file: { name: string; type: string }): { contentType: string; extension: string } {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/png' || type === 'image/x-png') return { contentType: 'image/png', extension: 'png' };
  if (type === 'image/jpeg' || type === 'image/jpg') return { contentType: 'image/jpeg', extension: 'jpg' };
  if (type === 'image/webp') return { contentType: 'image/webp', extension: 'webp' };
  if (type === 'image/gif') return { contentType: 'image/gif', extension: 'gif' };
  const extension = extensionOf(file.name);
  if (extension === 'jpg' || extension === 'jpeg') return { contentType: 'image/jpeg', extension: 'jpg' };
  if (extension === 'webp') return { contentType: 'image/webp', extension: 'webp' };
  if (extension === 'gif') return { contentType: 'image/gif', extension: 'gif' };
  return { contentType: 'image/png', extension: 'png' };
}

export function logoNeedsNormalize(input: { size: number; width: number; height: number }): boolean {
  return input.size > LOGO_TARGET_BYTES || input.width > LOGO_MAX_EDGE_PX || input.height > LOGO_MAX_EDGE_PX;
}

export function logoDrawSize(width: number, height: number, maxEdge = LOGO_MAX_EDGE_PX): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (!Number.isFinite(longest) || longest <= 0) return { width: 1, height: 1 };
  if (longest <= maxEdge) {
    return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
