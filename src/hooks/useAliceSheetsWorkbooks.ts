// Phase 9 — Lists AI Sheets workbooks stored by `pdf-to-spreadsheet`
// (bucket: docsign-documents, prefix: ai-sheets/). Provides an alternative
// feed for the Statement Extraction Engine.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AliceSheetsWorkbook {
  path: string; // full object path under bucket, e.g. "ai-sheets/1234-foo.xlsx"
  name: string; // display filename
  uploaded_at: string; // ISO timestamp
  size: number;
}

const BUCKET = 'docsign-documents';
const PREFIX = 'ai-sheets';

export function useAliceSheetsWorkbooks(enabled = true) {
  return useQuery({
    queryKey: ['alice-sheets-workbooks'],
    enabled,
    queryFn: async (): Promise<AliceSheetsWorkbook[]> => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(PREFIX, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' },
        });
      if (error) throw error;
      return (data ?? [])
        .filter((o) => o.name.toLowerCase().endsWith('.xlsx'))
        .map((o) => ({
          path: `${PREFIX}/${o.name}`,
          name: o.name,
          uploaded_at: o.created_at ?? o.updated_at ?? new Date().toISOString(),
          size: (o.metadata as { size?: number } | null)?.size ?? 0,
        }));
    },
    staleTime: 30_000,
  });
}

export async function downloadAliceSheetsWorkbook(path: string): Promise<ArrayBuffer> {
  // Try signed URL first (works for private buckets); fall back to public URL.
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 300);
  const url =
    signed?.signedUrl ??
    supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download workbook (${res.status})`);
  return res.arrayBuffer();
}
