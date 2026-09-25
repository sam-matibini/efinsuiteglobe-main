/**
 * PDF Storage Service
 * Handles uploading and retrieving PDF documents from Supabase Storage
 */

import { supabase } from '@/integrations/supabase/client';
import type { PrintDocumentType } from './types';

const BUCKET_NAME = 'print-archives';

export interface StoredDocument {
  id: string;
  path: string;
  url: string;
  filename: string;
  size: number;
  createdAt: string;
}

export interface UploadResult {
  success: boolean;
  path?: string;
  url?: string;
  error?: string;
  checksum?: string;
}

/**
 * Generate a unique storage path for a document
 */
function generateStoragePath(
  organizationId: string,
  documentType: PrintDocumentType,
  reference: string,
  filename: string
): string {
  const date = new Date().toISOString().split('T')[0];
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${organizationId}/${documentType}/${date}/${reference}_${sanitizedFilename}`;
}

/**
 * Calculate a simple checksum for a blob
 */
async function calculateChecksum(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Upload a PDF document to storage
 */
export async function uploadPdfToStorage(
  organizationId: string,
  documentType: PrintDocumentType,
  reference: string,
  pdfBlob: Blob,
  filename: string
): Promise<UploadResult> {
  try {
    const path = generateStoragePath(organizationId, documentType, reference, filename);
    const checksum = await calculateChecksum(pdfBlob);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      console.error('PDF upload failed:', error);
      return { success: false, error: error.message };
    }

    // Get the public URL (even though bucket is private, we need the path)
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    return {
      success: true,
      path: data.path,
      url: urlData.publicUrl,
      checksum,
    };
  } catch (err) {
    console.error('PDF upload error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' };
  }
}

/**
 * Get a signed URL for downloading a document
 */
export async function getSignedDownloadUrl(
  path: string,
  expiresInSeconds: number = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      console.error('Failed to create signed URL:', error);
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Signed URL error:', err);
    return null;
  }
}

/**
 * List documents for an organization
 */
export async function listOrganizationDocuments(
  organizationId: string,
  documentType?: PrintDocumentType,
  limit: number = 100
): Promise<StoredDocument[]> {
  try {
    const prefix = documentType 
      ? `${organizationId}/${documentType}/`
      : `${organizationId}/`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(prefix, {
        limit,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('Failed to list documents:', error);
      return [];
    }

    return (data || [])
      .filter(item => item.name.endsWith('.pdf'))
      .map(item => ({
        id: item.id,
        path: `${prefix}${item.name}`,
        url: '',
        filename: item.name,
        size: item.metadata?.size || 0,
        createdAt: item.created_at,
      }));
  } catch (err) {
    console.error('List documents error:', err);
    return [];
  }
}

/**
 * Delete a document from storage
 */
export async function deleteDocument(path: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error('Failed to delete document:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Delete document error:', err);
    return false;
  }
}

/**
 * Download a document blob
 */
export async function downloadDocumentBlob(path: string): Promise<Blob | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(path);

    if (error) {
      console.error('Failed to download document:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Download document error:', err);
    return null;
  }
}
