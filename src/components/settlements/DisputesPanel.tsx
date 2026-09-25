import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { AlertTriangle, ShieldAlert, Upload, ThumbsUp, ThumbsDown, FileText, Clock } from 'lucide-react';
import { useDisputes, useDisputeEvidence, useExpenseAccounts } from '@/hooks/useSettlements';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

function daysUntil(iso?: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.floor(ms / 86400_000);
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  needs_response: 'destructive',
  under_review: 'secondary',
  won: 'default',
  lost: 'destructive',
  withdrawn: 'outline',
  expired: 'outline',
};

export function DisputesPanel() {
  const { disputes, isLoading, record } = useDisputes();
  const { accounts: bankAccounts } = useBankAccounts();
  const { accounts: expenseAccounts } = useExpenseAccounts();
  const fmt = useCurrencyFormatter();
  const [selected, setSelected] = useState<any | null>(null);
  const [actionTarget, setActionTarget] = useState<{ dispute: any; action: 'open' | 'won' | 'lost' } | null>(null);
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');

  const pipeline = useMemo(() => {
    const groups: Record<string, any[]> = { needs_response: [], under_review: [], resolved: [] };
    for (const d of disputes) {
      if (d.status === 'needs_response') groups.needs_response.push(d);
      else if (d.status === 'under_review') groups.under_review.push(d);
      else groups.resolved.push(d);
    }
    return groups;
  }, [disputes]);

  const submitAction = () => {
    if (!actionTarget) return;
    record.mutate(
      {
        dispute_id: actionTarget.dispute.id,
        action: actionTarget.action,
        chargeback_expense_account_id: actionTarget.action === 'open' ? expenseAccountId : undefined,
        bank_clearing_account_id: actionTarget.action === 'open' ? bankAccountId : undefined,
      },
      {
        onSuccess: () => {
          setActionTarget(null);
          setExpenseAccountId('');
          setBankAccountId('');
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {(['needs_response', 'under_review', 'resolved'] as const).map((key) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {key === 'needs_response' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                {key === 'under_review' && <Clock className="h-4 w-4 text-amber-600" />}
                {key === 'resolved' && <ShieldAlert className="h-4 w-4 text-muted-foreground" />}
                <span className="capitalize">{key.replace('_', ' ')}</span>
                <Badge variant="secondary" className="ml-auto">{pipeline[key].length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-auto">
              {pipeline[key].length === 0 && (
                <p className="text-sm text-muted-foreground">No disputes</p>
              )}
              {pipeline[key].map((d) => {
                const days = daysUntil(d.evidence_due_at);
                const urgent = days !== null && days < 3 && d.status === 'needs_response';
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelected(d)}
                    className="w-full text-left rounded-md border p-3 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{d.processor_dispute_id}</div>
                        <div className="text-xs text-muted-foreground">{d.processor_account?.display_name ?? '—'}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono">{fmt.formatCurrency(Number(d.disputed_amount), { currencyOverride: d.currency })}</div>
                        {d.reason_code && <Badge variant="outline" className="text-xs">{d.reason_code}</Badge>}
                      </div>
                    </div>
                    {d.evidence_due_at && (
                      <div className="mt-2">
                        <Badge variant={urgent ? 'destructive' : 'outline'} className="text-xs">
                          {urgent ? `Due in ${Math.max(days!, 0)}d` : `Due ${new Date(d.evidence_due_at).toLocaleDateString()}`}
                        </Badge>
                      </div>
                    )}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {!isLoading && disputes.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No disputes yet. Connect a processor's live API on the Processor Accounts tab to sync chargebacks automatically.
          </CardContent>
        </Card>
      )}

      <DisputeDetailDialog
        dispute={selected}
        onClose={() => setSelected(null)}
        onAction={(action) => setActionTarget({ dispute: selected, action })}
      />

      <Dialog open={!!actionTarget} onOpenChange={(o) => { if (!o) setActionTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.action === 'open' && 'Post provisional chargeback JE'}
              {actionTarget?.action === 'won' && 'Mark dispute as won'}
              {actionTarget?.action === 'lost' && 'Mark dispute as lost'}
            </DialogTitle>
            <DialogDescription>
              {actionTarget && (
                <>
                  Amount:{' '}
                  <strong>
                    {fmt.formatCurrency(
                      Number(actionTarget.dispute.disputed_amount) + Number(actionTarget.dispute.fees ?? 0),
                      { currencyOverride: actionTarget.dispute.currency },
                    )}
                  </strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {actionTarget?.action === 'open' && (
            <div className="space-y-3">
              <div>
                <Label>Chargeback expense account (debit)</Label>
                <Select value={expenseAccountId} onValueChange={setExpenseAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {expenseAccounts.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bank clearing account (credit)</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select bank GL" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((a: any) => (
                      <SelectItem key={a.id} value={a.gl_account_id ?? a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionTarget(null)}>Cancel</Button>
            <Button
              onClick={submitAction}
              disabled={record.isPending || (actionTarget?.action === 'open' && (!expenseAccountId || !bankAccountId))}
            >
              {record.isPending ? 'Posting…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DisputeDetailDialog({ dispute, onClose, onAction }: { dispute: any | null; onClose: () => void; onAction: (a: 'open' | 'won' | 'lost') => void }) {
  const { evidence, uploadFile, addNarrative } = useDisputeEvidence(dispute?.id);
  const fmt = useCurrencyFormatter();
  const [narrative, setNarrative] = useState('');

  if (!dispute) return null;

  return (
    <Dialog open={!!dispute} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dispute.processor_dispute_id}
            <Badge variant={STATUS_VARIANT[dispute.status] ?? 'outline'}>{dispute.status.replace('_', ' ')}</Badge>
          </DialogTitle>
          <DialogDescription>
            {dispute.processor_account?.display_name ?? '—'} • {dispute.kind}
            {dispute.reason_code && ` • ${dispute.reason_code}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Disputed amount</Label>
            <div className="text-2xl font-mono">{fmt.formatCurrency(Number(dispute.disputed_amount), { currencyOverride: dispute.currency })}</div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Fees</Label>
            <div className="text-lg font-mono">{fmt.formatCurrency(Number(dispute.fees ?? 0), { currencyOverride: dispute.currency })}</div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Evidence due</Label>
            <div className="text-sm">{dispute.evidence_due_at ? new Date(dispute.evidence_due_at).toLocaleString() : '—'}</div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Resolved</Label>
            <div className="text-sm">{dispute.resolved_at ? new Date(dispute.resolved_at).toLocaleString() : '—'}</div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4" />Evidence</Label>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile.mutate(f);
                e.target.value = '';
              }}
              className="max-w-sm"
            />
            <span className="text-xs text-muted-foreground">{evidence.length} item(s)</span>
          </div>
          {evidence.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Title / file</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidence.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell><Badge variant="outline">{e.kind}</Badge></TableCell>
                    <TableCell className="text-sm">{e.file_name ?? e.title ?? (e.narrative ? e.narrative.slice(0, 60) + (e.narrative.length > 60 ? '…' : '') : '—')}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Textarea
            placeholder="Add a narrative note (saved as evidence)"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            rows={3}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!narrative.trim() || addNarrative.isPending}
            onClick={() => {
              addNarrative.mutate(narrative, { onSuccess: () => setNarrative('') });
            }}
          >
            Save narrative
          </Button>
        </div>

        <DialogFooter className="gap-2">
          {!dispute.journal_entry_id && (
            <Button onClick={() => onAction('open')}>
              <Upload className="h-4 w-4 mr-2" />Post provisional JE
            </Button>
          )}
          {dispute.journal_entry_id && !dispute.resolved_at && (
            <>
              <Button variant="outline" onClick={() => onAction('won')}>
                <ThumbsUp className="h-4 w-4 mr-2" />Mark won
              </Button>
              <Button variant="destructive" onClick={() => onAction('lost')}>
                <ThumbsDown className="h-4 w-4 mr-2" />Mark lost
              </Button>
            </>
          )}
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
