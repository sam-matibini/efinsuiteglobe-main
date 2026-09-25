import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTreasuryAnomalies } from '@/hooks/useTreasuryAnomalies';

export function AnomalyBanner({ filterAuthority }: { filterAuthority?: 'cra' | 'provincial' }) {
  const { open } = useTreasuryAnomalies();
  const filtered = filterAuthority === 'cra'
    ? open.filter((a) => !a.authority || a.authority === 'CRA' || a.authority?.toLowerCase().includes('cra'))
    : filterAuthority === 'provincial'
      ? open.filter((a) => a.authority && !a.authority.toLowerCase().includes('cra'))
      : open;

  if (filtered.length === 0) return null;
  const critical = filtered.filter((a) => a.severity === 'critical').length;

  return (
    <Card className={`border-l-4 ${critical ? 'border-l-destructive bg-destructive/5' : 'border-l-amber-500 bg-amber-500/5'}`}>
      <CardContent className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className={`h-5 w-5 ${critical ? 'text-destructive' : 'text-amber-600'}`} />
          <div>
            <p className="font-medium text-sm">
              {filtered.length} open anomal{filtered.length === 1 ? 'y' : 'ies'}
              {critical > 0 ? ` (${critical} critical)` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              Review missed periods, duplicate payments, and unusual swings before they become CRA exposure.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant={critical ? 'destructive' : 'outline'}>
          <Link to="/banking-payments/anomalies">
            Review <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
