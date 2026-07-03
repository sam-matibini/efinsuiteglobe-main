import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FileConvertResult {
  success: boolean;
  originalFile: string;
  convertedFile?: string;
  downloadUrl?: string;
  fileType: string;
  pageCount?: number;
  extractedText?: string;
  excelData?: Record<string, unknown>[];
  message: string;
  error?: string;
}

type ConvertAction = 'analyze' | 'to-pdf' | 'from-pdf';

export function useFileConvert() {
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convertFile = useCallback(async (
    file: File,
    action: ConvertAction = 'analyze'
  ): Promise<FileConvertResult | null> => {
    setIsConverting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('action', action);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/file-convert`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'File conversion failed');
      }

      const result = await response.json();
      return result as FileConvertResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'File conversion failed';
      setError(message);
      console.error('File convert error:', err);
      return null;
    } finally {
      setIsConverting(false);
    }
  }, []);

  const convertFromUrl = useCallback(async (
    fileUrl: string,
    fileName: string,
    action: ConvertAction = 'analyze'
  ): Promise<FileConvertResult | null> => {
    setIsConverting(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('file-convert', {
        body: { fileUrl, fileName, action },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      return data as FileConvertResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'File conversion failed';
      setError(message);
      console.error('File convert error:', err);
      return null;
    } finally {
      setIsConverting(false);
    }
  }, []);

  return {
    convertFile,
    convertFromUrl,
    isConverting,
    error,
  };
}
