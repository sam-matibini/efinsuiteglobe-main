import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, ShieldCheck } from 'lucide-react';
import { useCraApprovals, requiredApprovals } from '@/hooks/useCraApprovals';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  taxPaymentId: string;
  amount: number;
}

export function CraApprovalPanel({ taxPaymentId, amount }: Props) {
  const { user } = useAuth();
  const { approvals, record } = useCraApprovals(taxPaymentId);
  const [comment, setComment] = useState('');

  const required = requiredApprovals(amount);
  const needsCfo = amount >= 50000;

  // Get latest decision per approver
  const latestByUser = new Map<string, { decision: string; comment: string | null; decided_at: string }>();
  for (const a of [...approvals].sort((x, y) => x.decided_at.localeCompare(y.decided_at))) {
    latestByUser.set(a.approver_user_id, { decision: a.decision, comment: a.comment, decided_at: a.decided_at });
  }
  const approvedCount = [...latestByUser.values()].filter((x) => x.decision === 'approved').length;
  const rejected = [...latestByUser.values()].some((x) => x.decision === 'rejected');
  const userAlreadyDecided = user?.id ? latestByUser.has(user.id) : false;
  const satisfied = !rejected && approvedCount >= required;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Approval workflow
          <Badge variant={satisfied ? 'default' : rejected ? 'destructive' : 'outline'}>
            {rejected ? 'Rejected' : satisfied ? 'Approved' : `${approvedCount}/${required} approvals`}
          </Badge>
          {needsCfo && <Badge variant="outline">CFO required</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          Tier: amount {amount < 5000 ? '< $5,000 (1 approval)' : amount < 50000 ? '$5,000–$50,000 (2 approvals)' : '≥ $50,000 (2 approvals incl. CFO/admin)'}
        </div>

        {approvals.length > 0 && (
          <div className="rounded-md border divide-y text-sm">
            {approvals.map((a) => (
              <div key={a.id} className="flex items-start justify-between px-3 py-2">
                <div>
                  <Badge variant={a.decision === 'approved' ? 'default' : 'destructive'} className="mr-2">{a.decision}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(a.decided_at).toLocaleString()}</span>
                  {a.comment && <p className="text-xs mt-1">{a.comment}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {!userAlreadyDecided && !satisfied && !rejected && (
          <div className="space-y-2">
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional comment" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => record.mutate({ tax_payment_id: taxPaymentId, decision: 'approved', comment })} disabled={record.isPending}>
                <Check className="mr-1 h-3 w-3" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => record.mutate({ tax_payment_id: taxPaymentId, decision: 'rejected', comment })} disabled={record.isPending}>
                <X className="mr-1 h-3 w-3" /> Reject
              </Button>
            </div>
          </div>
        )}
        {userAlreadyDecided && <p className="text-xs text-muted-foreground">You have already recorded a decision on this remittance.</p>}
      </CardContent>
    </Card>
  );
}
