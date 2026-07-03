import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ExtractedRow {
  [key: string]: string | number | null;
}

export interface PdfToSpreadsheetResult {
  success: boolean;
  fileName: string;
  totalPages: number;
  processedPages: number;
  columns: string[];
  rows: ExtractedRow[];
  sheets?: { name: string; columns: string[]; rows: ExtractedRow[] }[];
  documentType?: 'bank_statement' | 'credit_card_statement' | 'generic_table';
  summary?: {
    openingBalance?: number;
    closingBalance?: number;
    totalDebits?: number;
    totalCredits?: number;
    periodStart?: string;
    periodEnd?: string;
  };
  reconciled?: boolean;
  validationWarnings?: string[];
  downloadUrl?: string;
  message: string;
  processingTimeMs: number;
  error?: string;
}

interface ConvertOptions {
  maxPages?: number;
  extractTables?: boolean;
  useAI?: boolean;
}

export function usePdfToSpreadsheet() {
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const convertPdfToSpreadsheet = useCallback(async (
    file: File,
    options: ConvertOptions = {}
  ): Promise<PdfToSpreadsheetResult | null> => {
    setIsConverting(true);
    setError(null);
    setProgress({ current: 0, total: 100 });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('maxPages', String(options.maxPages || 500));
      formData.append('extractTables', String(options.extractTables !== false));
      formData.append('useAI', String(options.useAI !== false));

      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (!prev) return { current: 10, total: 100 };
          const next = Math.min(prev.current + Math.random() * 15, 90);
          return { current: next, total: 100 };
        });
      }, 1000);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pdf-to-spreadsheet`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      clearInterval(progressInterval);
      setProgress({ current: 100, total: 100 });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        console.error('PDF conversion response error:', response.status, errorData);
        throw new Error(errorData.error || `Conversion failed (${response.status})`);
      }

      const result = await response.json();
      console.log('PDF conversion completed:', result.success ? `${result.rows?.length} rows extracted` : result.error);
      return result as PdfToSpreadsheetResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Conversion failed';
      setError(message);
      console.error('PDF to spreadsheet error:', err);
      return null;
    } finally {
      setIsConverting(false);
      setProgress(null);
    }
  }, []);

  const convertFromUrl = useCallback(async (
    fileUrl: string,
    fileName: string,
    options: ConvertOptions = {}
  ): Promise<PdfToSpreadsheetResult | null> => {
    setIsConverting(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('pdf-to-spreadsheet', {
        body: {
          fileUrl,
          fileName,
          maxPages: options.maxPages || 500,
          extractTables: options.extractTables !== false,
          useAI: options.useAI !== false,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      return data as PdfToSpreadsheetResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Conversion failed';
      setError(message);
      console.error('PDF to spreadsheet error:', err);
      return null;
    } finally {
      setIsConverting(false);
    }
  }, []);

  return {
    convertPdfToSpreadsheet,
    convertFromUrl,
    isConverting,
    progress,
    error,
  };
}
