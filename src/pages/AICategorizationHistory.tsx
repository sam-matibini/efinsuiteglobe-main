// Phase 7 — AI categorization application history + undo page.
import { Fragment, useMemo, useState } from "react";
import { Sparkles, Undo2, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useAICategorizationHistory } from "@/hooks/useAICategorizationHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CONTEXT_LABEL: Record<string, string> = { bank: "Bank", ap: "AP", revenue: "Revenue" };
const TARGET_LABEL: Record<string, string> = {
  bank_transaction: "Bank txn",
  bill: "Bill line",
  expense: "Expense line",
  po: "PO line",
  invoice: "Invoice line",
  journal: "Journal line",
};

export default function AICategorizationHistory() {
  const { currentOrganization } = useOrganizationContext();
  const { data = [], isLoading, undo } = useAICategorizationHistory(currentOrganization?.id);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [contextFilter, setContextFilter] = useState<string>("all");
  const [showUndone, setShowUndone] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (!showUndone && r.undone_at) return false;
      if (contextFilter !== "all" && r.context !== contextFilter) return false;
      return true;
    });
  }, [data, contextFilter, showUndone]);

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);

  const handleUndo = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const res = await undo.mutateAsync(ids);
      toast.success(`Undid ${res.undone} categorization${res.undone === 1 ? "" : "s"}`);
      if (res.errors?.length) toast.error(`${res.errors.length} could not be undone`);
      setSelected({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Undo failed");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> AI Categorization History
        </h1>
        <p className="text-sm text-muted-foreground">
          Every categorization that AI auto-applied in the last 30 days. Undo restores the row's prior account.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm">Applied changes</CardTitle>
          <div className="flex items-center gap-3">
            <Select value={contextFilter} onValueChange={setContextFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All contexts</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="ap">AP (bills / expenses)</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={showUndone}
                onCheckedChange={(v) => setShowUndone(!!v)}
              />
              Show undone
            </label>
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.length === 0 || undo.isPending}
              onClick={() => handleUndo(selectedIds)}
            >
              {undo.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Undo2 className="h-4 w-4 mr-2" />
              )}
              Undo selected ({selectedIds.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No auto-applied categorizations {showUndone ? "" : "in the last 30 days"}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const undoneRow = !!r.undone_at;
                  const isOpen = !!expanded[r.id];
                  const priorAcct = r.prior_value
                    ? Object.values(r.prior_value)[0]
                    : null;
                  const newAcct = r.new_value ? Object.values(r.new_value)[0] : null;
                  return (
                    <>
                      <TableRow key={r.id} className={undoneRow ? "opacity-50" : ""}>
                        <TableCell>
                          <Checkbox
                            disabled={undoneRow}
                            checked={!!selected[r.id]}
                            onCheckedChange={(v) =>
                              setSelected((prev) => ({ ...prev, [r.id]: !!v }))
                            }
                          />
                        </TableCell>
                        <TableCell className="text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              setExpanded((prev) => ({ ...prev, [r.id]: !prev[r.id] }))
                            }
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            {new Date(r.applied_at).toLocaleString()}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{CONTEXT_LABEL[r.context] ?? r.context}</Badge>
                        </TableCell>
                        <TableCell>{TARGET_LABEL[r.target] ?? r.target}</TableCell>
                        <TableCell className="text-xs">{r.source ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          {r.confidence !== null ? `${Math.round(Number(r.confidence) * 100)}%` : "—"}
                        </TableCell>
                        <TableCell>
                          {undoneRow ? (
                            <Badge variant="secondary">Undone</Badge>
                          ) : (
                            <Badge>Applied</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!undoneRow && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={undo.isPending}
                              onClick={() => handleUndo([r.id])}
                            >
                              <Undo2 className="h-3 w-3 mr-1" /> Undo
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow key={`${r.id}-detail`} className="bg-muted/30">
                          <TableCell></TableCell>
                          <TableCell colSpan={7} className="text-xs space-y-1 py-3">
                            <div>
                              <span className="text-muted-foreground">Row id:</span>{" "}
                              <span className="font-mono">{r.row_id}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Prior → New:</span>{" "}
                              <span className="font-mono">
                                {String(priorAcct ?? "∅")} → {String(newAcct ?? "∅")}
                              </span>
                            </div>
                            {r.reasoning ? (
                              <div>
                                <span className="text-muted-foreground">Why:</span> {r.reasoning}
                              </div>
                            ) : (
                              <div className="text-muted-foreground italic">
                                No reasoning recorded for this change.
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
