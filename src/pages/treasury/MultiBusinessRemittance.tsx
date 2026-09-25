import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2 } from 'lucide-react';
import { useMultiBusinessRemittance } from '@/hooks/useMultiBusinessRemittance';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export default function MultiBusinessRemittance() {
  const { summaries, isLoading } = useMultiBusinessRemittance();
  const fmt = useCurrencyFormatter();

  const totals = summaries.reduce(
    (acc, s) => ({
      pending: acc.pending + s.pending_amount,
      processing: acc.processing + s.processing_amount,
      orgs: acc.orgs + 1,
    }),
    { pending: 0, processing: 0, orgs: 0 },
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" />
          Multi-Business Remittance
        </h1>
        <p className="text-muted-foreground">
          Orchestrate CRA remittances across every organization you have access to.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totals.orgs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pending CRA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {fmt.formatCurrency(totals.pending, { showCurrencySymbol: true, currencyOverride: 'CAD' })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">In-flight</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {fmt.formatCurrency(totals.processing, { showCurrencySymbol: true, currencyOverride: 'CAD' })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : summaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No organizations to display.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>PAD</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Processing</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Last paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((s) => (
                  <TableRow key={s.organization_id}>
                    <TableCell className="font-medium">{s.organization_name}</TableCell>
                    <TableCell>
                      {s.pad_active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="outline">Not set</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.pending_count > 0 ? (
                        <span>
                          {s.pending_count} ·{' '}
                          {fmt.formatCurrency(s.pending_amount, {
                            showCurrencySymbol: true,
                            currencyOverride: 'CAD',
                          })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.processing_count > 0
                        ? `${s.processing_count} · ${fmt.formatCurrency(s.processing_amount, {
                            showCurrencySymbol: true,
                            currencyOverride: 'CAD',
                          })}`
                        : '—'}
                    </TableCell>
                    <TableCell>{s.completed_count}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {s.last_paid_at ? s.last_paid_at.slice(0, 10) : '—'}
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
