import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useCountryTreasuryConfig } from '@/hooks/useCountryTreasuryConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import { Info, CheckCircle2 } from 'lucide-react';
import { RecordCraConfirmationDialog } from '@/components/treasury/RecordCraConfirmationDialog';

interface UnifiedRow {
  id: string;
  kind: 'cra' | 'ap' | 'payroll';
  reference: string;
  date: string | null;
  amount: number;
  currency: string;
  status: string;
  approval_state: string | null;
  detail_path: string;
}

type StageTone = 'progress' | 'success' | 'destructive' | 'muted';
interface Stage {
  index: number; // 1..6 or 0 for terminal
  label: string;
  percent: number;
  tone: StageTone;
  terminal?: boolean;
}

const STAGE_LABELS = ['Draft', 'Review', 'Approval', 'Approved', 'Processing', 'Completed'];

function stageAt(index: number, label?: string): Stage {
  const i = Math.max(1, Math.min(6, index));
  return {
    index: i,
    label: label ?? STAGE_LABELS[i - 1],
    percent: Math.round((i / 6) * 100),
    tone: i === 6 ? 'success' : 'progress',
  };
}

function terminalStage(label: string, tone: StageTone = 'destructive'): Stage {
  return { index: 0, label, percent: 0, tone, terminal: true };
}

function getStage(row: UnifiedRow): Stage {
  const status = (row.status ?? '').toLowerCase();
  const approval = (row.approval_state ?? '').toLowerCase();

  // Terminal states (apply to all)
  if (status === 'failed') return terminalStage('Failed', 'destructive');
  if (status === 'cancelled') return terminalStage('Cancelled', 'muted');
  if (status === 'reversed') return terminalStage('Reversed', 'muted');
  if (approval === 'rejected') return terminalStage('Rejected', 'destructive');

  if (row.kind === 'cra') {
    switch (status) {
      case 'draft': return stageAt(1);
      case 'scheduled': return stageAt(4, 'Scheduled');
      case 'submitted': return stageAt(5, 'Submitted');
      case 'paid':
      case 'completed': return stageAt(6);
      default: return stageAt(1);
    }
  }

  // AP / Payroll batches — use approval_state for stages 1-4, status for 5-6
  if (status === 'completed' || status === 'paid') return stageAt(6);
  if (status === 'partial') return stageAt(5, 'Processing (Partial)');
  if (status === 'processing') return stageAt(5);

  switch (approval) {
    case 'draft': return stageAt(1);
    case 'pending_review': return stageAt(2, 'Pending Review');
    case 'pending_approval': return stageAt(3, 'Pending Approval');
    case 'approved': return stageAt(4);
    default:
      if (status === 'approved') return stageAt(4);
      if (status === 'draft') return stageAt(1);
      return stageAt(1);
  }
}

export default function PaymentHistory() {
  const { currentOrganization } = useOrganizationContext();
  const { config } = useCountryTreasuryConfig();
  const primaryAuthority = config.taxPayees[0]?.authority ?? 'Tax';
  const orgId = currentOrganization?.id;
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; reference: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['payment-history', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [tax, ap, pr] = await Promise.all([
        supabase.from('tax_payments').select('id, reference, scheduled_for, paid_at, amount, currency, status').eq('organization_id', orgId!).order('created_at', { ascending: false }),
        (supabase as any).from('ap_payment_batches').select('id, batch_number, payment_date, total_amount, currency, status, approval_state').eq('organization_id', orgId!).order('created_at', { ascending: false }),
        (supabase as any).from('payroll_payment_batches').select('id, batch_number, pay_date, total_net, currency, status, approval_state').eq('organization_id', orgId!).order('created_at', { ascending: false }),
      ]);
      const rows: UnifiedRow[] = [
        ...((tax.data ?? []) as any[]).map((r) => ({
          id: r.id, kind: 'cra' as const, reference: r.reference,
          date: r.paid_at ?? r.scheduled_for, amount: Number(r.amount), currency: r.currency,
          status: r.status, approval_state: null, detail_path: `/banking-payments/cra-payments`,
        })),
        ...((ap.data ?? []) as any[]).map((r) => ({
          id: r.id, kind: 'ap' as const, reference: r.batch_number,
          date: r.payment_date, amount: Number(r.total_amount), currency: r.currency,
          status: r.status, approval_state: r.approval_state, detail_path: `/treasury/ap-payments/${r.id}`,
        })),
        ...((pr.data ?? []) as any[]).map((r) => ({
          id: r.id, kind: 'payroll' as const, reference: r.batch_number,
          date: r.pay_date, amount: Number(r.total_net), currency: r.currency,
          status: r.status, approval_state: r.approval_state, detail_path: `/treasury/payroll-payments/${r.id}`,
        })),
      ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
      return rows;
    },
  });

  const renderProgress = (stage: Stage) => {
    if (stage.terminal) {
      return (
        <Badge variant={stage.tone === 'destructive' ? 'destructive' : 'secondary'}>
          {stage.label}
        </Badge>
      );
    }
    return (
      <div className="min-w-[140px] space-y-1">
        <Progress value={stage.percent} className="h-2" />
        <p className="text-[10px] text-muted-foreground font-mono">
          Step {stage.index}/6
        </p>
      </div>
    );
  };

  const renderTable = (rows: UnifiedRow[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>
            <div className="flex items-center gap-1">
              Progress
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs font-medium mb-1">Payment lifecycle</p>
                    <ol className="text-xs space-y-0.5 list-decimal list-inside">
                      {STAGE_LABELS.map((s) => <li key={s}>{s}</li>)}
                    </ol>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Terminal: Failed, Rejected, Cancelled, Reversed
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </TableHead>
          <TableHead className="w-1" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const stage = getStage(r);
          return (
            <TableRow key={`${r.kind}-${r.id}`}>
              <TableCell>
                <Link to={r.detail_path} className="font-mono text-xs hover:underline">{r.reference}</Link>
              </TableCell>
              <TableCell><Badge variant="outline" className="capitalize">{r.kind}</Badge></TableCell>
              <TableCell>{r.date ?? '—'}</TableCell>
              <TableCell className="text-right font-mono">{r.currency} {r.amount.toFixed(2)}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    stage.tone === 'success' ? 'default'
                    : stage.tone === 'destructive' ? 'destructive'
                    : stage.tone === 'muted' ? 'outline'
                    : 'secondary'
                  }
                >
                  {stage.label}
                </Badge>
              </TableCell>
              <TableCell>{renderProgress(stage)}</TableCell>
              <TableCell>
                {r.kind === 'cra' && ['submitted', 'processing', 'pending', 'authorized', 'scheduled'].includes(r.status.toLowerCase()) && (
                  <Button size="sm" variant="outline" onClick={() => setConfirmTarget({ id: r.id, reference: r.reference })}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Record confirmation
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  const rows = data ?? [];
  const cra = rows.filter(r => r.kind === 'cra');
  const ap = rows.filter(r => r.kind === 'ap');
  const payroll = rows.filter(r => r.kind === 'payroll');

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Payment History</h1>
        <p className="text-muted-foreground">Unified history of {primaryAuthority}, AP and payroll payments</p>
      </div>

      <Card>
        <CardHeader><CardTitle>All payments</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p>Loading…</p> : (
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
                <TabsTrigger value="cra">{primaryAuthority} ({cra.length})</TabsTrigger>
                <TabsTrigger value="ap">AP ({ap.length})</TabsTrigger>
                <TabsTrigger value="payroll">Payroll ({payroll.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="all">{renderTable(rows)}</TabsContent>
              <TabsContent value="cra">{renderTable(cra)}</TabsContent>
              <TabsContent value="ap">{renderTable(ap)}</TabsContent>
              <TabsContent value="payroll">{renderTable(payroll)}</TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <RecordCraConfirmationDialog
        open={!!confirmTarget}
        onOpenChange={(o) => !o && setConfirmTarget(null)}
        payment={confirmTarget}
      />
    </div>
  );
}
