import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ReceiptData {
  vendor_name?: string | null;
  expense_date?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax_amount?: number | null;
  total?: number | null;
  description?: string | null;
  category_suggestion?:
    | 'travel'
    | 'meals'
    | 'office_supplies'
    | 'software'
    | 'equipment'
    | 'professional_development'
    | 'communication'
    | 'transportation'
    | 'lodging'
    | 'other'
    | null;
  line_items?: { description: string; amount: number }[] | null;
}

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useAnalyzeReceipt() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyze = async (file: File): Promise<ReceiptData | null> => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Unsupported file. Use PDF, JPG, PNG, or WEBP.');
      return null;
    }
    if (file.size > MAX_SIZE) {
      toast.error('File too large (max 10MB).');
      return null;
    }
    setIsAnalyzing(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('analyze-receipt', {
        body: { fileBase64, mimeType: file.type, fileName: file.name },
      });
      if (error) throw error;
      if (!data?.data) throw new Error('No data extracted');
      toast.success('Receipt analyzed');
      return data.data as ReceiptData;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to analyze receipt';
      if (msg.includes('429')) toast.error('Rate limit exceeded. Try again shortly.');
      else if (msg.includes('402')) toast.error('AI credits exhausted. Add credits to continue.');
      else toast.error(`Receipt scan failed: ${msg}`);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const uploadReceipt = async (
    file: File,
    organizationId: string,
  ): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${organizationId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from('expense-receipts')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = await supabase.storage
        .from('expense-receipts')
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      return data?.signedUrl ?? path;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      toast.error(`Receipt upload failed: ${msg}`);
      return null;
    }
  };

  const analyzeMany = async (
    files: File[],
  ): Promise<{ perFile: (ReceiptData | null)[]; merged: ReceiptData | null }> => {
    if (!files.length) return { perFile: [], merged: null };
    const perFile = await Promise.all(files.map((f) => analyze(f)));
    const valid = perFile.filter((d): d is ReceiptData => !!d);
    if (!valid.length) return { perFile, merged: null };

    const firstNonEmpty = <K extends keyof ReceiptData>(key: K): ReceiptData[K] | null => {
      for (const d of valid) {
        const v = d[key];
        if (v != null && v !== '') return v as ReceiptData[K];
      }
      return null;
    };
    const sumNumeric = (key: 'subtotal' | 'tax_amount' | 'total'): number | null => {
      let total = 0;
      let found = false;
      for (const d of valid) {
        const v = d[key];
        if (typeof v === 'number' && !Number.isNaN(v)) {
          total += v;
          found = true;
        }
      }
      return found ? Number(total.toFixed(2)) : null;
    };
    const earliestDate = (): string | null => {
      const dates = valid
        .map((d) => d.expense_date)
        .filter((s): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s));
      if (!dates.length) return null;
      return dates.sort()[0];
    };
    const mostFrequentCategory = (): ReceiptData['category_suggestion'] => {
      const counts = new Map<string, number>();
      for (const d of valid) {
        if (d.category_suggestion) {
          counts.set(d.category_suggestion, (counts.get(d.category_suggestion) ?? 0) + 1);
        }
      }
      let best: { k: string; n: number } | null = null;
      for (const [k, n] of counts) {
        if (!best || n > best.n) best = { k, n };
      }
      return (best?.k as ReceiptData['category_suggestion']) ?? null;
    };

    const descriptions = valid
      .map((d) => d.description || d.vendor_name)
      .filter((s): s is string => !!s);
    const lineItems = valid.flatMap((d) => d.line_items ?? []);

    const merged: ReceiptData = {
      vendor_name: firstNonEmpty('vendor_name'),
      expense_date: earliestDate(),
      currency: firstNonEmpty('currency'),
      subtotal: sumNumeric('subtotal'),
      tax_amount: sumNumeric('tax_amount'),
      total: sumNumeric('total'),
      description: descriptions.length ? descriptions.join(' + ') : null,
      category_suggestion: mostFrequentCategory(),
      line_items: lineItems.length ? lineItems : null,
    };
    return { perFile, merged };
  };

  const uploadMany = async (files: File[], organizationId: string): Promise<string[]> => {
    if (!files.length) return [];
    const results = await Promise.all(files.map((f) => uploadReceipt(f, organizationId)));
    return results.filter((u): u is string => !!u);
  };

  return { analyze, uploadReceipt, analyzeMany, uploadMany, isAnalyzing };
}
