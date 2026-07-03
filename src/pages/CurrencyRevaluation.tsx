import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Loader2, RefreshCw, FileText } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRevaluationPreview, useRevaluations, usePostRevaluation } from '@/hooks/useRevaluation';
import { useMultiCurrencySettings } from '@/hooks/useMultiCurrencySettings';
import { useLocalizedCurrency } from '@/hooks/useLocalizedCurrency';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function CurrencyRevaluation() {
  const today = new Date().toISOString().split('T')[0];
  const [periodEnd, setPeriodEnd] = useState<string>(today);
  const [activePeriod, setActivePeriod] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { settings } = useMultiCurrencySettings();
  const { data: previewLines, isLoading: previewLoading, refetch } = useRevaluationPreview(activePeriod);
  const { data: history } = useRevaluations();
  const postReval = usePostRevaluation();
  const { formatCurrency: fmt } = useLocalizedCurrency();

  const mcEnabled = !!settings?.multi_currency_enabled;
  const hasUnrealizedAcct = !!settings?.unrealized_fx_account_id;

  const totalGain = (previewLines || []).filter(l => l.gain_loss > 0).reduce((s, l) => s + l.gain_loss, 0);
  const totalLoss = (previewLines || []).filter(l => l.gain_loss < 0).reduce((s, l) => s + Math.abs(l.gain_loss), 0);
  const netImpact = totalGain - totalLoss;

  const handlePreview = () => {
    setActivePeriod(periodEnd);
  };

  const handlePost = async () => {
    if (!activePeriod || !previewLines || previewLines.length === 0) return;
    await postReval.mutateAsync({ periodEnd: activePeriod, lines: previewLines, notes });
    setActivePeriod(null);
    setNotes('');
  };

  if (!mcEnabled) {
    return (
      <div className="container max-w-3xl mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Multi-Currency Not Enabled</AlertTitle>
          <AlertDescription>
            Enable multi-currency in <Link className="underline" to="/settings">Settings → Multi-Currency</Link> to use the revaluation tool.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Currency Revaluation</h1>
          <p className="text-muted-foreground mt-1">
            Revalue open foreign-currency balances at period-end and post unrealized FX gains/losses.
          </p>
        </div>
      </div>

      {!hasUnrealizedAcct && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unrealized FX account not configured</AlertTitle>
          <AlertDescription>
            Set the Unrealized FX Gain/Loss account in <Link className="underline" to="/settings">Settings → Multi-Currency</Link> before posting a revaluation.
          </AlertDescription>
        </Alert>
      )}

      {/* Step 1: Select period-end */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1 — Period End</CardTitle>
          <CardDescription>Choose the as-of date for revaluation. Closing rates valid on/before this date will be used.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="period-end">Period End Date</Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-48"
              />
            </div>
            <Button onClick={handlePreview} disabled={previewLoading}>
              {previewLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Preview
            </Button>
            {activePeriod && (
              <Button variant="ghost" onClick={() => refetch()} disabled={previewLoading}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Preview */}
      {activePeriod && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 — Revaluation Preview</CardTitle>
            <CardDescription>
              As of <span className="font-medium">{format(new Date(activePeriod), 'PPP')}</span>
              {previewLines && ` — ${previewLines.length} foreign-currency balance${previewLines.length === 1 ? '' : 's'}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !previewLines || previewLines.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No open foreign-currency balances to revalue at this date.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="text-sm text-muted-foreground">Unrealized Gain</div>
                    <div className="text-2xl font-semibold text-success mt-1">
                      {fmt(totalGain)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="text-sm text-muted-foreground">Unrealized Loss</div>
                    <div className="text-2xl font-semibold text-destructive mt-1">
                      {fmt(totalLoss)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="text-sm text-muted-foreground">Net Impact</div>
                    <div className={`text-2xl font-semibold mt-1 ${netImpact >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {fmt(netImpact)}
                    </div>
                  </div>
                </div>

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead className="text-right">Balance (FC)</TableHead>
                        <TableHead className="text-right">Historical Rate</TableHead>
                        <TableHead className="text-right">Closing Rate</TableHead>
                        <TableHead className="text-right">Base Before</TableHead>
                        <TableHead className="text-right">Base After</TableHead>
                        <TableHead className="text-right">Gain / (Loss)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewLines.map((l) => (
                        <TableRow key={`${l.account_id}-${l.currency}`}>
                          <TableCell>
                            <div className="font-medium">{l.account_code}</div>
                            <div className="text-xs text-muted-foreground">{l.account_name}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{l.currency}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{l.balance_fc.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {l.historical_rate?.toFixed(6) ?? '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono">{l.closing_rate.toFixed(6)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(l.base_balance_before)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(l.base_balance_after)}</TableCell>
                          <TableCell className={`text-right font-mono font-semibold ${l.gain_loss >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {fmt(l.gain_loss)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reval-notes">Notes (optional)</Label>
                  <Textarea
                    id="reval-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Memo for this revaluation..."
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setActivePeriod(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePost}
                    disabled={postReval.isPending || !hasUnrealizedAcct}
                  >
                    {postReval.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Post Revaluation Journal
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Revaluation History</CardTitle>
          <CardDescription>Past period-end revaluations posted to the ledger.</CardDescription>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No revaluations posted yet.</div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total Gain</TableHead>
                    <TableHead className="text-right">Total Loss</TableHead>
                    <TableHead>Journal Entry</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{format(new Date(r.period_end), 'PPP')}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'posted' ? 'default' : r.status === 'reversed' ? 'destructive' : 'secondary'}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-success">{fmt(r.total_unrealized_gain)}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">{fmt(r.total_unrealized_loss)}</TableCell>
                      <TableCell>
                        {r.journal_entry_id ? (
                          <Link to={`/journal-entries`} className="text-primary hover:underline inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" /> View
                          </Link>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(r.created_at), 'PP')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
