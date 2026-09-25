import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { usePaymentApprovals, EntityType, ApprovalStep } from '@/hooks/usePaymentApprovals';
import { useAuth } from '@/hooks/useAuth';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { Check, X, Send, Clock } from 'lucide-react';

interface Props {
  entityType: EntityType;
  entityId: string;
  approvalState: 'draft' | 'pending_review' | 'pending_approval' | 'approved' | 'rejected';
  originatorId: string | null;
}

const STATE_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  pending_review: 'secondary',
  pending_approval: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

export function ApprovalCard({ entityType, entityId, approvalState, originatorId }: Props) {
  const { user } = useAuth();
  const isReadOnly = useIsReadOnly();
  const { approvals, decide, submitForReview } = usePaymentApprovals(entityType, entityId);
  const [comment, setComment] = useState('');

  const isOriginator = !!user && user.id === originatorId;
  const canAct = !isReadOnly && !isOriginator;

  const currentStep: ApprovalStep | null =
    approvalState === 'pending_review' ? 'review'
    : approvalState === 'pending_approval' ? 'approve'
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" /> Approval Workflow
        </CardTitle>
        <Badge variant={STATE_COLORS[approvalState] ?? 'outline'}>
          {approvalState.replace('_', ' ')}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {approvalState === 'draft' && !isReadOnly && (
          <Button size="sm" onClick={() => submitForReview.mutate({ entity_type: entityType, entity_id: entityId })}>
            <Send className="mr-2 h-3 w-3" /> Submit for review
          </Button>
        )}

        {currentStep && (
          <div className="space-y-2">
            {isOriginator && (
              <p className="text-xs text-muted-foreground">
                You originated this payment — another team member must {currentStep === 'review' ? 'review' : 'approve'} it.
              </p>
            )}
            {canAct && (
              <>
                <Textarea
                  placeholder="Optional comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide.mutate({
                    entity_type: entityType, entity_id: entityId,
                    step: currentStep, decision: 'approved', comment,
                  })}>
                    <Check className="mr-2 h-3 w-3" />
                    {currentStep === 'review' ? 'Approve review' : 'Approve payment'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => decide.mutate({
                    entity_type: entityType, entity_id: entityId,
                    step: currentStep, decision: 'rejected', comment,
                  })}>
                    <X className="mr-2 h-3 w-3" /> Reject
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {approvals.length > 0 && (
          <div className="border-t pt-2 space-y-1">
            <div className="text-xs font-medium text-muted-foreground">History</div>
            {approvals.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <span>{a.step} → {a.decision}</span>
                <span className="text-muted-foreground">{a.decided_at ? new Date(a.decided_at).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
