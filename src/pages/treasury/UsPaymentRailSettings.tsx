import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useUsPaymentRails, useCreateUsRail, useInvokeUsAchEftps } from "@/hooks/useUsPaymentRails";

export default function UsPaymentRailSettings() {
  const { data: rails = [], isLoading } = useUsPaymentRails();
  const create = useCreateUsRail();
  const invoke = useInvokeUsAchEftps();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    rail_type: "ach" as "ach" | "eftps" | "wire",
    nickname: "",
    bank_name: "",
    routing_number: "",
    account_number_last4: "",
    eftps_taxpayer_id: "",
  });

  const submit = async () => {
    await create.mutateAsync(form);
    setOpen(false);
    setForm({ rail_type: "ach", nickname: "", bank_name: "", routing_number: "", account_number_last4: "", eftps_taxpayer_id: "" });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">US Payment Rails</h1>
          <p className="text-muted-foreground">Configure ACH (NACHA) and EFTPS payment rails for US tax remittance.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>Add Rail</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New US Payment Rail</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Type</Label>
                <Select value={form.rail_type} onValueChange={(v) => setForm({ ...form, rail_type: v as typeof form.rail_type })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ach">ACH (NACHA)</SelectItem>
                    <SelectItem value="eftps">EFTPS</SelectItem>
                    <SelectItem value="wire">Wire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nickname</Label><Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></div>
              <div><Label>Bank Name</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
              <div><Label>Routing Number</Label><Input value={form.routing_number} onChange={(e) => setForm({ ...form, routing_number: e.target.value })} /></div>
              <div><Label>Account Last 4</Label><Input value={form.account_number_last4} onChange={(e) => setForm({ ...form, account_number_last4: e.target.value })} /></div>
              {form.rail_type === "eftps" && (
                <div><Label>EFTPS Taxpayer ID (EIN)</Label><Input value={form.eftps_taxpayer_id} onChange={(e) => setForm({ ...form, eftps_taxpayer_id: e.target.value })} /></div>
              )}
              <Button onClick={submit} disabled={create.isPending || !form.nickname}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Rails</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Loading…</p> :
            rails.length === 0 ? <p className="text-muted-foreground">No rails configured.</p> :
            <Table>
              <TableHeader><TableRow><TableHead>Nickname</TableHead><TableHead>Type</TableHead><TableHead>Bank</TableHead><TableHead>Account</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {rails.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nickname}</TableCell>
                    <TableCell><Badge variant="outline">{r.rail_type.toUpperCase()}</Badge></TableCell>
                    <TableCell>{r.bank_name ?? "—"}</TableCell>
                    <TableCell>{r.account_number_last4 ? `••••${r.account_number_last4}` : "—"}</TableCell>
                    <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell>
                      {r.rail_type === "ach" && (
                        <Button size="sm" variant="outline" onClick={() => invoke.mutate({ action: "generate_ach", organization_id: r.organization_id, rail_id: r.id, entries: [] })}>
                          Test NACHA
                        </Button>
                      )}
                    </TableCell>
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
