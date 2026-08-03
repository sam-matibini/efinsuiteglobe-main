import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  PURCHASE_ATTACHMENTS_BUCKET,
  type PurchaseEntityType,
} from '@/hooks/usePurchaseAttachments';

export const STAGED_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx,.csv';
export const STAGED_MAX_BYTES = 20 * 1024 * 1024;

export interface StagedFile {
  id: string;
  file: File;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Holds files dropped into a form before the record exists, then uploads them
 * once the record has been saved (`flush`).
 */
export function useStagedPurchaseAttachments() {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [isFlushing, setIsFlushing] = useState(false);

  const add = useCallback((files: FileList | File[] | null) => {
    if (!files) return;
    const next: StagedFile[] = [];
    for (const file of Array.from(files)) {
      if (file.size > STAGED_MAX_BYTES) {
        toast.error(`${file.name} exceeds 20MB`);
        continue;
      }
      next.push({ id: crypto.randomUUID(), file });
    }
    if (next.length) setStaged((prev) => [...prev, ...next]);
  }, []);

  const remove = useCallback((id: string) => {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clear = useCallback(() => setStaged([]), []);

  /** Upload every staged file against a newly created record. Never throws. */
  const flush = useCallback(
    async (entityType: PurchaseEntityType, entityId: string, organizationId: string) => {
      if (staged.length === 0) return { uploaded: 0, failed: 0 };
      setIsFlushing(true);
      let uploaded = 0;
      let failed = 0;
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes.user?.id ?? null;

        for (const { file } of staged) {
          try {
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
              uploaded_by: userId,
            });
            if (insErr) {
              await supabase.storage.from(PURCHASE_ATTACHMENTS_BUCKET).remove([path]);
              throw insErr;
            }
            uploaded += 1;
          } catch (e) {
            failed += 1;
            console.error('[staged-attachment] upload failed', e);
          }
        }
      } finally {
        setIsFlushing(false);
        setStaged([]);
      }

      if (failed > 0) {
        toast.error(
          `${failed} attachment${failed > 1 ? 's' : ''} could not be uploaded. The record was saved — re-attach from the record menu.`,
        );
      } else if (uploaded > 0) {
        toast.success(`${uploaded} attachment${uploaded > 1 ? 's' : ''} uploaded`);
      }
      return { uploaded, failed };
    },
    [staged],
  );

  return { staged, add, remove, clear, flush, isFlushing, hasStaged: staged.length > 0 };
}
