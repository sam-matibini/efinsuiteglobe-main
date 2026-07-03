import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, AlertCircle, Info, ExternalLink, RefreshCw, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useTaxExceptions, type TaxExceptionSeverity, type TaxExceptionCategory } from '@/hooks/useTaxExceptions';
import { format, startOfYear, endOfMonth } from 'date-fns';

const SEVERITY_VARIANT: Record<TaxExceptionSeverity, 'destructive' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  warning: 'secondary',
  info: 'outline',
};

const SEVERITY_ICON: Record<TaxExceptionSeverity, typeof AlertTriangle> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const CATEGORY_LABEL: Record<TaxExceptionCategory, string> = {
  missing_tax_code: 'Missing tax code',
  rate_mismatch: 'Rate mismatch',
  inactive_code_used: 'Inactive code used',
  expired_code_used: 'Expired code used',
  missing_gl_mapping: 'Missing GL mapping',
  reconciliation_gap: 'Reconciliation gap',
  unmapped_jurisdiction: 'Unmapped jurisdiction',
};

export default function TaxExceptions() {
  const { organization } = useCurrentOrganization();
  const today = new Date();
  const [startDate, setStartDate] = useState(format(startOfYear(today), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [severityFilter, setSeverityFilter] = useState<'all' | TaxExceptionSeverity>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TaxExceptionCategory>('all');

  const { data: exceptions = [], isLoading, refetch, isFetching } = useTaxExceptions({
    organizationId: organization?.id,
    startDate,
    endDate,
  });

  const filtered = useMemo(() => {
    return exceptions.filter((e) => {
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      return true;
    });
  }, [exceptions, severityFilter, categoryFilter]);

  const counts = useMemo(() => {
    return {
      critical: exceptions.filter((e) => e.severity === 'critical').length,
      warning: exceptions.filter((e) => e.severity === 'warning').length,
      info: exceptions.filter((e) => e.severity === 'info').length,
      total: exceptions.length,
    };
  }, [exceptions]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tax Exceptions</h1>
          <p className="text-muted-foreground mt-1">
            Issues that may prevent accurate tax filing. Review and fix before closing the period.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="Total" value={counts.total} />
        <SummaryCard label="Critical" value={counts.critical} variant="destructive" />
        <SummaryCard label="Warning" value={counts.warning} variant="secondary" />
        <SummaryCard label="Info" value={counts.info} variant="outline" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label htmlFor="start">From</Label>
            <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="end">To</Label>
            <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label>Severity</Label>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-6 space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No exceptions found for the selected filters. Your tax data looks clean.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Severity</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((ex) => {
                const Icon = SEVERITY_ICON[ex.severity];
                return (
                  <TableRow key={ex.id}>
                    <TableCell>
                      <Badge variant={SEVERITY_VARIANT[ex.severity]} className="gap-1">
                        <Icon className="h-3 w-3" />
                        {ex.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{ex.title}</div>
                      <div className="text-xs text-muted-foreground">{ex.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{CATEGORY_LABEL[ex.category]}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{ex.entityRef ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono">
                      {ex.amount !== undefined ? ex.amount.toFixed(2) : '—'}
                    </TableCell>
                    <TableCell>
                      {ex.fixHref && (
                        <Button asChild variant="ghost" size="sm">
                          <Link to={ex.fixHref}>
                            Fix <ExternalLink className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  variant = 'outline',
}: {
  label: string;
  value: number;
  variant?: 'destructive' | 'secondary' | 'outline';
}) {
  return (
    <Card className="p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-3xl font-bold">{value}</span>
        {variant !== 'outline' && value > 0 && <Badge variant={variant}>!</Badge>}
      </div>
    </Card>
  );
}
