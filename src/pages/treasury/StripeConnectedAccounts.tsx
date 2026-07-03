import { useState } from 'react';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useStripeConnectedAccounts } from '@/hooks/useStripeConnectedAccounts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConnectedAccountStatusBadge } from '@/components/treasury/ConnectedAccountStatusBadge';
import { Link2, Plus, RefreshCw, ExternalLink, ChevronRight } from 'lucide-react';
import { ProcessorLogo } from '@/components/settlements/ProcessorLogo';
import { Link } from 'react-router-dom';

export default function StripeConnectedAccounts() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const { accounts, isLoading, onboard, sync } = useStripeConnectedAccounts(orgId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    account_type: 'express' as 'express' | 'standard',
    country: 'US',
    email: '',
    business_type: 'company' as 'individual' | 'company' | 'non_profit' | 'government_entity',
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ProcessorLogo processor="stripe" className="h-8 w-8" /> Stripe Connected Accounts
          </h1>
          <p className="text-muted-foreground">Onboard connected accounts to receive invoice payments, pay bills, run payroll and route payment links through Stripe Connect.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Onboard new account
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> Connected accounts</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : accounts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>No connected accounts yet.</p>
              <p className="text-xs mt-1">Click "Onboard new account" to begin Stripe Connect onboarding.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stripe ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Capabilities</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.stripe_account_id}</TableCell>
                    <TableCell className="capitalize">{a.account_type}</TableCell>
                    <TableCell>{a.country ?? '—'}</TableCell>
                    <TableCell className="uppercase">{a.default_currency ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {Object.entries(a.capabilities ?? {}).map(([k, v]) => (
                        <span key={k} className={`mr-2 inline-block px-1.5 py-0.5 rounded ${v === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{k}:{v as string}</span>
                      ))}
                    </TableCell>
                    <TableCell><ConnectedAccountStatusBadge account={a} /></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => sync.mutate(a.id)} disabled={sync.isPending}>
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync
                      </Button>
                      {(!a.details_submitted || a.disabled_reason) && (
                        <Button size="sm" variant="default" onClick={() => orgId && onboard.mutate({ organization_id: orgId, connected_account_id: a.id })}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Resume
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/banking-payments/stripe-connect/${a.id}`}>Open <ChevronRight className="h-3.5 w-3.5 ml-1" /></Link>
                      </Button>
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
          <DialogHeader><DialogTitle>Onboard new connected account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Account type</Label>
              <Select value={form.account_type} onValueChange={(v) => setForm((s) => ({ ...s, account_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="express">Express (recommended, Stripe-hosted)</SelectItem>
                  <SelectItem value="standard">Standard (full Stripe dashboard)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Business type</Label>
              <Select value={form.business_type} onValueChange={(v) => setForm((s) => ({ ...s, business_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="individual">Individual / Sole prop</SelectItem>
                  <SelectItem value="non_profit">Non-profit</SelectItem>
                  <SelectItem value="government_entity">Government entity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Country (ISO)</Label>
                <Input value={form.country} onChange={(e) => setForm((s) => ({ ...s, country: e.target.value.toUpperCase() }))} maxLength={2} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!orgId || onboard.isPending}
              onClick={() => orgId && onboard.mutate({ organization_id: orgId, ...form })}
            >
              {onboard.isPending ? 'Creating…' : 'Begin onboarding'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
