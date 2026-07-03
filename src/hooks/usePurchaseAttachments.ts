import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PurchaseEntityType =
  | 'expense_claim'
  | 'expense'
  | 'bill'
  | 'purchase_order'
  | 'vendor';

export interface PurchaseAttachment {
  id: string;
  organization_id: string;
  entity_type: PurchaseEntityType;
  entity_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export const PURCHASE_ATTACHMENTS_BUCKET = 'purchase-attachments';

export function usePurchaseAttachments(
  entityType?: PurchaseEntityType | null,
  entityId?: string | null,
) {
  return useQuery({
    queryKey: ['purchase-attachments', entityType, entityId],
    enabled: !!entityType && !!entityId,
    queryFn: async (): Promise<PurchaseAttachment[]> => {
      const { data, error } = await supabase
        .from('purchase_attachments')
        .select('*')
        .eq('entity_type', entityType!)
        .eq('entity_id', entityId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PurchaseAttachment[];
    },
  });
}

export async function getPurchaseAttachmentSignedUrl(path: string, expiresIn = 300) {
  const { data, error } = await supabase.storage
    .from(PURCHASE_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export function useUploadPurchaseAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      entityType: PurchaseEntityType;
      entityId: string;
      organizationId: string;
      file: File;
      description?: string;
    }) => {
      const { entityType, entityId, organizationId, file, description } = args;
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${organizationId}/${entityType}/${entityId}/${crypto.randomUUID()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(PURCHASE_ATTACHMENTS_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('purchase_attachments').insert({
        entity_type: entityType,
        entity_id: entityId,
        organization_id: organizationId,
        file_name: file.name,
        file_path: path,
        mime_type: file.type || null,
        file_size: file.size,
        description: description || null,
        uploaded_by: userId,
      });
      if (insErr) {
        await supabase.storage.from(PURCHASE_ATTACHMENTS_BUCKET).remove([path]);
        throw insErr;
      }
      return { entityType, entityId };
    },
    onSuccess: ({ entityType, entityId }) => {
      qc.invalidateQueries({ queryKey: ['purchase-attachments', entityType, entityId] });
      toast.success('Attachment uploaded');
    },
    onError: (e: Error) => toast.error(`Upload failed: ${e.message}`),
  });
}

export function useDeletePurchaseAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (att: PurchaseAttachment) => {
      await supabase.storage.from(PURCHASE_ATTACHMENTS_BUCKET).remove([att.file_path]);
      const { error } = await supabase
        .from('purchase_attachments')
        .delete()
        .eq('id', att.id);
      if (error) throw error;
      return { entityType: att.entity_type, entityId: att.entity_id };
    },
    onSuccess: ({ entityType, entityId }) => {
      qc.invalidateQueries({ queryKey: ['purchase-attachments', entityType, entityId] });
      toast.success('Attachment removed');
    },
    onError: (e: Error) => toast.error(`Delete failed: ${e.message}`),
  });
}
