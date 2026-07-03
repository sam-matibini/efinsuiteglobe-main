import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConsolidationGroups } from "@/hooks/useConsolidation";
import { useConsolidationRuns, useRunConsolidation } from "@/hooks/useConsolidationEngine";

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));

export default function ConsolidationDashboard() {
  const { data: groups = [] } = useConsolidationGroups();
  const [groupId, setGroupId] = useState<string>("");
  const [periodStart, setPeriodStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const { data: runs = [], isLoading } = useConsolidationRuns(groupId || null);
  const run = useRunConsolidation();

  const submit = () => {
    if (!groupId) return;
    run.mutate({ group_id: groupId, period_start: periodStart, period_end: periodEnd });
  };

  const latest = runs[0];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consolidation Engine</h1>
        <p className="text-muted-foreground">Run multi-entity consolidations with FX translation and ownership weighting.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Run Consolidation</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Group</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Period Start</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
            <div><Label>Period End</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
            <div className="flex items-end"><Button onClick={submit} disabled={!groupId || run.isPending} className="w-full">Run</Button></div>
          </div>
        </CardContent>
      </Card>

      {latest && (
        <Card>
          <CardHeader><CardTitle>Latest Run — {latest.period_start} to {latest.period_end}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Stat label="Assets" value={fmt(latest.total_assets)} />
            <Stat label="Liabilities" value={fmt(latest.total_liabilities)} />
            <Stat label="Equity" value={fmt(latest.total_equity)} />
            <Stat label="Revenue" value={fmt(latest.total_revenue)} />
            <Stat label="Expenses" value={fmt(latest.total_expenses)} />
            <Stat label="Net Income" value={fmt(latest.net_income)} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>History</CardTitle></CardHeader>
        <CardContent>
          {!groupId ? <p className="text-muted-foreground">Select a group to view runs.</p> :
            isLoading ? <p className="text-muted-foreground">Loading…</p> :
            runs.length === 0 ? <p className="text-muted-foreground">No runs yet.</p> :
            <Table>
              <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Status</TableHead><TableHead>Assets</TableHead><TableHead>Liabilities</TableHead><TableHead>Equity</TableHead><TableHead>Net Income</TableHead><TableHead>Completed</TableHead></TableRow></TableHeader>
              <TableBody>
                {runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.period_start} → {r.period_end}</TableCell>
                    <TableCell><Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell>{fmt(r.total_assets)}</TableCell>
                    <TableCell>{fmt(r.total_liabilities)}</TableCell>
                    <TableCell>{fmt(r.total_equity)}</TableCell>
                    <TableCell>{fmt(r.net_income)}</TableCell>
                    <TableCell>{r.completed_at ? new Date(r.completed_at).toLocaleString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
