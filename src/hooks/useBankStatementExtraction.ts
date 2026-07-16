// Client hook for Phase 2 AI bank statement extraction.
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ExtractedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
  balance?: number;
  reference?: string;
}

export interface BankExtraction {
  account?: {
    bank_name?: string;
    account_number_masked?: string;
    currency?: string;
    statement_period_start?: string;
    statement_period_end?: string;
  };
  opening_balance?: number;
  closing_balance?: number;
  transactions: ExtractedTransaction[];
  confidence: number;
  warnings?: string[];
}

export interface ExtractResult {
  extraction: BankExtraction;
  confidence: number | null;
  cached: boolean;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(buf.subarray(i, i + chunk)) as unknown as number[],
    );
  }
  return btoa(bin);
}

export function useBankStatementExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractFromFile = useCallback(
    async (organizationId: string, file: File): Promise<ExtractResult | null> => {
      setIsExtracting(true);
      setError(null);
      try {
        if (file.size > 20 * 1024 * 1024) {
          throw new Error("File exceeds 20MB limit");
        }
        const fileBase64 = await fileToBase64(file);
        const { data, error: fnError } = await supabase.functions.invoke(
          "ai-extract-bank-statement",
          {
            body: {
              organization_id: organizationId,
              fileBase64,
              mimeType: file.type || "application/pdf",
              filename: file.name,
            },
          },
        );
        if (fnError) throw new Error(fnError.message);
        if ((data as { error?: string })?.error) {
          throw new Error((data as { error: string }).error);
        }
        return data as ExtractResult;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return null;
      } finally {
        setIsExtracting(false);
      }
    },
    [],
  );

  const extractFromDocument = useCallback(
    async (organizationId: string, documentId: string): Promise<ExtractResult | null> => {
      setIsExtracting(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "ai-extract-bank-statement",
          { body: { organization_id: organizationId, documentId } },
        );
        if (fnError) throw new Error(fnError.message);
        if ((data as { error?: string })?.error) {
          throw new Error((data as { error: string }).error);
        }
        return data as ExtractResult;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return null;
      } finally {
        setIsExtracting(false);
      }
    },
    [],
  );

  return { isExtracting, error, extractFromFile, extractFromDocument };
}
