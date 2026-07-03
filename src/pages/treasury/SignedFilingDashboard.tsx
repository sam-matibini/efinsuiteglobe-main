import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSignedFilings, useSignedFilingAction } from "@/hooks/useSignedFilings";

export default function SignedFilingDashboard() {
  const { data: rows = [], isLoading } = useSignedFilings();
  const action = useSignedFilingAction();
  const [open, setOpen] = useState(false);
  const [signId, setSignId] = useState<string | null>(null);
  const [signData, setSignData] = useState("");
  const [form, setForm] = useState({
    filing_type: "T4",
    filing_reference: "",
    period_end: new Date().toISOString().slice(0, 10),
    signer_name: "",
    signer_email: "",
    signer_title: "",
  });

  const initiate = async () => {
    await action.mutateAsync({ action: "initiate", ...form });
    setOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Signed Filing Workflow</h1>
          <p className="text-muted-foreground">Initiate, sign, and file regulatory documents with audit-grade signature capture.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>New Filing Request</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Initiate Signed Filing</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Filing Type</Label><Input value={form.filing_type} onChange={(e) => setForm({ ...form, filing_type: e.target.value })} /></div>
              <div><Label>Filing Reference</Label><Input value={form.filing_reference} onChange={(e) => setForm({ ...form, filing_reference: e.target.value })} /></div>
              <div><Label>Period End</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
              <div><Label>Signer Name</Label><Input value={form.signer_name} onChange={(e) => setForm({ ...form, signer_name: e.target.value })} /></div>
              <div><Label>Signer Email</Label><Input type="email" value={form.signer_email} onChange={(e) => setForm({ ...form, signer_email: e.target.value })} /></div>
              <div><Label>Signer Title</Label><Input value={form.signer_title} onChange={(e) => setForm({ ...form, signer_title: e.target.value })} /></div>
              <Button onClick={initiate} disabled={action.isPending || !form.signer_name || !form.signer_email}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Filings</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Loading…</p> :
            rows.length === 0 ? <p className="text-muted-foreground">No filings yet.</p> :
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Reference</TableHead><TableHead>Period</TableHead><TableHead>Signer</TableHead><TableHead>Status</TableHead><TableHead>Filed Ref</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.filing_type}</TableCell>
                    <TableCell>{r.filing_reference ?? "—"}</TableCell>
                    <TableCell>{r.period_end ?? "—"}</TableCell>
                    <TableCell>{r.signer_name}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "filed" ? "default" : r.status === "signed" ? "secondary" : "outline"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.filed_reference ?? "—"}</TableCell>
                    <TableCell className="space-x-2">
                      {r.status === "pending" && <Button size="sm" variant="outline" onClick={() => setSignId(r.id)}>Sign</Button>}
                      {r.status === "signed" && <Button size="sm" onClick={() => action.mutate({ action: "file", request_id: r.id })}>File</Button>}
                      {r.status === "pending" && <Button size="sm" variant="ghost" onClick={() => action.mutate({ action: "cancel", request_id: r.id })}>Cancel</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        </CardContent>
      </Card>

      <Dialog open={!!signId} onOpenChange={(o) => { if (!o) setSignId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Capture Signature</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Paste a signature data URI or typed full name. IP and user-agent are recorded with the signature for audit.</p>
            <Textarea rows={4} value={signData} onChange={(e) => setSignData(e.target.value)} placeholder="data:image/png;base64,…  or  Typed Name" />
            <Button
              disabled={!signData || action.isPending}
              onClick={async () => {
                if (!signId) return;
                await action.mutateAsync({ action: "sign", request_id: signId, signature_data: signData });
                setSignId(null);
                setSignData("");
              }}
            >Submit Signature</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
