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

async function invokeEfinsign<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  // Auto-inject caller's current organization id when missing or null.
  const withOrg = { ...payload };
  if (!withOrg.organization_id && typeof window !== 'undefined') {
    const currentOrgId = window.localStorage.getItem('current_organization_id');
    if (currentOrgId) withOrg.organization_id = currentOrgId;
  }
  const { data, error } = await supabase.functions.invoke('efinsign-proxy', {
    body: { action, payload: withOrg },
  });
  if (error) {
    let msg = error.message || 'eFinSign request failed';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        if (body?.error) msg = body.error;
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return (data as { data: T }).data;
}


export function useCreateDocument() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();

  return useMutation({
    mutationFn: async (documentData: { title: string; document_type?: string; file_url?: string; mime_type?: string; file_size?: number }) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Resolve org ID: from hook, then localStorage fallback.
      let orgId: string | null =
        organization?.id ||
        (typeof window !== 'undefined' ? window.localStorage.getItem('current_organization_id') : null) ||
        null;

      // If user appears to be missing from organization_members (pre-SQL-migration orgs),
      // try to auto-insert them as owner. Never nullify orgId based on query failures —
      // let the edge function do the definitive membership check.
      if (orgId) {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('id')
          .eq('organization_id', orgId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!membership) {
          const { data: orgRow } = await supabase
            .from('organizations')
            .select('owner_id')
            .eq('id', orgId)
            .maybeSingle();

          if (orgRow?.owner_id === user.id) {
            await supabase.from('organization_members').insert({
              organization_id: orgId,
              user_id: user.id,
              role: 'owner',
            });
          }
          // If we can't confirm ownership (query failed / user isn't owner),
          // keep orgId and let the proxy return a proper 403.
        }
      }

      return await invokeEfinsign<Document>('create_document', {
        ...documentData,
        organization_id: orgId,
      });
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
      return await invokeEfinsign<Document>('update_document', { id, title });
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
      const res = await invokeEfinsign<{ success: boolean; remote?: 'deleted' | 'voided' | 'failed' | 'none'; remote_error?: string }>('delete_document', { id: documentId });
      return { documentId, ...res };
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
    onSuccess: (result) => {
      if (result.remote === 'voided') {
        toast.success("Document voided (eFinSign doesn't allow deleting non-draft documents)");
      } else if (result.remote === 'failed') {
        toast.warning(`Document deleted locally, but remote cleanup failed: ${result.remote_error ?? 'unknown error'}`);
      } else {
        toast.success('Document deleted successfully');
      }
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
      return await invokeEfinsign<DocumentSigner>('add_signer', signerData as unknown as Record<string, unknown>);
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
      return await invokeEfinsign<DocumentField>('add_field', fieldData as unknown as Record<string, unknown>);
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
      fieldId, documentId, assignedSignerId, updates,
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
      };
    }) => {
      // filled_value / filled_at are populated by the signer flow, not by eFinSign geometry endpoints —
      // only forward geometry changes to eFinSign.
      const geometryKeys = ['position_x', 'position_y', 'width', 'height'] as const;
      const hasGeometry = geometryKeys.some((k) => k in updates);
      if (hasGeometry) {
        await invokeEfinsign('update_field', {
          id: fieldId,
          document_id: documentId,
          assigned_signer_id: assignedSignerId,
          updates,
        });
      } else {
        const { error } = await supabase.from('document_fields').update(updates).eq('id', fieldId);
        if (error) throw error;
      }
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
      return await invokeEfinsign('send', { id: documentId });
    },
    onSuccess: (_data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-signers', documentId] });
      toast.success('Document sent for signing via eFinSign.');
    },
    onError: (error) => toast.error('Failed to send document: ' + error.message),
  });
}

export function useVoidDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => invokeEfinsign('void', { id: documentId }),
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      toast.success('Document voided.');
    },
    onError: (error) => toast.error('Failed to void document: ' + error.message),
  });
}

export function useRemindDocument() {
  return useMutation({
    mutationFn: async (documentId: string) => invokeEfinsign('remind', { id: documentId }),
    onSuccess: () => toast.success('Reminder sent to pending signers.'),
    onError: (error) => toast.error('Failed to send reminder: ' + error.message),
  });
}

export function useRefreshDocumentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (documentId: string) => invokeEfinsign('refresh_status', { id: documentId }),
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] });
      queryClient.invalidateQueries({ queryKey: ['document-signers', documentId] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Status refreshed from eFinSign.');
    },
    onError: (error) => toast.error('Failed to refresh status: ' + error.message),
  });
}

export function useSignerSigningUrl() {
  return useMutation({
    mutationFn: async (signerId: string) =>
      invokeEfinsign<{ signing_url: string; url: string }>('get_signing_url', { signer_id: signerId }),
    onError: (error) => toast.error('Failed to get signing URL: ' + error.message),
  });
}

// Downloads the signed PDF (or certificate) from eFinSign via the proxy.
// Returns a browser Blob URL that callers can open or save.
export function useDownloadSignedDocument() {
  return useMutation({
    mutationFn: async ({ documentId, kind = 'signed' }: { documentId: string; kind?: 'signed' | 'certificate' }) => {
      const res = await invokeEfinsign<{ content_type: string; base64: string; filename: string }>(
        'download_signed',
        { id: documentId, kind },
      );
      const binary = atob(res.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: res.content_type });
      return { url: URL.createObjectURL(blob), filename: res.filename };
    },
    onError: (error) => toast.error('Failed to download document: ' + error.message),
  });
}

export function useEfinsignUsage() {
  return useQuery({
    queryKey: ['efinsign-usage'],
    queryFn: async () =>
      invokeEfinsign<{ documents_used?: number; documents_limit?: number; signers_used?: number } & Record<string, unknown>>('usage'),
    staleTime: 5 * 60 * 1000,
  });
}