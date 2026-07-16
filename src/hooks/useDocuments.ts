import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface Document {
  id: string;
  organization_id: string | null;
  owner_id: string;
  title: string;
  document_type: string;
  file_url: string | null;
  original_file_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: 'draft' | 'pending' | 'sent' | 'viewed' | 'signing' | 'completed' | 'declined' | 'expired' | 'voided';
  version: number;
  parent_document_id: string | null;
  expires_at: string | null;
  completed_at: string | null;
  signed_pdf_url: string | null;
  document_hash: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface DocumentSigner {
  id: string;
  document_id: string;
  email: string;
  name: string | null;
  role: string;
  signing_order: number;
  auth_method: 'email' | 'sms' | 'in_app' | 'id_verification';
  phone_number: string | null;
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  consent_given: boolean;
  consent_timestamp: string | null;
  signature_data: string | null;
}

export interface DocumentField {
  id: string;
  document_id: string;
  field_type: 'signature' | 'initial' | 'full_name' | 'date' | 'checkbox' | 'text' | 'stamp' | 'seal';
  label: string | null;
  page_number: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  is_required: boolean;
  assigned_signer_id: string | null;
  filled_value: string | null;
  filled_at: string | null;
}

export function useDocuments() {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['documents', organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Document[];
    },
    enabled: !!user,
  });
}

export function useDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document', documentId],
    queryFn: async () => {
      if (!documentId) return null;
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (error) throw error;
      return data as Document;
    },
    enabled: !!documentId,
  });
}

export function useDocumentSigners(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-signers', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      
      const { data, error } = await supabase
        .from('document_signers')
        .select('*')
        .eq('document_id', documentId)
        .order('signing_order', { ascending: true });

      if (error) throw error;
      return data as DocumentSigner[];
    },
    enabled: !!documentId,
  });
}

export function useDocumentFields(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-fields', documentId],
    queryFn: async () => {
      if (!documentId) return [];
      
      const { data, error } = await supabase
        .from('document_fields')
        .select('*')
        .eq('document_id', documentId)
        .order('page_number', { ascending: true });

      if (error) throw error;
      return data as DocumentField[];
    },
    enabled: !!documentId,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (documentData: { title: string; document_type?: string; file_url?: string; mime_type?: string; file_size?: number }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: documentData.title,
          document_type: documentData.document_type || 'contract',
          file_url: documentData.file_url,
          mime_type: documentData.mime_type,
          file_size: documentData.file_size,
          owner_id: user.id,
          organization_id: organization?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create document: ' + error.message);
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, title, expires_at, completed_at }: { id: string; status?: string; title?: string; expires_at?: string; completed_at?: string }) => {
      const updateData: Record<string, unknown> = {};
      if (status) updateData.status = status;
      if (title) updateData.title = title;
      if (expires_at) updateData.expires_at = expires_at;
      if (completed_at) updateData.completed_at = completed_at;
      
      const { data, error } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', data.id] });
      toast.success('Document updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update document: ' + error.message);
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
      return documentId;
    },
    onMutate: async (documentId) => {
      await queryClient.cancelQueries({ queryKey: ['documents'] });

      const previousDocuments = queryClient.getQueriesData<Document[]>({ queryKey: ['documents'] });

      previousDocuments.forEach(([queryKey, docs]) => {
        if (!docs) return;
        queryClient.setQueryData<Document[]>(
          queryKey,
          docs.filter((doc) => doc.id !== documentId)
        );
      });

      return { previousDocuments };
    },
    onSuccess: () => {
      toast.success('Document deleted successfully');
    },
    onError: (error, _documentId, context) => {
      context?.previousDocuments?.forEach(([queryKey, docs]) => {
        queryClient.setQueryData(queryKey, docs);
      });
      toast.error('Failed to delete document: ' + error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useAddSigner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (signerData: Omit<DocumentSigner, 'id' | 'viewed_at' | 'signed_at' | 'declined_at' | 'decline_reason' | 'consent_given' | 'consent_timestamp' | 'signature_data'>) => {
      const { data, error } = await supabase
        .from('document_signers')
        .insert(signerData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['document-signers', data.document_id] });
      toast.success('Signer added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add signer: ' + error.message);
    },
  });
}

export function useAddField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fieldData: Omit<DocumentField, 'id' | 'filled_value' | 'filled_at'>) => {
      const { data, error } = await supabase
        .from('document_fields')
        .insert(fieldData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['document-fields', data.document_id] });
    },
    onError: (error) => {
      toast.error('Failed to add field: ' + error.message);
    },
  });
}

export function useUpdateDocumentField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      fieldId, 
      documentId,
      updates 
    }: { 
      fieldId: string; 
      documentId: string;
      updates: { 
        filled_value?: string | null; 
        filled_at?: string | null;
        position_x?: number;
        position_y?: number;
        width?: number;
        height?: number;
      } 
    }) => {
      const { data, error } = await supabase
        .from('document_fields')
        .update(updates)
        .eq('id', fieldId)
        .select()
        .single();

      if (error) throw error;
      return { ...data, documentId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['document-fields', data.documentId] });
    },
    onError: (error) => {
      console.error('Failed to update field:', error);
    },
  });
}

export function useSendDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      // Get document details
      const { data: document, error: docFetchError } = await supabase
        .from('documents')
        .select('id, title, file_url, file_size, mime_type')
        .eq('id', documentId)
        .single();

      if (docFetchError) throw docFetchError;

      // Get signers
      const { data: signers, error: signersFetchError } = await supabase
        .from('document_signers')
        .select('id, email, name, phone_number, auth_method')
        .eq('document_id', documentId);

      if (signersFetchError) throw signersFetchError;

      if (!signers || signers.length === 0) {
        throw new Error('No signers found for this document. Please add at least one signer first.');
      }

      // Note: signers without fields are allowed (review-only participants)

      const safeFilenameBase = (document.title || 'document')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, ' ')
        .slice(0, 120);

      const shouldAttachPdf =
        !!document.file_url &&
        (document.mime_type === 'application/pdf' || document.file_url?.toLowerCase().endsWith('.pdf')) &&
        (document.file_size ?? 0) > 0 &&
        (document.file_size ?? 0) <= 20 * 1024 * 1024;

      const attachmentUrl = shouldAttachPdf ? document.file_url : undefined;
      const attachmentFilename = shouldAttachPdf ? `${safeFilenameBase}.pdf` : undefined;
      const attachmentMimeType = shouldAttachPdf ? (document.mime_type || 'application/pdf') : undefined;

      // Build external signing link base URL.
      // Priority: explicit env URL > current non-preview origin > published app URL fallback
      const publishedBaseUrl = 'https://efinsuite.com';
      const envBaseUrl = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const isPreviewOrigin = currentOrigin.includes('.lovableproject.com');
      const baseUrl = (envBaseUrl || (!isPreviewOrigin && currentOrigin ? currentOrigin : publishedBaseUrl)).replace(/\/+$/, '');
      const documentPublicUrl = document.file_url || undefined;

      // Call edge function to send notifications
      const notificationResults = await Promise.all(
        (signers || []).map(async (signer: { id: string; email: string; name: string | null; phone_number: string | null; auth_method: string }) => {
          // IMPORTANT: signing link must target the *signer* (not the document)
          // External signers are not logged in, so the /docsign route must detect ?sign= and render the signer portal.
          const signingUrl = `${baseUrl}/docsign?sign=${signer.id}`;

          const htmlMessage = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1e40af;">Document Signing Request</h2>
              <p>Hi ${signer.name || 'Signer'},</p>
              <p>You have been requested to sign <strong>"${document.title}"</strong>.</p>
              ${documentPublicUrl ? `
                <p>
                  <strong>Document PDF:</strong>
                  <a href="${documentPublicUrl}" style="color: #1e40af;">Download / View</a>
                  ${shouldAttachPdf ? '(also attached to this email)' : ''}
                </p>
              ` : ''}
              <p>
                <a href="${signingUrl}" 
                   style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                  Review &amp; Sign Document
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link: ${signingUrl}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
              <p style="color: #999; font-size: 12px;">Powered by eFinsuite Globe</p>
            </div>
          `;

          const results: { channel: string; success: boolean; error?: string }[] = [];

          // Send email via SendGrid
          try {
            const emailResult = await supabase.functions.invoke('resend-integration', {
              body: {
                action: 'send-email',
                to: signer.email,
                subject: `Action Required: Please sign "${document.title}"`,
                message: `Hi ${signer.name || 'Signer'}, you have been requested to sign "${document.title}". ${documentPublicUrl ? `Document: ${documentPublicUrl}. ` : ''}Please visit: ${signingUrl}`,
                html: htmlMessage,
                attachmentUrl,
                attachmentFilename,
                attachmentMimeType,
              },
            });
            console.log('SendGrid email result:', emailResult);
            results.push({ channel: 'email', success: !!emailResult.data?.success, error: emailResult.error?.message || emailResult.data?.error });
          } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            console.error('SendGrid email error:', errorMessage);
            results.push({ channel: 'email', success: false, error: errorMessage });
          }

          // Send SMS if phone available and auth_method is sms
          if (signer.phone_number && signer.auth_method === 'sms') {
            try {
              const smsResult = await supabase.functions.invoke('twilio-send-message', {
                body: {
                  action: 'send',
                  channel: 'sms',
                  to: signer.phone_number,
                  message: `eFinsuite: You've been requested to sign "${document.title}". Check your email for the signing link.`,
                },
              });
              results.push({ channel: 'sms', success: !!smsResult.data?.success, error: smsResult.error?.message });
            } catch (e: unknown) {
              const errorMessage = e instanceof Error ? e.message : 'Unknown error';
              results.push({ channel: 'sms', success: false, error: errorMessage });
            }
          }

          return { signer: signer.email, results };
        })
      );

      console.log('Notification results:', notificationResults);

      const emailFailures = notificationResults
        .flatMap((r) => r.results.filter((x) => x.channel === 'email' && !x.success).map((x) => ({ signer: r.signer, error: x.error })))

      if (emailFailures.length > 0) {
        throw new Error(
          `Failed to send signing email to: ${emailFailures
            .map((f) => `${f.signer}${f.error ? ` (${f.error})` : ''}`)
            .join(', ')}`
        );
      }

      // Only mark as sent AFTER emails were successfully dispatched
      const { error: docError } = await supabase
        .from('documents')
        .update({ status: 'sent' })
        .eq('id', documentId);

      if (docError) throw docError;

      // Only update signers who are NOT already signed (preserve sender's signed status)
      const { error: signerError } = await supabase
        .from('document_signers')
        .update({ status: 'sent' })
        .eq('document_id', documentId)
        .neq('status', 'signed');

      if (signerError) throw signerError;

      const { error: auditError } = await supabase
        .from('document_audit_logs')
        .insert({
          document_id: documentId,
          action: 'document_sent',
          actor_type: 'user',
          details: {
            sent_at: new Date().toISOString(),
            attachment_included: !!attachmentUrl,
            attachment_skipped_reason: attachmentUrl ? null : (documentPublicUrl ? 'file too large or not a PDF' : 'no file'),
          },
        });

      if (auditError) console.error('Audit log error:', auditError);

      return { success: true, notifications: notificationResults };
    },
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-signers', documentId] });
      toast.success('Document sent for signing. Notifications dispatched.');
    },
    onError: (error) => {
      toast.error('Failed to send document: ' + error.message);
    },
  });
}