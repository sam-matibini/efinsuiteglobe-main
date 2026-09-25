import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function StripeConnectCompliance() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear() - 1);

  const accounts = useQuery({
    queryKey: ['stripe-accounts-compliance', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_connected_accounts' as any)
        .select('id, stripe_account_id, country, charges_enabled, payouts_enabled, disabled_reason, requirements')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filings = useQuery({
    queryKey: ['1099k', orgId, taxYear],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_1099k_filings' as any)
        .select('*, stripe_connected_accounts:connected_account_id(stripe_account_id, country)')
        .eq('org_id', orgId!)
        .eq('tax_year', taxYear);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const runKyc = async () => {
    const { error } = await supabase.functions.invoke('stripe-kyc-monitor', { body: {} });
    if (error) toast.error(error.message); else { toast.success('KYC snapshot taken'); accounts.refetch(); }
  };

  const generate1099 = async () => {
    const { error } = await supabase.functions.invoke('stripe-1099k-generate', {
      body: { organization_id: orgId, tax_year: taxYear },
    });
    if (error) toast.error(error.message); else { toast.success('1099-K drafts generated'); filings.refetch(); }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/banking-payments/stripe-connect"><ArrowLeft className="h-4 w-4 mr-1" /> Stripe Connect</Link>
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Compliance</h1>
        <p className="text-sm text-muted-foreground">KYC monitoring, 1099-K filings, and platform attestation exports.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">KYC status across connected accounts</CardTitle>
          <Button size="sm" variant="outline" onClick={runKyc}>Run KYC snapshot</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Charges</TableHead>
                <TableHead>Payouts</TableHead>
                <TableHead>Past due</TableHead>
                <TableHead>Disabled reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(accounts.data ?? []).map((a) => {
                const past = ((a.requirements as any)?.past_due ?? []) as string[];
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.stripe_account_id}</TableCell>
                    <TableCell>{a.country}</TableCell>
                    <TableCell><Badge variant={a.charges_enabled ? 'default' : 'secondary'}>{a.charges_enabled ? 'On' : 'Off'}</Badge></TableCell>
                    <TableCell><Badge variant={a.payouts_enabled ? 'default' : 'secondary'}>{a.payouts_enabled ? 'On' : 'Off'}</Badge></TableCell>
                    <TableCell>{past.length ? <Badge variant="destructive">{past.length}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs text-amber-700">{a.disabled_reason ?? '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> 1099-K Filings</CardTitle>
          <div className="flex gap-2">
            <Input type="number" value={taxYear} onChange={(e) => setTaxYear(Number(e.target.value))} className="w-24" />
            <Button size="sm" onClick={generate1099}>Generate drafts</Button>
          </div>
        </CardHeader>
        <CardContent>
          {(filings.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No filings for {taxYear}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(filings.data ?? []).map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.stripe_connected_accounts?.stripe_account_id}</TableCell>
                    <TableCell className="text-right">${Number(f.gross_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{f.transaction_count}</TableCell>
                    <TableCell><Badge variant={f.filing_status === 'ready' ? 'default' : 'secondary'}>{f.filing_status}</Badge></TableCell>
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
