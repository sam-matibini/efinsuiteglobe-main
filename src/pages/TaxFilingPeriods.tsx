import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarDays, Lock, Unlock, FileCheck, CircleDollarSign, Sparkles, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTaxAuthorities } from '@/hooks/useTaxAuthorities';
import { useTaxFilingPeriods, type TaxFilingPeriod } from '@/hooks/useTaxFilingPeriods';
import { UnlockPeriodDialog } from '@/components/tax/UnlockPeriodDialog';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';

const STATUS_VARIANT: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-muted text-foreground' },
  filed: { label: 'Filed', className: 'bg-primary/15 text-primary' },
  locked: { label: 'Locked', className: 'bg-destructive/15 text-destructive' },
  paid: { label: 'Paid', className: 'bg-emerald-500/15 text-emerald-600' },
};

function dueChip(period: TaxFilingPeriod) {
  if (period.status === 'paid' || period.status === 'filed') return null;
  const days = differenceInCalendarDays(parseISO(period.due_date), new Date());
  if (days < 0) return <Badge variant="destructive" className="ml-2">Overdue {Math.abs(days)}d</Badge>;
  if (days <= 14) return <Badge variant="outline" className="ml-2 border-amber-500/50 text-amber-600">Due in {days}d</Badge>;
  return null;
}

export default function TaxFilingPeriods() {
  const readOnly = useIsReadOnly();
  const { authorities, isLoading: authLoading } = useTaxAuthorities();
  const [authorityId, setAuthorityId] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [unlockTarget, setUnlockTarget] = useState<TaxFilingPeriod | null>(null);

  const activeAuthority = authorityId || authorities[0]?.id || '';
  const { periods, isLoading, generatePeriods, lockPeriod, unlockPeriod, markFiled, markPaid } =
    useTaxFilingPeriods(activeAuthority || undefined);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => a.period_start.localeCompare(b.period_start)),
    [periods]
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-primary" /> Tax Filing Periods
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage filing periods, lock filed periods, and track due dates by tax authority.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 min-w-[220px]">
            <label className="text-sm font-medium">Tax Authority</label>
            <Select value={activeAuthority} onValueChange={setAuthorityId} disabled={authLoading || authorities.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={authorities.length ? 'Select authority' : 'No authorities yet'} />
              </SelectTrigger>
              <SelectContent>
                {authorities.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} <span className="text-muted-foreground">({a.filing_frequency})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-[140px]">
            <label className="text-sm font-medium">Year</label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => activeAuthority && generatePeriods.mutate({ authorityId: activeAuthority, year })}
            disabled={!activeAuthority || generatePeriods.isPending || readOnly}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate {year} Periods
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Filing Periods</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : sortedPeriods.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No periods yet. Pick an authority and click <strong>Generate Periods</strong>.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPeriods.map((p) => {
                  const variant = STATUS_VARIANT[p.status] ?? STATUS_VARIANT.open;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">
                          {format(parseISO(p.period_start), 'MMM d, yyyy')} – {format(parseISO(p.period_end), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(p.due_date), 'MMM d, yyyy')}
                        {dueChip(p)}
                      </TableCell>
                      <TableCell>
                        <Badge className={variant.className} variant="outline">{variant.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/tax/file-return/${p.id}`}>
                            <Receipt className="w-3.5 h-3.5 mr-1" /> File Return
                          </Link>
                        </Button>
                        {p.status === 'open' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markFiled.mutate(p.id)}
                              disabled={markFiled.isPending || readOnly}
                            >
                              <FileCheck className="w-3.5 h-3.5 mr-1" /> Mark Filed
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => lockPeriod.mutate(p.id)}
                              disabled={lockPeriod.isPending || readOnly}
                            >
                              <Lock className="w-3.5 h-3.5 mr-1" /> Lock
                            </Button>
                          </>
                        )}
                        {p.status === 'filed' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => lockPeriod.mutate(p.id)}
                              disabled={lockPeriod.isPending || readOnly}
                            >
                              <Lock className="w-3.5 h-3.5 mr-1" /> Lock
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => markPaid.mutate(p.id)}
                              disabled={markPaid.isPending || readOnly}
                            >
                              <CircleDollarSign className="w-3.5 h-3.5 mr-1" /> Mark Paid
                            </Button>
                          </>
                        )}
                        {p.status === 'locked' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setUnlockTarget(p)}
                            disabled={readOnly}
                          >
                            <Unlock className="w-3.5 h-3.5 mr-1" /> Unlock
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UnlockPeriodDialog
        open={Boolean(unlockTarget)}
        onOpenChange={(o) => !o && setUnlockTarget(null)}
        isPending={unlockPeriod.isPending}
        onConfirm={(reason) => {
          if (unlockTarget) {
            unlockPeriod.mutate(
              { periodId: unlockTarget.id, reason },
              { onSuccess: () => setUnlockTarget(null) }
            );
          }
        }}
      />
    </div>
  );
}
