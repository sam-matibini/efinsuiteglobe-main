import {
  LOGO_MAX_EDGE_PX,
  LOGO_TARGET_BYTES,
  logoContentTypeForFile,
  logoDrawSize,
  logoFileAllowed,
  logoNeedsNormalize,
} from './logoUploadRules';

export {
  LOGO_MAX_EDGE_PX,
  LOGO_MAX_SOURCE_BYTES,
  LOGO_TARGET_BYTES,
  logoContentTypeForFile,
  logoDrawSize,
  logoFileAllowed,
  logoNeedsNormalize,
} from './logoUploadRules';

export interface PreparedLogo {
  body: Blob;
  contentType: string;
  extension: string;
}

/**
 * Turn a selected logo into an image storage will accept.
 * Files already under the target size and 1024px are uploaded as-is.
 * Larger files, including the 2000px HSDE globe, are redrawn as a PNG.
 */
export async function prepareLogoUpload(file: File): Promise<PreparedLogo> {
  const allowed = logoFileAllowed(file);
  if (!allowed.ok) {
    throw new Error(allowed.reason === 'size' ? 'Image must be smaller than 2MB' : 'Please select an image file');
  }

  const meta = logoContentTypeForFile(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.size <= LOGO_TARGET_BYTES) {
      return { body: file, contentType: meta.contentType, extension: meta.extension };
    }
    throw new Error('Could not read that image. Upload a PNG or JPG.');
  }

  try {
    const keepOriginal = !logoNeedsNormalize({
      size: file.size,
      width: bitmap.width,
      height: bitmap.height,
    });
    if (keepOriginal) {
      return { body: file, contentType: meta.contentType, extension: meta.extension };
    }

    let edge = LOGO_MAX_EDGE_PX;
    let blob = await renderLogo(bitmap, edge);
    while (blob.size > LOGO_TARGET_BYTES && edge > 320) {
      edge = Math.round(edge * 0.75);
      blob = await renderLogo(bitmap, edge);
    }
    return { body: blob, contentType: 'image/png', extension: 'png' };
  } finally {
    bitmap.close();
  }
}

async function renderLogo(bitmap: ImageBitmap, maxEdge: number): Promise<Blob> {
  const size = logoDrawSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read that image. Upload a PNG or JPG.');
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not read that image. Upload a PNG or JPG.');
  return blob;
}

/** File with a name and image type. Storage reads the type from the file, not the upload option. */
export function logoUploadFile(prepared: PreparedLogo): File {
  if (prepared.body instanceof File && prepared.body.type === prepared.contentType) {
    return prepared.body;
  }
  return new File([prepared.body], `logo.${prepared.extension}`, { type: prepared.contentType });
}

export function logoUploadErrorMessage(error: unknown): string {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string'
      ? (error as { message: string }).message
      : '';
  if (
    message === 'Image must be smaller than 2MB' ||
    message === 'Please select an image file' ||
    message === 'You do not have permission to upload a logo for this organization' ||
    message.startsWith('Could not read')
  ) {
    return message;
  }
  const lower = message.toLowerCase();
  if (lower.includes('maximum allowed size') || lower.includes('payload too large') || lower.includes('entity too large')) {
    return 'Image must be smaller than 2MB';
  }
  if (lower.includes('row-level security') || lower.includes('not authorized') || lower.includes('permission denied') || lower.includes('unauthorized')) {
    return 'You do not have permission to upload a logo for this organization';
  }
  if (lower.includes('mime') || lower.includes('invalid file type')) {
    return 'Upload a PNG or JPG image';
  }
  if (lower.includes('invalid input syntax for type uuid')) {
    return 'You do not have permission to upload a logo for this organization';
  }
  return message ? `Failed to upload logo: ${message}` : 'Failed to upload logo';
}
