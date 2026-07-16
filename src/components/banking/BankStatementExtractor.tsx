// Phase 2 — Gemini-powered bank statement extractor with review + import.
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileUp, Loader2, Sparkles, CheckCircle2, AlertTriangle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import {
  useBankStatementExtraction,
  type BankExtraction,
  type ExtractedTransaction,
} from "@/hooks/useBankStatementExtraction";
import { cn } from "@/lib/utils";

export interface ImportedTxnForCategorization {
  id: string;
  description: string | null;
  amount: number;
  transaction_type: string | null;
  payee_payor?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBankAccountId?: string;
  onImported?: (count: number, imported?: ImportedTxnForCategorization[]) => void;
}

type ReviewRow = ExtractedTransaction & { include: boolean; error?: string };

function validateRow(r: ExtractedTransaction): string | undefined {
  if (!r.date || Number.isNaN(new Date(r.date).getTime())) return "Invalid date";
  if (typeof r.amount !== "number" || Number.isNaN(r.amount)) return "Invalid amount";
  if (!r.description?.trim()) return "Missing description";
  if (r.type !== "debit" && r.type !== "credit") return "Invalid type";
  return undefined;
}

export function BankStatementExtractor({
  open,
  onOpenChange,
  defaultBankAccountId,
  onImported,
}: Props) {
  const { currentOrganization } = useOrganizationContext();
  const { extractFromFile, isExtracting } = useBankStatementExtraction();

  const [file, setFile] = useState<File | null>(null);
  const [extraction, setExtraction] = useState<BankExtraction | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [bankAccountId, setBankAccountId] = useState<string | undefined>(defaultBankAccountId);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, name, account_number, institution, currency")
        .eq("organization_id", currentOrganization.id)
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrganization?.id && open,
  });

  // Auto-match extracted account to bank_accounts by last-4 digits.
  const suggestedAccountId = useMemo(() => {
    if (!extraction?.account?.account_number_masked) return undefined;
    const masked = extraction.account.account_number_masked.replace(/\D/g, "");
    const last4 = masked.slice(-4);
    if (!last4) return undefined;
    return bankAccounts.find((a) =>
      (a.account_number ?? "").replace(/\D/g, "").endsWith(last4),
    )?.id;
  }, [extraction, bankAccounts]);

  const handleExtract = useCallback(async () => {
    if (!file || !currentOrganization?.id) return;
    const result = await extractFromFile(currentOrganization.id, file);
    if (!result) {
      toast.error("Extraction failed");
      return;
    }
    const ex = result.extraction;
    setExtraction(ex);
    const initialRows: ReviewRow[] = (ex.transactions ?? []).map((t) => ({
      ...t,
      include: true,
      error: validateRow(t),
    }));
    setRows(initialRows);
    if (suggestedAccountId && !bankAccountId) setBankAccountId(suggestedAccountId);
    toast.success(
      `Extracted ${initialRows.length} transactions (confidence ${Math.round((ex.confidence ?? 0) * 100)}%)`,
    );
  }, [file, currentOrganization, extractFromFile, suggestedAccountId, bankAccountId]);

  const updateRow = (idx: number, patch: Partial<ReviewRow>) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, ...patch };
        next.error = validateRow(next);
        return next;
      }),
    );
  };

  const includedValid = rows.filter((r) => r.include && !r.error);

  const handleImport = useCallback(async () => {
    if (!bankAccountId) {
      toast.error("Select a bank account");
      return;
    }
    if (includedValid.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setImporting(true);
    try {
      const payload = includedValid.map((r) => ({
        bank_account_id: bankAccountId,
        transaction_date: r.date,
        description: r.description,
        amount: Math.abs(r.amount),
        transaction_type: r.type === "credit" ? "deposit" : "withdrawal",
        reference: r.reference ?? null,
        memo: `AI extracted${file ? ` from ${file.name}` : ""}`,
        status: "pending",
      }));
      const { error } = await supabase.from("bank_transactions").insert(payload);
      if (error) throw error;
      toast.success(`Imported ${payload.length} transactions`);
      onImported?.(payload.length);
      // Reset
      setFile(null);
      setExtraction(null);
      setRows([]);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [bankAccountId, includedValid, file, onImported, onOpenChange]);

  const confidencePct = extraction ? Math.round((extraction.confidence ?? 0) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Bank Statement Extractor
          </DialogTitle>
          <DialogDescription>
            Upload a PDF or image statement — Gemini extracts every transaction and lets you
            review before import.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
          {!extraction && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                  "hover:border-primary hover:bg-primary/5",
                  file ? "border-primary/50 bg-primary/5" : "border-border",
                )}
              >
                <FileUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium">
                  {file ? file.name : "Click to select a PDF or image"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Max 20 MB • PDF, PNG, JPG, WEBP
                </p>
              </div>

              <Button
                className="w-full"
                disabled={!file || isExtracting || !currentOrganization}
                onClick={handleExtract}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Extracting with Gemini…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Extract Transactions
                  </>
                )}
              </Button>
            </>
          )}

          {extraction && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  variant={confidencePct >= 80 ? "default" : "secondary"}
                  className="gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Confidence {confidencePct}%
                </Badge>
                {extraction.account?.bank_name && (
                  <Badge variant="outline">{extraction.account.bank_name}</Badge>
                )}
                {extraction.account?.account_number_masked && (
                  <Badge variant="outline">
                    {extraction.account.account_number_masked}
                  </Badge>
                )}
                {extraction.account?.currency && (
                  <Badge variant="outline">{extraction.account.currency}</Badge>
                )}
                {extraction.account?.statement_period_start &&
                  extraction.account?.statement_period_end && (
                    <Badge variant="outline">
                      {extraction.account.statement_period_start} →{" "}
                      {extraction.account.statement_period_end}
                    </Badge>
                  )}
              </div>

              {(extraction.warnings ?? []).length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" /> Extraction warnings
                  </div>
                  <ul className="mt-1 ml-6 list-disc text-muted-foreground">
                    {extraction.warnings!.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Import into bank account</Label>
                  <Select value={bankAccountId} onValueChange={setBankAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank account…" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                          {a.account_number ? ` • ••${a.account_number.slice(-4)}` : ""}
                          {a.id === suggestedAccountId ? " (suggested)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end text-sm text-muted-foreground">
                  {includedValid.length} of {rows.length} rows ready to import
                </div>
              </div>

              <ScrollArea className="h-[380px] rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 w-10"></th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 w-24">Type</th>
                      <th className="p-2 w-32 text-right">Amount</th>
                      <th className="p-2 w-24">Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={cn(
                          "border-t",
                          r.error && "bg-destructive/5",
                          !r.include && "opacity-50",
                        )}
                      >
                        <td className="p-2">
                          <Checkbox
                            checked={r.include}
                            onCheckedChange={(v) => updateRow(i, { include: !!v })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8"
                            value={r.date}
                            onChange={(e) => updateRow(i, { date: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8"
                            value={r.description}
                            onChange={(e) =>
                              updateRow(i, { description: e.target.value })
                            }
                          />
                          {r.error && (
                            <div className="text-xs text-destructive mt-0.5">{r.error}</div>
                          )}
                        </td>
                        <td className="p-2">
                          <Select
                            value={r.type}
                            onValueChange={(v) =>
                              updateRow(i, { type: v as "debit" | "credit" })
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="debit">Debit</SelectItem>
                              <SelectItem value="credit">Credit</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8 text-right"
                            type="number"
                            step="0.01"
                            value={r.amount}
                            onChange={(e) =>
                              updateRow(i, { amount: parseFloat(e.target.value) })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            className="h-8"
                            value={r.reference ?? ""}
                            onChange={(e) => updateRow(i, { reference: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="border-t p-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setFile(null);
              setExtraction(null);
              setRows([]);
              onOpenChange(false);
            }}
          >
            <X className="h-4 w-4 mr-1" /> Close
          </Button>
          {extraction && (
            <Button
              onClick={handleImport}
              disabled={importing || includedValid.length === 0 || !bankAccountId}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Import {includedValid.length} transactions
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
