/**
 * Nigerian Tax Engine — admin dashboard.
 *
 * Read-only overview of the configurable tax definitions, their currently
 * effective rate versions, WHT service classifications, and the tax
 * transaction ledger drilldown. All rates shown here come from the database;
 * nothing on this page is hard-coded.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

const categoryColors: Record<string, string> = {
  sales: 'bg-emerald-100 text-emerald-800',
  payroll: 'bg-sky-100 text-sky-800',
  withholding: 'bg-amber-100 text-amber-800',
  corporate: 'bg-purple-100 text-purple-800',
  levy: 'bg-slate-100 text-slate-800',
};

export default function NigeriaTaxEngine() {
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id ?? null;
  const today = new Date().toISOString().slice(0, 10);

  const { data: defs, isLoading: defsLoading } = useQuery({
    queryKey: ['ng-tax-defs', orgId],
    queryFn: async () => {
      const q = supabase.from('ng_tax_definitions').select('*').eq('is_active', true).order('code');
      const { data } = orgId
        ? await q.or(`organization_id.eq.${orgId},organization_id.is.null`)
        : await q.is('organization_id', null);
      return data ?? [];
    },
  });

  const { data: versions } = useQuery({
    queryKey: ['ng-tax-versions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ng_tax_rate_versions')
        .select('*')
        .eq('is_active', true)
        .lte('effective_from', today)
        .order('effective_from', { ascending: false });
      return data ?? [];
    },
  });

  const { data: services } = useQuery({
    queryKey: ['ng-tax-services'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ng_tax_service_classifications')
        .select('*')
        .eq('is_active', true)
        .order('code');
      return data ?? [];
    },
  });

  const { data: ledger } = useQuery({
    queryKey: ['ng-tax-ledger', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ng_tax_transaction_ledger')
        .select('*')
        .eq('organization_id', orgId!)
        .order('transaction_date', { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const activeByDef = new Map<string, any>();
  (versions ?? []).forEach((v: any) => {
    if (!activeByDef.has(v.definition_id)) activeByDef.set(v.definition_id, v);
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nigerian Tax Engine</h1>
        <p className="text-muted-foreground mt-1">
          Configurable, effective-dated tax framework. Every tax amount is traceable
          from the return back to the source transaction, journal entry, and
          remittance record.
        </p>
      </div>

      <Tabs defaultValue="definitions">
        <TabsList>
          <TabsTrigger value="definitions">Tax Definitions</TabsTrigger>
          <TabsTrigger value="wht">WHT Services</TabsTrigger>
          <TabsTrigger value="ledger">Transaction Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="definitions">
          <Card>
            <CardHeader>
              <CardTitle>Active Tax Definitions</CardTitle>
            </CardHeader>
            <CardContent>
              {defsLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Current rate</TableHead>
                      <TableHead>Filing</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(defs ?? []).map((d: any) => {
                      const v = activeByDef.get(d.id);
                      const rate =
                        v?.calculation_method === 'progressive'
                          ? 'Progressive brackets'
                          : v?.calculation_method === 'tiered_turnover'
                            ? 'Tiered by turnover'
                            : v?.rate != null
                              ? `${v.rate}%`
                              : '—';
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-mono">{d.code}</TableCell>
                          <TableCell>{d.name}</TableCell>
                          <TableCell>
                            <Badge className={categoryColors[d.tax_category]}>
                              {d.tax_category}
                            </Badge>
                          </TableCell>
                          <TableCell>{d.jurisdiction_level}</TableCell>
                          <TableCell>{v?.calculation_method ?? '—'}</TableCell>
                          <TableCell className="font-medium">{rate}</TableCell>
                          <TableCell>{d.filing_frequency}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {v?.source_reference ?? '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wht">
          <Card>
            <CardHeader>
              <CardTitle>Withholding Tax Service Classifications</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Resident</TableHead>
                    <TableHead className="text-right">Non-resident</TableHead>
                    <TableHead className="text-right">Min threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(services ?? []).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.code}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell className="text-right">{s.resident_rate}%</TableCell>
                      <TableCell className="text-right">
                        {s.non_resident_rate != null ? `${s.non_resident_rate}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {s.min_threshold != null
                          ? `₦${Number(s.min_threshold).toLocaleString()}`
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <CardTitle>Recent Tax Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {!orgId ? (
                <p className="text-muted-foreground">Select an organization to view its ledger.</p>
              ) : (ledger?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground">
                  No Nigerian tax transactions recorded yet. Amounts will appear here as
                  invoices, bills, and payroll runs are posted.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Definition</TableHead>
                      <TableHead className="text-right">Base</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>JE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ledger ?? []).map((l: any) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.transaction_date}</TableCell>
                        <TableCell className="text-xs">{l.source_type}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {(defs ?? []).find((d: any) => d.id === l.definition_id)?.code ?? l.definition_id}
                        </TableCell>
                        <TableCell className="text-right">
                          ₦{Number(l.taxable_base).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {l.tax_rate != null ? `${l.tax_rate}%` : '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₦{Number(l.tax_amount).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{l.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {l.journal_entry_id ? (
                            <Link
                              to={`/journal-entries?id=${l.journal_entry_id}`}
                              className="text-primary underline text-xs"
                            >
                              View JE
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-xs">unlinked</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
