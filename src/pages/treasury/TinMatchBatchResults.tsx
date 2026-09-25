import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTinMatchBatches, useTinMatchResults, useSubmitTinBatch } from "@/hooks/useTinMatchBatch";

export default function TinMatchBatchResults() {
  const { data: batches = [], isLoading } = useTinMatchBatches();
  const submit = useSubmitTinBatch();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: results = [] } = useTinMatchResults(selected);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">IRS TIN-Match Batches</h1>
          <p className="text-muted-foreground">Live IRS e-Services TIN-Match batch submission and per-vendor results.</p>
        </div>
        <Button onClick={() => submit.mutate(undefined)} disabled={submit.isPending}>Submit Batch from US Vendors</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Batches</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Loading…</p> :
            batches.length === 0 ? <p className="text-muted-foreground">No batches submitted yet.</p> :
            <Table>
              <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Status</TableHead><TableHead>Vendors</TableHead><TableHead>Matched</TableHead><TableHead>Mismatched</TableHead><TableHead>Submitted</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id} className={selected === b.id ? "bg-muted/50" : ""}>
                    <TableCell className="font-mono text-xs">{b.batch_reference}</TableCell>
                    <TableCell><Badge variant={b.status === "completed" ? "default" : "secondary"}>{b.status}</Badge></TableCell>
                    <TableCell>{b.vendor_count}</TableCell>
                    <TableCell className="text-emerald-600">{b.matched_count}</TableCell>
                    <TableCell className="text-destructive">{b.mismatched_count}</TableCell>
                    <TableCell>{b.submitted_at ? new Date(b.submitted_at).toLocaleString() : "—"}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => setSelected(b.id)}>View</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader><CardTitle>Results</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>TIN</TableHead><TableHead>Status</TableHead><TableHead>Code</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">••••{r.tin_last4 ?? "—"}</TableCell>
                    <TableCell><Badge variant={r.match_status === "matched" ? "default" : "destructive"}>{r.match_status}</Badge></TableCell>
                    <TableCell>{r.match_code ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
