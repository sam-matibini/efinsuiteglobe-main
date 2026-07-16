// Phase 4 — AI categorization review dialog for AP lines (bills + expense claims).
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useOrganization";
import { useAPCategorization, type APTarget } from "@/hooks/useAPCategorization";
import type { CategorizationSuggestion } from "@/hooks/useAICategorization";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: APTarget;
}

interface LineLike {
  id: string;
  description: string | null;
  amount: number | null;
  parent_label: string | null;
}

export function AICategorizeAPDialog({ open, onOpenChange, target }: Props) {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { categorize, applySuggestions, promoteRules, isCategorizing, isApplying } =
    useAPCategorization();

  const [suggestions, setSuggestions] = useState<CategorizationSuggestion[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [threshold, setThreshold] = useState(85);
  const [hasRun, setHasRun] = useState(false);
  const [learnedRules, setLearnedRules] = useState<number | null>(null);

  // Fetch uncategorized lines
  const { data: lines = [], isLoading: linesLoading } = useQuery({
    queryKey: ["ap-uncategorized-lines", target, organization?.id],
    queryFn: async (): Promise<LineLike[]> => {
      if (!organization?.id) return [];
      if (target === "bill") {
        const { data } = await supabase
          .from("bill_lines")
          .select("id, description, amount, bills!inner(organization_id, bill_number, vendor:vendor_id(name))")
          .is("expense_account_id", null)
          .eq("bills.organization_id", organization.id)
          .limit(200);
        return (data ?? []).map((r: any) => ({
          id: r.id,
          description: r.description,
          amount: r.amount,
          parent_label: r.bills?.vendor?.name
            ? `${r.bills.vendor.name} · ${r.bills.bill_number ?? ""}`
            : r.bills?.bill_number ?? null,
        }));
      }
      const { data } = await supabase
        .from("expense_claim_lines")
        .select("id, description, amount, expense_claims!inner(organization_id, claim_number, employee:employee_id(first_name, last_name))")
        .is("expense_account_id", null)
        .eq("expense_claims.organization_id", organization.id)
        .limit(200);
      return (data ?? []).map((r: any) => {
        const emp = r.expense_claims?.employee;
        const empName = emp ? `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim() : "";
        return {
          id: r.id,
          description: r.description,
          amount: r.amount,
          parent_label: empName
            ? `${empName} · ${r.expense_claims?.claim_number ?? ""}`
            : r.expense_claims?.claim_number ?? null,
        };
      });
    },
    enabled: !!organization?.id && open,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-lite-ap", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data } = await supabase
        .from("accounts")
        .select("id, code, name, account_type")
        .eq("organization_id", organization.id)
        .eq("is_active", true);
      return data ?? [];
    },
    enabled: !!organization?.id && open,
  });

  const accountMap = useMemo(() => {
    const m = new Map<string, { code: string; name: string; account_type: string }>();
    for (const a of accounts) m.set(a.id, a);
    return m;
  }, [accounts]);

  const lineMap = useMemo(() => {
    const m = new Map<string, LineLike>();
    for (const l of lines) m.set(l.id, l);
    return m;
  }, [lines]);

  useEffect(() => {
    if (!open) {
      setSuggestions([]);
      setAccepted({});
      setHasRun(false);
      setLearnedRules(null);
    }
  }, [open]);

  const runCategorize = async () => {
    if (!organization?.id || lines.length === 0) return;
    const res = await categorize(
      organization.id,
      target,
      lines.map((l) => l.id),
    );
    setSuggestions(res);
    const initial: Record<string, boolean> = {};
    for (const s of res) {
      initial[s.id] = !!s.gl_account_id && s.confidence * 100 >= threshold;
    }
    setAccepted(initial);
    setHasRun(true);
    if (res.length === 0) toast.info("No suggestions returned");
  };

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
    const n = await applySuggestions(target, acceptedList);
    toast.success(`Applied ${n} categorizations`);

    if (organization?.id) {
      const aiPromotions = acceptedList
        .filter((s) => s.source === "ai" && s.gl_account_id)
        .map((s) => {
          const l = lineMap.get(s.id);
          return {
            description: l?.description ?? null,
            gl_account_id: s.gl_account_id!,
            category: s.category ?? null,
          };
        });
      if (aiPromotions.length > 0) {
        const created = await promoteRules(organization.id, aiPromotions);
        setLearnedRules(created);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["bills"] });
    queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
    queryClient.invalidateQueries({ queryKey: ["ap-uncategorized-lines"] });

    setTimeout(() => onOpenChange(false), learnedRules && learnedRules > 0 ? 1200 : 400);
  };

  const title =
    target === "bill" ? "AI Categorize Bill Lines" : "AI Categorize Expense Claim Lines";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Gemini suggests an expense account and category for each uncategorized line.
            Review and accept below — accepted merchants are learned into rules.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
          {!hasRun && (
            <div className="rounded-lg border p-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {linesLoading
                  ? "Loading uncategorized lines…"
                  : `${lines.length} uncategorized line${lines.length === 1 ? "" : "s"} found.`}
              </p>
              <Button
                onClick={runCategorize}
                disabled={isCategorizing || lines.length === 0 || linesLoading}
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
                  Auto-accept ≥ <span className="font-semibold">{threshold}%</span> confidence
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
                      <th className="p-2">Line</th>
                      <th className="p-2 w-24 text-right">Amount</th>
                      <th className="p-2">Suggested Account</th>
                      <th className="p-2 w-32">Category</th>
                      <th className="p-2 w-24">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.map((s) => {
                      const l = lineMap.get(s.id);
                      const acc = s.gl_account_id ? accountMap.get(s.gl_account_id) : null;
                      const conf = Math.round(s.confidence * 100);
                      const disabled = !s.gl_account_id;
                      return (
                        <tr
                          key={s.id}
                          className={cn("border-t", disabled && "bg-muted/30 opacity-60")}
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
                              {l?.description || "—"}
                            </div>
                            {l?.parent_label && (
                              <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                                {l.parent_label}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {Number(l?.amount ?? 0).toFixed(2)}
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
                                conf >= 85 ? "default" : conf >= 60 ? "secondary" : "outline"
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

        <div className="border-t p-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            {learnedRules !== null && learnedRules > 0 && (
              <span className="text-xs text-muted-foreground">
                ✨ Learned {learnedRules} new rule{learnedRules === 1 ? "" : "s"}
              </span>
            )}
          </div>
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
