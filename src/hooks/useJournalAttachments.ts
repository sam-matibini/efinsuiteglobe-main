import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface JournalAttachment {
  id: string;
  journal_entry_id: string;
  organization_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
}

const BUCKET = 'journal-attachments';

export function useJournalAttachments(journalEntryId?: string | null) {
  return useQuery({
    queryKey: ['journal-attachments', journalEntryId],
    enabled: !!journalEntryId,
    queryFn: async (): Promise<JournalAttachment[]> => {
      const { data, error } = await supabase
        .from('journal_entry_attachments')
        .select('*')
        .eq('journal_entry_id', journalEntryId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as JournalAttachment[];
    },
  });
}

export async function getAttachmentSignedUrl(path: string, expiresIn = 300): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export function useUploadJournalAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      journalEntryId: string;
      organizationId: string;
      file: File;
      description?: string;
    }) => {
      const { journalEntryId, organizationId, file, description } = args;
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${organizationId}/${journalEntryId}/${crypto.randomUUID()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('journal_entry_attachments').insert({
        journal_entry_id: journalEntryId,
        organization_id: organizationId,
        file_name: file.name,
        file_path: path,
        mime_type: file.type || null,
        file_size: file.size,
        description: description || null,
        uploaded_by: userId,
      });
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['journal-attachments', vars.journalEntryId] });
      toast.success('Attachment uploaded');
    },
    onError: (e: Error) => toast.error(`Upload failed: ${e.message}`),
  });
}

export function useDeleteJournalAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (att: JournalAttachment) => {
      await supabase.storage.from(BUCKET).remove([att.file_path]);
      const { error } = await supabase
        .from('journal_entry_attachments')
        .delete()
        .eq('id', att.id);
      if (error) throw error;
      return att.journal_entry_id;
    },
    onSuccess: (jeId) => {
      qc.invalidateQueries({ queryKey: ['journal-attachments', jeId] });
      toast.success('Attachment removed');
    },
    onError: (e: Error) => toast.error(`Delete failed: ${e.message}`),
  });
}
