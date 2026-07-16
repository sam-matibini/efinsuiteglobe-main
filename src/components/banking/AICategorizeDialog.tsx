// Phase 3 — AI categorization review dialog.
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import {
  useAICategorization,
  type CategorizationSuggestion,
} from "@/hooks/useAICategorization";
import { cn } from "@/lib/utils";

interface TxnLike {
  id: string;
  description: string | null;
  amount: number | string;
  transaction_type: string | null;
  payee_payor?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: TxnLike[];
  onApplied?: (count: number) => void;
}

export function AICategorizeDialog({
  open,
  onOpenChange,
  transactions,
  onApplied,
}: Props) {
  const { currentOrganization } = useOrganizationContext();
  const { categorize, applySuggestions, isCategorizing, isApplying } =
    useAICategorization();

  const [suggestions, setSuggestions] = useState<CategorizationSuggestion[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [threshold, setThreshold] = useState(85);
  const [hasRun, setHasRun] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-lite", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data } = await supabase
        .from("accounts")
        .select("id, code, name, account_type")
        .eq("organization_id", currentOrganization.id)
        .eq("is_active", true);
      return data ?? [];
    },
    enabled: !!currentOrganization?.id && open,
  });

  const accountMap = useMemo(() => {
    const m = new Map<string, { code: string; name: string; account_type: string }>();
    for (const a of accounts) m.set(a.id, a);
    return m;
  }, [accounts]);

  const txnMap = useMemo(() => {
    const m = new Map<string, TxnLike>();
    for (const t of transactions) m.set(t.id, t);
    return m;
  }, [transactions]);

  useEffect(() => {
    if (!open) {
      setSuggestions([]);
      setAccepted({});
      setHasRun(false);
    }
  }, [open]);

  const runCategorize = async () => {
    if (!currentOrganization?.id || transactions.length === 0) return;
    const res = await categorize(
      currentOrganization.id,
      transactions.map((t) => t.id),
    );
    setSuggestions(res);
    // Default-accept anything at or above threshold with a valid suggestion.
    const initial: Record<string, boolean> = {};
    for (const s of res) {
      initial[s.id] = !!s.gl_account_id && s.confidence * 100 >= threshold;
    }
    setAccepted(initial);
    setHasRun(true);
    if (res.length === 0) toast.info("No suggestions returned");
  };

  // Re-select when threshold changes.
  useEffect(() => {
    if (!hasRun) return;
    setAccepted((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const s of suggestions) {
        next[s.id] = !!s.gl_account_id && s.confidence * 100 >= threshold;
      }
      return next;
    });
  }, [threshold, hasRun, suggestions]);

  const acceptedList = suggestions.filter((s) => accepted[s.id] && s.gl_account_id);

  const handleApply = async () => {
    const n = await applySuggestions(acceptedList);
    toast.success(`Applied ${n} categorizations`);
    onApplied?.(n);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Transaction Categorization
          </DialogTitle>
          <DialogDescription>
            Gemini suggests a GL account and category for each transaction. Review and
            accept below.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
          {!hasRun && (
            <div className="rounded-lg border p-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {transactions.length} transaction{transactions.length === 1 ? "" : "s"}{" "}
                queued for AI categorization.
              </p>
              <Button
                onClick={runCategorize}
                disabled={isCategorizing || transactions.length === 0}
              >
                {isCategorizing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" /> Run categorization
                  </>
                )}
              </Button>
            </div>
          )}

          {hasRun && (
            <>
              <div className="flex items-center gap-4">
                <Label className="text-sm">
                  Auto-accept ≥ <span className="font-semibold">{threshold}%</span>{" "}
                  confidence
                </Label>
                <div className="flex-1 max-w-xs">
                  <Slider
                    value={[threshold]}
                    onValueChange={(v) => setThreshold(v[0] ?? 85)}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
                <Badge variant="secondary">
                  {acceptedList.length} of {suggestions.length} selected
                </Badge>
              </div>

              <ScrollArea className="h-[420px] rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 w-10"></th>
                      <th className="p-2">Transaction</th>
                      <th className="p-2 w-24 text-right">Amount</th>
                      <th className="p-2">Suggested Account</th>
                      <th className="p-2 w-32">Category</th>
                      <th className="p-2 w-24">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map((s) => {
                      const t = txnMap.get(s.id);
                      const acc = s.gl_account_id ? accountMap.get(s.gl_account_id) : null;
                      const conf = Math.round(s.confidence * 100);
                      const disabled = !s.gl_account_id;
                      return (
                        <tr
                          key={s.id}
                          className={cn(
                            "border-t",
                            disabled && "bg-muted/30 opacity-60",
                          )}
                        >
                          <td className="p-2">
                            <Checkbox
                              disabled={disabled}
                              checked={!!accepted[s.id]}
                              onCheckedChange={(v) =>
                                setAccepted((prev) => ({ ...prev, [s.id]: !!v }))
                              }
                            />
                          </td>
                          <td className="p-2">
                            <div className="font-medium truncate max-w-[280px]">
                              {t?.payee_payor || t?.description || "—"}
                            </div>
                            {t?.description && t?.payee_payor && (
                              <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                                {t.description}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {Number(t?.amount ?? 0).toFixed(2)}
                          </td>
                          <td className="p-2">
                            {acc ? (
                              <span>
                                <span className="text-muted-foreground">{acc.code}</span>{" "}
                                {acc.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">
                                No suggestion
                              </span>
                            )}
                          </td>
                          <td className="p-2">{s.category ?? "—"}</td>
                          <td className="p-2">
                            <Badge
                              variant={
                                conf >= 85
                                  ? "default"
                                  : conf >= 60
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {conf}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="border-t p-4 flex justify-between gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          {hasRun && (
            <Button
              onClick={handleApply}
              disabled={isApplying || acceptedList.length === 0}
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Apply {acceptedList.length} categorizations
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
