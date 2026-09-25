import { UserSignature } from '@/hooks/useUserSignatures';

/**
 * Gets the displayable URL for a signature.
 * Prioritizes storage_url (cloud storage) over base64 signature_data.
 * This helps prevent rendering issues with large base64 strings.
 */
export function getSignatureDisplayUrl(signature: UserSignature): string {
  // Prefer storage URL if available
  if (signature.storage_url) {
    return signature.storage_url;
  }
  
  // Fallback to base64 signature_data
  return signature.signature_data;
}

/**
 * Checks if a signature value is a storage URL (not base64).
 */
export function isStorageUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

/**
 * Gets signature data for PDF embedding.
 * If the value is a storage URL, it needs to be fetched.
 * If it's base64, it can be used directly.
 */
export function getSignatureForEmbedding(signature: UserSignature): string {
  // For embedding, we need the actual image data
  // If there's a storage_url, that should be used (edge function will fetch it)
  // If there's base64 data, return that
  if (signature.storage_url) {
    return signature.storage_url;
  }
  return signature.signature_data;
}
