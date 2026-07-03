import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, RefreshCw, Lock, ArrowLeftRight, History, Sparkles } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useExchangeRates, useCurrencies } from '@/hooks/useCurrencies';
import { useFxRateSync, useFxRateBackfill } from '@/hooks/useMultiCurrencySettings';
import { AddRateDialog } from '@/components/currency/AddRateDialog';
import { LockPeriodDialog } from '@/components/currency/LockPeriodDialog';
import { RateAuditPanel } from '@/components/currency/RateAuditPanel';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

export default function ExchangeRates() {
  const isReadOnly = useIsReadOnly();
  const { exchangeRates, isLoading } = useExchangeRates();
  const { currencies, seedLocalizedCurrencies } = useCurrencies();
  const fxSync = useFxRateSync();
  const fxBackfill = useFxRateBackfill();
  const [addOpen, setAddOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [filterCurrency, setFilterCurrency] = useState<string>('all');

  const filteredRates = useMemo(() => {
    if (filterCurrency === 'all') return exchangeRates;
    return exchangeRates.filter(
      (r) => r.from_currency === filterCurrency || r.to_currency === filterCurrency,
    );
  }, [exchangeRates, filterCurrency]);

  const allCurrencyCodes = useMemo(() => {
    const codes = new Set<string>();
    exchangeRates.forEach((r) => {
      codes.add(r.from_currency);
      codes.add(r.to_currency);
    });
    currencies.forEach((c) => codes.add(c.code));
    return Array.from(codes).sort();
  }, [exchangeRates, currencies]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-primary" />
            Exchange Rates
          </h1>
          <p className="text-muted-foreground">Manage foreign exchange rates and period locks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => fxBackfill.mutate({ startDate: '2024-01-01' })}
            disabled={fxBackfill.isPending || isReadOnly}
          >
            <History className={`w-4 h-4 mr-2 ${fxBackfill.isPending ? 'animate-spin' : ''}`} />
            Backfill 2024–Today
          </Button>
          <Button variant="outline" onClick={() => fxSync.mutate()} disabled={fxSync.isPending || isReadOnly}>
            <RefreshCw className={`w-4 h-4 mr-2 ${fxSync.isPending ? 'animate-spin' : ''}`} />
            Refresh from API
          </Button>
          <Button
            variant="outline"
            onClick={() => seedLocalizedCurrencies.mutate()}
            disabled={seedLocalizedCurrencies.isPending || isReadOnly}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Seed Currencies
          </Button>
          <Button variant="outline" onClick={() => setLockOpen(true)} disabled={isReadOnly}>
            <Lock className="w-4 h-4 mr-2" /> Lock Period
          </Button>
          <Button onClick={() => setAddOpen(true)} disabled={isReadOnly}>
            <Plus className="w-4 h-4 mr-2" /> Add Rate
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h2 className="text-base font-semibold">Historical Rates</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter:</span>
              <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All currencies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All currencies</SelectItem>
                  {allCurrencyCodes.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="secondary">{filteredRates.length} rates</Badge>
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Pair</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                )}
                {!isLoading && filteredRates.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No rates yet. Add one, sync from API, or backfill history.</TableCell></TableRow>
                )}
                {filteredRates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.effective_date}</TableCell>
                    <TableCell className="font-mono">{r.from_currency} → {r.to_currency}</TableCell>
                    <TableCell className="text-right font-mono">{Number(r.rate).toFixed(6)}</TableCell>
                    <TableCell><Badge variant="outline">{r.source || 'manual'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <RateAuditPanel />
      </div>

      <AddRateDialog open={addOpen} onOpenChange={setAddOpen} />
      <LockPeriodDialog open={lockOpen} onOpenChange={setLockOpen} />
    </div>
  );
}
