import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FlattenResult {
  success: boolean;
  pageCount: number;
  hasXfa: boolean;
  previewUrls: string[];
  message?: string;
  error?: string;
}

export function usePdfFlatten() {
  const [isFlattening, setIsFlattening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flattenPdf = useCallback(async (fileUrl: string, documentId: string): Promise<FlattenResult | null> => {
    setIsFlattening(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('flatten-pdf', {
        body: { fileUrl, documentId },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to flatten PDF');
      }

      return data as FlattenResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process PDF';
      setError(message);
      console.error('PDF flatten error:', err);
      return null;
    } finally {
      setIsFlattening(false);
    }
  }, []);

  return {
    flattenPdf,
    isFlattening,
    error,
  };
}
