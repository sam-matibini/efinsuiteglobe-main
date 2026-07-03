import { supabase } from '@/integrations/supabase/client';

/**
 * Uploads a signature image (base64) to the user-signatures storage bucket.
 * Returns the storage URL that can be used for embedding into PDFs.
 */
export async function uploadSignatureToStorage(
  userId: string,
  signatureData: string,
  signatureType: 'signature' | 'initial' | 'draw' | 'type' | 'upload'
): Promise<{ storageUrl: string | null; error: string | null }> {
  try {
    // Validate base64 data URL
    const base64Match = signatureData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
    if (!base64Match) {
      return { storageUrl: null, error: 'Invalid signature data format' };
    }

    const [, format, base64Data] = base64Match;
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = format === 'jpeg' || format === 'jpg' ? 'jpg' : 'png';
    const fileName = `${userId}/${signatureType}_${timestamp}.${fileExtension}`;
    const contentType = `image/${format}`;

    // Upload to storage bucket
    const { error: uploadError } = await supabase.storage
      .from('user-signatures')
      .upload(fileName, bytes, {
        contentType,
        upsert: false, // Don't overwrite existing files
      });

    if (uploadError) {
      console.error('[uploadSignatureToStorage] Upload error:', uploadError);
      return { storageUrl: null, error: uploadError.message };
    }

    // Get signed URL (valid for 1 year - signatures should be permanent)
    // Note: For truly permanent storage, we might want to use public URLs
    // but for security, we use signed URLs with long expiry
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('user-signatures')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

    if (signedUrlError) {
      console.warn('[uploadSignatureToStorage] Signed URL error, trying public URL:', signedUrlError);
      // Fallback to public URL
      const { data: publicUrlData } = supabase.storage
        .from('user-signatures')
        .getPublicUrl(fileName);
      
      return { storageUrl: publicUrlData.publicUrl, error: null };
    }

    return { storageUrl: signedUrlData.signedUrl, error: null };
  } catch (error) {
    console.error('[uploadSignatureToStorage] Unexpected error:', error);
    return { 
      storageUrl: null, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Fetches a signature from storage and returns it as base64 data URL.
 * Used when embedding signatures into PDFs on the server.
 */
export async function fetchSignatureAsBase64(
  storageUrl: string
): Promise<{ base64Data: string | null; error: string | null }> {
  try {
    const response = await fetch(storageUrl);
    if (!response.ok) {
      return { base64Data: null, error: `Failed to fetch signature: ${response.statusText}` };
    }

    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({ base64Data: reader.result as string, error: null });
      };
      reader.onerror = () => {
        resolve({ base64Data: null, error: 'Failed to read signature data' });
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('[fetchSignatureAsBase64] Error:', error);
    return {
      base64Data: null,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
