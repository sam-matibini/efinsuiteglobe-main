import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MapPin, Plus, Trash2, Building2, Zap } from 'lucide-react';
import { useProvincialAuthorities } from '@/hooks/useProvincialAuthorities';
import { useProvincialPayeeAccounts } from '@/hooks/useProvincialPayeeAccounts';
import { useVendors } from '@/hooks/useVendors';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';

export default function ProvincialRemittanceCentre() {
  const { authorities } = useProvincialAuthorities();
  const { payees, create, remove } = useProvincialPayeeAccounts();
  const { vendors, createVendor } = useVendors();
  const { organization } = useCurrentOrganization();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ authority_id: '', program_code: '', account_number: '', account_label: '', period_type: 'monthly' });

  const groupedByJurisdiction = authorities.reduce<Record<string, typeof authorities>>((acc, a) => {
    (acc[a.jurisdiction] ??= []).push(a);
    return acc;
  }, {});

  const selectedAuthority = authorities.find((a) => a.id === form.authority_id);

  const submit = async () => {
    if (!form.authority_id || !form.program_code || !form.account_number) return;
    await create.mutateAsync({
      authority_id: form.authority_id,
      program_code: form.program_code,
      account_number: form.account_number,
      account_label: form.account_label || undefined,
      period_type: form.period_type,
    });
    setDialogOpen(false);
    setForm({ authority_id: '', program_code: '', account_number: '', account_label: '', period_type: 'monthly' });
  };

  // Pay a utility bill (e.g. Manitoba Hydro): ensure a vendor exists for the
  // authority, then open the Create Bill flow pre-filled with that vendor.
  const payUtilityBill = async (authorityId: string, authorityName: string) => {
    if (!organization?.id) {
      toast.error('No organization selected');
      return;
    }
    const existing = vendors.find((v) => v.name.toLowerCase() === authorityName.toLowerCase());
    let vendorId = existing?.id;
    if (!vendorId) {
      try {
        const created = await createVendor.mutateAsync({ name: authorityName, vendor_type: 'organization' });
        vendorId = created?.id;
      } catch (e: any) {
        toast.error(`Could not create vendor: ${e.message ?? e}`);
        return;
      }
    }
    if (!vendorId) {
      toast.error('Could not resolve vendor');
      return;
    }
    navigate(`/purchases/bills?vendor=${encodeURIComponent(vendorId)}`);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Provincial Remittance Centre</h1>
          <p className="text-muted-foreground">Manage payee accounts at Revenu Québec, WSIB, WCB, EHT, PST/RST and other provincial authorities.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="mr-1 h-4 w-4" /> Register payee account</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(groupedByJurisdiction).map(([jur, list]) => (
          <Card key={jur}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5 text-primary" />{jur}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {list.map((a) => (
                <div key={a.id} className="flex justify-between border-b pb-1 last:border-0">
                  <span>{a.name}</span>
                  <Badge variant="outline" className="text-xs">{a.programs.length} prog</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Registered payee accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {payees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payee accounts yet. Click <strong>Register payee account</strong> to add one.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {payees.map((p) => {
                const auth = authorities.find((a) => a.id === p.authority_id);
                return (
                  <li key={p.id} className="flex justify-between items-center border-b py-2">
                    <span>
                      <span className="font-medium mr-2">{auth?.name ?? p.authority_id}</span>
                      <span className="text-muted-foreground">{p.program_code}</span>
                      <span className="font-mono text-xs ml-2">{p.account_number}</span>
                      {p.account_label && <span className="ml-2 text-muted-foreground">— {p.account_label}</span>}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Register provincial payee account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Authority</Label>
              <Select value={form.authority_id} onValueChange={(v) => setForm((f) => ({ ...f, authority_id: v, program_code: '' }))}>
                <SelectTrigger><SelectValue placeholder="Choose authority" /></SelectTrigger>
                <SelectContent>
                  {authorities.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.jurisdiction} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Program</Label>
              <Select value={form.program_code} onValueChange={(v) => setForm((f) => ({ ...f, program_code: v }))} disabled={!selectedAuthority}>
                <SelectTrigger><SelectValue placeholder="Choose program" /></SelectTrigger>
                <SelectContent>
                  {(selectedAuthority?.programs ?? []).map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account number</Label>
              <Input value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} placeholder="e.g. 1234567890" />
            </div>
            <div>
              <Label>Label (optional)</Label>
              <Input value={form.account_label} onChange={(e) => setForm((f) => ({ ...f, account_label: e.target.value }))} placeholder="Main payroll account" />
            </div>
            <div>
              <Label>Filing frequency</Label>
              <Select value={form.period_type} onValueChange={(v) => setForm((f) => ({ ...f, period_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={create.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
