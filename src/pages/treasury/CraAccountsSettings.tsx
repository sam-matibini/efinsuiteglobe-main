import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { useCraAccounts, CraTaxType, CraProgramCode, PROGRAM_FOR_TAX, validateCraAccount, formatFullAccountNumber } from '@/hooks/useCraAccounts';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

const TAX_LABEL: Record<CraTaxType, string> = {
  gst_hst: 'GST/HST (RT)',
  payroll: 'Payroll Source Deductions (RP)',
  corporate_tax: 'Corporate Income Tax (RC)',
};

export default function CraAccountsSettings() {
  const { accounts, isLoading, create, remove } = useCraAccounts();
  const isReadOnly = useIsReadOnly();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    account_name: '',
    business_number: '',
    program_code: 'RT' as CraProgramCode,
    reference_number: '0001',
    tax_type: 'gst_hst' as CraTaxType,
    is_default: false,
  });

  const fullAccount = form.business_number.length === 9 && form.reference_number.length === 4
    ? formatFullAccountNumber(form.business_number, form.program_code, form.reference_number)
    : '';
  const validationError = form.business_number || form.reference_number
    ? validateCraAccount(form.business_number, form.program_code, form.reference_number)
    : null;

  const handleTaxType = (v: CraTaxType) => setForm({ ...form, tax_type: v, program_code: PROGRAM_FOR_TAX[v] });

  const submit = async () => {
    await create.mutateAsync(form);
    setOpen(false);
    setForm({ ...form, account_name: '', business_number: '', reference_number: '0001' });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CRA Program Accounts</h1>
          <p className="text-muted-foreground">
            Register CRA business number program accounts (e.g. <span className="font-mono">123456789RT0001</span>) used for GST/HST, payroll source deductions and corporate tax payments.
          </p>
        </div>
        {!isReadOnly && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add CRA Account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New CRA Program Account</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Account name</Label>
                  <Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} placeholder="e.g. Main GST/HST" />
                </div>
                <div>
                  <Label>Program type</Label>
                  <Select value={form.tax_type} onValueChange={(v) => handleTaxType(v as CraTaxType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TAX_LABEL) as CraTaxType[]).map((k) => (
                        <SelectItem key={k} value={k}>{TAX_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[1fr_70px_90px] gap-2">
                  <div>
                    <Label>Business number (9 digits)</Label>
                    <Input maxLength={9} value={form.business_number} onChange={(e) => setForm({ ...form, business_number: e.target.value.replace(/\D/g, '') })} placeholder="123456789" />
                  </div>
                  <div>
                    <Label>Program</Label>
                    <Input value={form.program_code} disabled />
                  </div>
                  <div>
                    <Label>Reference</Label>
                    <Input maxLength={4} value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value.replace(/\D/g, '') })} />
                  </div>
                </div>
                {fullAccount && !validationError && (
                  <div className="rounded-md bg-muted p-3 font-mono text-sm">{fullAccount}</div>
                )}
                {validationError && <p className="text-xs text-destructive">{validationError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={!!validationError || !form.account_name || create.isPending}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Registered accounts</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading…</p> : accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No CRA accounts yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Full account #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.account_name}{a.is_default && <Badge className="ml-2" variant="secondary">default</Badge>}</TableCell>
                    <TableCell className="font-mono text-xs">{a.full_account_number}</TableCell>
                    <TableCell>{TAX_LABEL[a.tax_type]}</TableCell>
                    <TableCell><Badge variant={a.status === 'active' ? 'default' : 'outline'}>{a.status}</Badge></TableCell>
                    <TableCell>
                      {!isReadOnly && (
                        <Button size="sm" variant="ghost" onClick={() => remove.mutate(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
