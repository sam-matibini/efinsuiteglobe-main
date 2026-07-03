import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserCog, Plus, Ban } from 'lucide-react';
import { useAccountantDelegations } from '@/hooks/useAccountantDelegations';

export default function DelegatedAccess() {
  const { delegations, isLoading, grantDelegation, revoke } = useAccountantDelegations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    delegated_user_id: '',
    expires_at: '',
    notes: '',
    treasury: true,
    payroll_remit: true,
    approve: false,
  });

  const reset = () =>
    setForm({
      delegated_user_id: '',
      expires_at: '',
      notes: '',
      treasury: true,
      payroll_remit: true,
      approve: false,
    });

  const submit = async () => {
    if (!form.delegated_user_id) return;
    await grantDelegation.mutateAsync({
      delegated_user_id: form.delegated_user_id,
      expires_at: form.expires_at || null,
      notes: form.notes,
      scope: {
        treasury: form.treasury,
        payroll_remit: form.payroll_remit,
        approve: form.approve,
      },
    });
    setOpen(false);
    reset();
  };

  const isActive = (d: (typeof delegations)[number]) =>
    !d.revoked_at && (!d.expires_at || new Date(d.expires_at) > new Date());

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCog className="h-7 w-7 text-primary" />
            Delegated Accountant Access
          </h1>
          <p className="text-muted-foreground">
            Grant external accountants scoped, time-bound access to treasury and payroll remittance workflows.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Grant access
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delegations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : delegations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No delegations granted yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Granted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delegations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.delegated_user_id}</TableCell>
                    <TableCell className="text-xs">
                      {Object.entries(d.scope)
                        .filter(([, v]) => v)
                        .map(([k]) => k)
                        .join(', ') || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {d.expires_at ? d.expires_at.slice(0, 10) : 'never'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isActive(d) ? 'default' : 'outline'}>
                        {d.revoked_at ? 'Revoked' : isActive(d) ? 'Active' : 'Expired'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.created_at.slice(0, 10)}</TableCell>
                    <TableCell className="text-right">
                      {isActive(d) && (
                        <Button size="sm" variant="ghost" onClick={() => revoke.mutate({ id: d.id })}>
                          <Ban className="h-3 w-3 mr-1" /> Revoke
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant delegated access</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>User ID</Label>
              <Input
                placeholder="auth user UUID"
                value={form.delegated_user_id}
                onChange={(e) => setForm({ ...form, delegated_user_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The accountant must already have a user account. Paste their auth user ID.
              </p>
            </div>
            <div>
              <Label>Expires (optional)</Label>
              <Input
                type="date"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Scope</Label>
              <div className="flex items-center gap-2">
                <Switch checked={form.treasury} onCheckedChange={(v) => setForm({ ...form, treasury: v })} />
                <span className="text-sm">Treasury access</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.payroll_remit}
                  onCheckedChange={(v) => setForm({ ...form, payroll_remit: v })}
                />
                <span className="text-sm">Payroll remittance</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.approve} onCheckedChange={(v) => setForm({ ...form, approve: v })} />
                <span className="text-sm">Approve remittances</span>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={grantDelegation.isPending}>
              Grant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
