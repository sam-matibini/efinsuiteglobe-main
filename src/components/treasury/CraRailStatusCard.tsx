import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Cable } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePadAgreements } from '@/hooks/usePadAgreements';
import { useTaxPayments } from '@/hooks/useTaxPayments';

/**
 * Phase 11 — single-glance readiness panel for live CRA remittance via Paysafe.
 *
 * Paysafe secret presence is checked server-side at submission time; here we
 * surface what the client can see: PAD coverage and the latest Paysafe-backed
 * tax payment timestamp.
 */
export function CraRailStatusCard() {
  const { pads } = usePadAgreements({ scope: 'cra' });
  const { payments } = useTaxPayments();

  const activePads = pads.filter((p) => p.status === 'active');
  const lastPaysafe = payments
    .filter((p) => ['paysafe_card', 'paysafe_eft', 'paysafe_interac'].includes(p.payment_method as string))
    .sort((a, b) => (b.submitted_at ?? b.created_at).localeCompare(a.submitted_at ?? a.created_at))[0];

  const ready = activePads.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Cable className="h-4 w-4 text-primary" /> CRA payment rail
        </CardTitle>
        {ready ? (
          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
          </Badge>
        ) : (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" /> Setup required
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Active PAD agreements</span>
          <span className="font-medium">{activePads.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Last Paysafe submission</span>
          <span className="font-mono text-xs">
            {lastPaysafe?.submitted_at?.slice(0, 10) ?? lastPaysafe?.created_at?.slice(0, 10) ?? '—'}
          </span>
        </div>
        {!ready && (
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link to="/treasury/settings">Set up PAD agreement</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
