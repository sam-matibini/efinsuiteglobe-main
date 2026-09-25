import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useStripeConnectedAccounts } from '@/hooks/useStripeConnectedAccounts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function StripeConnectRouting() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const { accounts } = useStripeConnectedAccounts(orgId);
  const qc = useQueryClient();

  const vendors = useQuery({
    queryKey: ['vendors-for-routing', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .eq('organization_id', orgId!)
        .order('vendor_name')
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const mappings = useQuery({
    queryKey: ['vendor-stripe-connect', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_stripe_connect' as any)
        .select('*');
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: { vendor_id: string; connected_account_id: string; default_payout_method: string }) => {
      const { error } = await supabase
        .from('vendor_stripe_connect' as any)
        .upsert(input, { onConflict: 'vendor_id' });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Routing saved'); qc.invalidateQueries({ queryKey: ['vendor-stripe-connect', orgId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const getMap = (vid: string) => mappings.data?.find((m) => m.vendor_id === vid);

  return (
    <div className="space-y-6 p-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/banking-payments/stripe-connect"><ArrowLeft className="h-4 w-4 mr-1" /> Stripe Connect</Link>
        </Button>
        <h1 className="text-2xl font-bold">Payout Routing</h1>
        <p className="text-sm text-muted-foreground">Assign vendors to Stripe connected accounts so bills can be paid via Stripe transfers.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Vendor → Connected Account</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Connected account</TableHead>
                <TableHead>Method</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(vendors.data ?? []).map((v: any) => {
                const m = getMap(v.id);
                return <VendorRow key={v.id} vendor={v} mapping={m} accounts={accounts} onSave={(p) => upsert.mutate({ vendor_id: v.id, ...p })} />;
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function VendorRow({ vendor, mapping, accounts, onSave }: any) {
  const [acct, setAcct] = useState<string>(mapping?.connected_account_id ?? '');
  const [method, setMethod] = useState<string>(mapping?.default_payout_method ?? 'bank');
  return (
    <TableRow>
      <TableCell className="font-medium">{vendor.vendor_name}</TableCell>
      <TableCell>
        <Select value={acct} onValueChange={setAcct}>
          <SelectTrigger className="w-72"><SelectValue placeholder="— none —" /></SelectTrigger>
          <SelectContent>
            {accounts.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>{a.stripe_account_id} ({a.country})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select value={method} onValueChange={setMethod}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bank">Bank</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="wallet">Wallet</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button size="sm" variant="outline" disabled={!acct} onClick={() => onSave({ connected_account_id: acct, default_payout_method: method })}>
          <Save className="h-4 w-4 mr-1" /> Save
        </Button>
      </TableCell>
    </TableRow>
  );
}
