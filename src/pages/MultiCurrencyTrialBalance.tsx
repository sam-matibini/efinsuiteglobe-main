import { useMultiCurrencyTrialBalance } from '@/hooks/useMultiCurrencyTrialBalance';
import { useMultiCurrencySettings } from '@/hooks/useMultiCurrencySettings';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useFinancialReportsRealtime } from '@/hooks/useFinancialReportsRealtime';
import { RealtimeIndicator } from '@/components/reports/RealtimeIndicator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { Globe } from 'lucide-react';

export default function MultiCurrencyTrialBalance() {
  const { data: rows, isLoading } = useMultiCurrencyTrialBalance();
  const { settings } = useMultiCurrencySettings();
  const { organization } = useCurrentOrganization();
  const { lastEventAt: realtimeLastEventAt } = useFinancialReportsRealtime(organization?.id);
  const baseCurrency = settings?.base_currency || 'USD';

  const totalBaseDebit = (rows || []).reduce((s, r) => s + r.base_debit, 0);
  const totalBaseCredit = (rows || []).reduce((s, r) => s + r.base_credit, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" /> Multi-Currency Trial Balance
          </h1>
          <p className="text-muted-foreground text-sm">
            Account balances grouped by transaction currency, with base currency ({baseCurrency}) equivalent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RealtimeIndicator lastEventAt={realtimeLastEventAt} />
          <ReportFilters />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balances by Account & Currency</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-96" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">FC Debit</TableHead>
                  <TableHead className="text-right">FC Credit</TableHead>
                  <TableHead className="text-right">FC Balance</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Base Debit ({baseCurrency})</TableHead>
                  <TableHead className="text-right">Base Credit ({baseCurrency})</TableHead>
                  <TableHead className="text-right">Base Balance ({baseCurrency})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!rows || rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No journal entries in the selected period.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={`${r.account_id}-${r.currency}`}>
                      <TableCell className="font-medium">{r.account_code} – {r.account_name}</TableCell>
                      <TableCell>
                        <Badge variant={r.currency === baseCurrency ? 'outline' : 'secondary'}>{r.currency}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.fc_debit.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.fc_credit.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">{r.fc_balance.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">{r.rate.toFixed(6)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.base_debit.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{r.base_credit.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">{r.base_balance.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {rows && rows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={6} className="font-bold">Total ({baseCurrency})</TableCell>
                    <TableCell className="text-right font-mono font-bold">{totalBaseDebit.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{totalBaseCredit.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-mono font-bold ${Math.abs(totalBaseDebit - totalBaseCredit) < 0.01 ? 'text-success' : 'text-destructive'}`}>
                      {(totalBaseDebit - totalBaseCredit).toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
