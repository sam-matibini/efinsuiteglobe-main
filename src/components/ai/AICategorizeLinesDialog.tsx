// Phase 8 — Unified AI categorization review dialog for AP + revenue line targets.
// Fetches uncategorized lines for the given (context, target[, parentId]),
// calls the appropriate edge function, and applies accepted suggestions.
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Check, X, Loader2, Info } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrganization } from "@/hooks/useOrganization";
import { useLineCategorization, type LineTarget } from "@/hooks/useLineCategorization";
import type { CategorizationSuggestion } from "@/hooks/useAICategorization";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: LineTarget;
  parentId?: string;
}

interface LineLike {
  id: string;
  description: string | null;
  amount: number | null;
  parent_label: string | null;
}

const TITLES: Record<LineTarget, string> = {
  bill: "AI Categorize Bill Lines",
  expense: "AI Categorize Expense Claim Lines",
  
  invoice: "AI Categorize Invoice Lines",
  journal: "AI Categorize Journal Lines",
};

async function loadLines(
  target: LineTarget,
  orgId: string,
  parentId?: string,
): Promise<LineLike[]> {
  if (target === "bill") {
    let q = supabase
      .from("bill_lines")
      .select("id, description, amount, bills!inner(organization_id, bill_number, vendor:vendor_id(name))")
      .is("expense_account_id", null)
      .eq("bills.organization_id", orgId)
      .limit(200);
    if (parentId) q = q.eq("bill_id", parentId);
    const { data } = await q;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      description: r.description,
      amount: r.amount,
      parent_label: r.bills?.vendor?.name
        ? `${r.bills.vendor.name} · ${r.bills.bill_number ?? ""}`
        : r.bills?.bill_number ?? null,
    }));
  }
  if (target === "expense") {
    let q = supabase
      .from("expense_claim_lines")
      .select("id, description, amount, expense_claims!inner(organization_id, claim_number, employee:employee_id(first_name, last_name))")
      .is("expense_account_id", null)
      .eq("expense_claims.organization_id", orgId)
      .limit(200);
    if (parentId) q = q.eq("expense_claim_id", parentId);
    const { data } = await q;
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
  }
  if (target === "po") {
    let q = supabase
      .from("purchase_order_lines")
      .select("id, description, line_total, purchase_orders!inner(organization_id, po_number, vendor:vendor_id(name))")
      .is("gl_account_id", null)
      .eq("purchase_orders.organization_id", orgId)
      .limit(200);
    if (parentId) q = q.eq("purchase_order_id", parentId);
    const { data } = await q;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      description: r.description,
      amount: r.line_total,
      parent_label: r.purchase_orders?.vendor?.name
        ? `${r.purchase_orders.vendor.name} · ${r.purchase_orders.po_number ?? ""}`
        : r.purchase_orders?.po_number ?? null,
    }));
  }
  if (target === "invoice") {
    let q = supabase
      .from("invoice_lines")
      .select("id, description, amount, invoices!inner(organization_id, invoice_number, status, customer:customer_id(name))")
      .is("income_account_id", null)
      .eq("invoices.organization_id", orgId)
      .eq("invoices.status", "draft")
      .limit(200);
    if (parentId) q = q.eq("invoice_id", parentId);
    const { data } = await q;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      description: r.description,
      amount: r.amount,
      parent_label: r.invoices?.customer?.name
        ? `${r.invoices.customer.name} · ${r.invoices.invoice_number ?? ""}`
        : r.invoices?.invoice_number ?? null,
    }));
  }
  // journal
  let q = supabase
    .from("journal_entry_lines")
    .select("id, description, debit, credit, journal_entries!inner(organization_id, reference, status)")
    .is("account_id", null)
    .eq("journal_entries.organization_id", orgId)
    .eq("journal_entries.status", "draft")
    .limit(200);
  if (parentId) q = q.eq("journal_entry_id", parentId);
  const { data } = await q;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    description: r.description,
    amount: Number(r.credit ?? 0) - Number(r.debit ?? 0),
    parent_label: r.journal_entries?.reference ?? null,
  }));
}

export function AICategorizeLinesDialog({ open, onOpenChange, target, parentId }: Props) {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const { categorize, applySuggestions, promoteRules, isCategorizing, isApplying } =
    useLineCategorization();

  const [suggestions, setSuggestions] = useState<CategorizationSuggestion[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [threshold, setThreshold] = useState(85);
  const [hasRun, setHasRun] = useState(false);
  const [learnedRules, setLearnedRules] = useState<number | null>(null);

  const { data: lines = [], isLoading: linesLoading } = useQuery({
    queryKey: ["ai-cat-lines", target, organization?.id, parentId ?? ""],
    queryFn: async () => (organization?.id ? loadLines(target, organization.id, parentId) : []),
    enabled: !!organization?.id && open,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-lite", organization?.id],
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
    const res = await categorize(organization.id, target, lines.map((l) => l.id));
    setSuggestions(res);
    const initial: Record<string, boolean> = {};
    for (const s of res) initial[s.id] = !!s.gl_account_id && s.confidence * 100 >= threshold;
    setAccepted(initial);
    setHasRun(true);
    if (res.length === 0) toast.info("No suggestions returned");
  };

  useEffect(() => {
    if (!hasRun) return;
    setAccepted((prev) => {
      const next = { ...prev };
      for (const s of suggestions) {
        next[s.id] = !!s.gl_account_id && s.confidence * 100 >= threshold;
      }
      return next;
    });
  }, [threshold, hasRun, suggestions]);

  const acceptedList = suggestions.filter((s) => accepted[s.id] && s.gl_account_id);

  const contextForFeedback = target === "invoice" || target === "journal" ? "revenue" : "ap";

  const handleApply = async () => {
    const n = await applySuggestions(target, acceptedList);
    toast.success(`Applied ${n} categorizations`);

    if (organization?.id && suggestions.length > 0) {
      const items = suggestions.map((s) => {
        const l = lineMap.get(s.id);
        const isAccepted = !!accepted[s.id] && !!s.gl_account_id;
        return {
          line_id: s.id,
          target,
          suggested_account_id: s.gl_account_id,
          final_account_id: isAccepted ? s.gl_account_id : null,
          source: s.source,
          confidence: s.confidence,
          vendor_key: l?.parent_label ?? null,
          desc_key: l?.description ?? null,
        };
      });
      void supabase.functions.invoke("ai-record-categorization-feedback", {
        body: { organization_id: organization.id, context: contextForFeedback, items },
      });
    }

    if (organization?.id && contextForFeedback === "ap") {
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
        const created = await promoteRules(organization.id, target, aiPromotions);
        setLearnedRules(created);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["bills"] });
    queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
    queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    queryClient.invalidateQueries({ queryKey: ["ai-cat-lines"] });

    setTimeout(() => onOpenChange(false), learnedRules && learnedRules > 0 ? 1200 : 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {TITLES[target]}
          </DialogTitle>
          <DialogDescription>
            {contextForFeedback === "revenue"
              ? "AI suggests a revenue / other-income account for each draft line."
              : "AI suggests an expense / COGS account and category for each uncategorized line."}
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
                <TooltipProvider>
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="text-left">
                        <th className="p-2 w-10"></th>
                        <th className="p-2">Line</th>
                        <th className="p-2 w-24 text-right">Amount</th>
                        <th className="p-2">Suggested Account</th>
                        <th className="p-2 w-32">Category</th>
                        <th className="p-2 w-28">Confidence</th>
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
                              <div className="inline-flex items-center gap-1">
                                <Badge
                                  variant={
                                    conf >= 85 ? "default" : conf >= 60 ? "secondary" : "outline"
                                  }
                                >
                                  {conf}%
                                </Badge>
                                {s.reasoning && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                      {s.reasoning}
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TooltipProvider>
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
