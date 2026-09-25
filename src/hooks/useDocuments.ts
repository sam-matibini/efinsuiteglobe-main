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
        .eq('organization_id', organization?.id)
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

      // Verify the user is a member of the current org. The DocSign page
      // shows an upfront banner for the view-only case, so a plain error
      // here is fine as a safety net.
      const { data: memberships, error: memErr } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id);
      if (memErr) throw new Error(`Could not load your organizations: ${memErr.message}`);
      if (!memberships || memberships.length === 0) {
        throw new Error('You are not a member of any organization. Create one or ask to be invited.');
      }

      const memberOrgIds = memberships.map((m) => m.organization_id);
      const preferred =
        organization?.id ||
        (typeof window !== 'undefined' ? window.localStorage.getItem('current_organization_id') : null) ||
        null;

      if (!preferred || !memberOrgIds.includes(preferred)) {
        throw new Error('Switch to an organization you belong to before creating documents.');
      }
      const orgId = preferred;

      const { data, error } = await supabase
        .from('documents')
        .insert({
          ...documentData,
          organization_id: orgId,
          owner_id: user.id,
          status: 'draft',
        })
        .select()
        .single();
      if (error) throw error;
      return data as Document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document created successfully');
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title }: { id: string; status?: string; title?: string; expires_at?: string; completed_at?: string }) => {
      const { data, error } = await supabase
        .from('documents')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Document;
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
      const { error } = await supabase.from('documents').delete().eq('id', documentId);
      if (error) throw error;
      return { documentId };
    },
    onMutate: async (documentId) => {
      await queryClient.cancelQueries({ queryKey: ['documents'] });
      const previousDocuments = queryClient.getQueriesData<Document[]>({ queryKey: ['documents'] });
      previousDocuments.forEach(([queryKey, docs]) => {
        if (!docs) return;
        queryClient.setQueryData<Document[]>(queryKey, docs.filter((doc) => doc.id !== documentId));
      });
      return { previousDocuments };
    },
    onSuccess: () => {
      toast.success('Document deleted successfully');
    },
    onError: (error, _documentId, context) => {
      context?.previousDocuments?.forEach(([queryKey, docs]) => queryClient.setQueryData(queryKey, docs));
      toast.error('Failed to delete document: ' + error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useAddSigner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (signerData: Omit<DocumentSigner, 'id' | 'viewed_at' | 'signed_at' | 'declined_at' | 'decline_reason' | 'consent_given' | 'consent_timestamp' | 'signature_data'>) => {
      const { data, error } = await supabase
        .from('document_signers')
        .insert({
          ...signerData,
          status: signerData.status ?? 'pending',
          consent_given: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DocumentSigner;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['document-signers', data.document_id] });
      toast.success('Signer added successfully');
    },
    onError: (error) => toast.error('Failed to add signer: ' + error.message),
  });
}

export function useAddField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fieldData: Omit<DocumentField, 'id' | 'filled_value' | 'filled_at'>) => {
      const { data, error } = await supabase
        .from('document_fields')
        .insert({ ...fieldData, filled_value: null, filled_at: null })
        .select()
        .single();
      if (error) throw error;
      return data as DocumentField;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['document-fields', data.document_id] });
    },
    onError: (error) => toast.error('Failed to add field: ' + error.message),
  });
}

export function useUpdateDocumentField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fieldId, documentId, updates,
    }: {
      fieldId: string;
      documentId: string;
      assignedSignerId?: string;
      updates: {
        filled_value?: string | null;
        filled_at?: string | null;
        position_x?: number;
        position_y?: number;
        width?: number;
        height?: number;
        assigned_signer_id?: string | null;
      };
    }) => {
      const { error } = await supabase.from('document_fields').update(updates).eq('id', fieldId);
      if (error) throw error;
      return { fieldId, documentId };
    },
    onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ['document-fields', data.documentId] }),
    onError: (error) => console.error('Failed to update field:', error),
  });
}

export function useSendDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase.functions.invoke('send-for-signing', {
        body: { document_id: documentId },
      });
      if (error) {
        let msg = error.message || 'Failed to send';
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as { sent: number; total: number };
    },
    onSuccess: (data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-signers', documentId] });
      toast.success(`Signing invitations sent to ${data.sent} signer${data.sent !== 1 ? 's' : ''}.`);
    },
    onError: (error) => toast.error('Failed to send document: ' + error.message),
  });
}

export function useVoidDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from('documents')
        .update({ status: 'voided', updated_at: new Date().toISOString() })
        .eq('id', documentId);
      if (error) throw error;
    },
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      toast.success('Document voided.');
    },
    onError: (error) => toast.error('Failed to void document: ' + error.message),
  });
}

export function useRemindDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase.functions.invoke('send-for-signing', {
        body: { document_id: documentId },
      });
      if (error) throw new Error(error.message);
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as { sent: number; total: number };
    },
    onSuccess: (data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['document-signers', documentId] });
      toast.success(`Reminder sent to ${data.sent} signer${data.sent !== 1 ? 's' : ''}.`);
    },
    onError: (error) => toast.error('Failed to send reminder: ' + error.message),
  });
}

export function useRefreshDocumentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => documentId,
    onSuccess: (documentId) => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-signers', documentId] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Status refreshed.');
    },
  });
}

// Returns the first-party signing URL for a signer row.
export function useSignerSigningUrl() {
  return useMutation({
    mutationFn: async (signerId: string) => {
      const { data, error } = await supabase
        .from('document_signers')
        .select('signing_token')
        .eq('id', signerId)
        .single();
      if (error) throw error;
      const token = (data as { signing_token: string }).signing_token;
      const url = `${window.location.origin}/docsign?token=${token}`;
      return { signing_url: url, url };
    },
    onError: (error) => toast.error('Failed to get signing URL: ' + error.message),
  });
}

// Returns a blob URL for the document's stored PDF.
// After Phase 3b (PDF baking), signed_pdf_url will point to the baked copy.
export function useDownloadSignedDocument() {
  return useMutation({
    mutationFn: async ({ documentId }: { documentId: string; kind?: 'signed' | 'certificate' }) => {
      const { data: doc, error } = await supabase
        .from('documents')
        .select('title, signed_pdf_url, file_url')
        .eq('id', documentId)
        .single();
      if (error) throw error;
      const fileUrl = (doc as { title: string; signed_pdf_url: string | null; file_url: string | null }).signed_pdf_url
        || (doc as { title: string; signed_pdf_url: string | null; file_url: string | null }).file_url;
      if (!fileUrl) throw new Error('No file available for this document');
      const filename = `${(doc as { title: string }).title ?? 'document'}.pdf`;
      // Open directly — signed URLs from storage work as download links
      return { url: fileUrl, filename };
    },
    onError: (error) => toast.error('Failed to download document: ' + error.message),
  });
}

// Document count from our own DB — replaces the eFinSign usage API.
export function useEfinsignUsage() {
  const { organization } = useCurrentOrganization();
  return useQuery({
    queryKey: ['docsign-usage', organization?.id],
    queryFn: async () => {
      const [docRes, signerRes] = await Promise.all([
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('organization_id', organization!.id),
        supabase.from('document_signers').select('id', { count: 'exact', head: true }),
      ]);
      return {
        documents_used: docRes.count ?? 0,
        documents_limit: null,
        signers_used: signerRes.count ?? 0,
      };
    },
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });
}