import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { useDepartments } from '@/hooks/useDimensions';
import { Badge } from '@/components/ui/badge';

export default function Divisions() {
  const { data: divisions = [], createDepartment, updateDepartment, deleteDepartment } = useDepartments();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', description: '',
    division_type: 'operating', is_shared: false, allow_postings: true, is_active: true,
  });

  const submit = async () => {
    await createDepartment.mutateAsync(form as any);
    setOpen(false);
    setForm({ code: '', name: '', description: '', division_type: 'operating', is_shared: false, allow_postings: true, is_active: true });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Building2 className="w-7 h-7" /> Divisions</h1>
          <p className="text-muted-foreground">
            Tag every transaction with a Division to produce P&amp;L, Balance Sheet, and Cash Flow by business unit — on a single Chart of Accounts and shared bank accounts.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Add Division</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Division</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="RET" /></div>
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Real Estate" /></div>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div>
                <Label>Type</Label>
                <Select value={form.division_type} onValueChange={(v) => setForm({ ...form, division_type: v, is_shared: v === 'shared' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operating">Operating</SelectItem>
                    <SelectItem value="shared">Shared Costs</SelectItem>
                    <SelectItem value="administration">Administration</SelectItem>
                    <SelectItem value="eliminating">Eliminating</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3"><Switch checked={form.allow_postings} onCheckedChange={(v) => setForm({ ...form, allow_postings: v })} /><Label>Allow direct postings</Label></div>
            </div>
            <DialogFooter><Button onClick={submit} disabled={!form.code || !form.name}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Division Master</CardTitle><CardDescription>One legal entity · One CoA · One GL · Many divisions</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Postings</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {divisions.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono">{d.code}</TableCell>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>
                    <Badge variant={d.is_shared ? 'secondary' : 'outline'}>{d.division_type || 'operating'}</Badge>
                  </TableCell>
                  <TableCell><Switch checked={d.allow_postings ?? true} onCheckedChange={(v) => updateDepartment.mutate({ id: d.id, allow_postings: v } as any)} /></TableCell>
                  <TableCell><Switch checked={d.is_active} onCheckedChange={(v) => updateDepartment.mutate({ id: d.id, is_active: v } as any)} /></TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => deleteDepartment.mutate(d.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
                </TableRow>
              ))}
              {divisions.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No divisions yet — defaults (ADM, SHD) are created automatically.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
