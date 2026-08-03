import { useState } from 'react';
import { CheckCircle2, Clock, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import {
  useApprovalRequest,
  useApprovalActions,
  useIsApprover,
  type ApprovableDocument,
} from '@/hooks/useApprovals';
import type { ApprovalDocumentType } from '@/lib/approvals';
import { cn } from '@/lib/utils';

interface ApprovalPanelProps {
  documentType: ApprovalDocumentType;
  documentId: string;
  amount: number;
  preparedBy?: string | null;
  /** Current approval state of the document ('pending_approval' | 'approved' | 'rejected' | ...) */
  status?: string | null;
  isPosted?: boolean;
  className?: string;
}

export function ApprovalStatusBadge({ status, isPosted }: { status?: string | null; isPosted?: boolean }) {
  if (isPosted || status === 'approved') {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <CheckCircle2 className="h-3 w-3" /> Approved &amp; posted
      </Badge>
    );
  }
  if (status === 'rejected') {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
      <Clock className="h-3 w-3" /> Pending approval
    </Badge>
  );
}

export function ApprovalPanel({
  documentType,
  documentId,
  amount,
  preparedBy,
  status,
  isPosted,
  className,
}: ApprovalPanelProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState('');
  const { data: isApprover } = useIsApprover(documentType);
  const { data: request } = useApprovalRequest(documentType, documentId);
  const { approveAndPost, reject } = useApprovalActions();

  const settled = isPosted || status === 'approved' || status === 'rejected';
  const isPreparer = !!preparedBy && preparedBy === user?.id;
  const doc: ApprovableDocument = { id: documentId, documentType, amount, preparedBy };

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Approval &amp; GL posting</p>
          <p className="text-xs text-muted-foreground">
            {settled
              ? 'This document has completed its approval.'
              : 'Nothing reaches the General Ledger until it is approved.'}
          </p>
        </div>
        <ApprovalStatusBadge status={status} isPosted={isPosted} />
      </div>

      {request?.workflow_id && !settled && (
        <p className="text-xs text-muted-foreground">Currently at step {request.current_step}.</p>
      )}

      {!settled && isPreparer && (
        <div className="flex items-start gap-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Segregation of duties — you prepared this document, so another approver must approve it.
          </span>
        </div>
      )}

      {!settled && isApprover && !isPreparer && (
        <div className="space-y-2">
          <Textarea
            placeholder="Approval comments (optional)"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => approveAndPost.mutate({ doc, comments })}
              disabled={approveAndPost.isPending}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Approve &amp; Post to GL
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => reject.mutate({ doc, comments, action: 'returned' })}
              disabled={reject.isPending}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Return for correction
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => reject.mutate({ doc, comments, action: 'rejected' })}
              disabled={reject.isPending}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      )}

      {!settled && !isApprover && !isPreparer && (
        <p className="text-xs text-muted-foreground">
          Waiting on a designated approver. Approvers are managed in Settings → Approvals.
        </p>
      )}
    </div>
  );
}
