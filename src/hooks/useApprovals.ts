import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import {
  approveStep,
  canApprove,
  getApprovalRequest,
  isDesignatedApprover,
  isOrgAdmin,
  rejectStep,
  requestApproval,
  type ApprovalDocumentType,
} from '@/lib/approvals';
import { postApprovedDocument } from '@/lib/approvals/posting';

export interface ApprovableDocument {
  id: string;
  documentType: ApprovalDocumentType;
  amount: number;
  preparedBy?: string | null;
  approvalStatus?: string | null;
  isPosted?: boolean;
}

/** Is the signed-in user allowed to approve documents of this type at all? */
export function useIsApprover(documentType: ApprovalDocumentType) {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['is-approver', organization?.id, user?.id, documentType],
    queryFn: async () => {
      if (!organization?.id || !user?.id) return false;
      const [admin, designated] = await Promise.all([
        isOrgAdmin(organization.id, user.id),
        isDesignatedApprover(organization.id, user.id, documentType),
      ]);
      return admin || designated;
    },
    enabled: !!organization?.id && !!user?.id,
  });
}

/** Live approval request state for a single document. */
export function useApprovalRequest(documentType: ApprovalDocumentType, documentId?: string | null) {
  return useQuery({
    queryKey: ['approval-request', documentType, documentId],
    queryFn: async () => (documentId ? getApprovalRequest(documentType, documentId) : null),
    enabled: !!documentId,
  });
}

const STATUS_COLUMN: Record<
  ApprovalDocumentType,
  { table: string; statusField: string; lifecycleField?: string }
> = {
  // Bills track the approval workflow separately from the lifecycle badge, so
  // both columns have to move together or an approved bill still reads "Draft".
  bill: { table: 'bills', statusField: 'approval_status', lifecycleField: 'status' },
  expense: { table: 'expenses', statusField: 'approval_status' },
  expense_claim: { table: 'expense_claims', statusField: 'status' },
};

/** Lifecycle statuses that an approval is allowed to advance to "approved". */
const ADVANCEABLE_LIFECYCLE = ['draft', 'pending', 'pending_approval'];

/** Approve (and post to the GL) or reject a purchase document. */
export function useApprovalActions() {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();

  const invalidate = () => {
    ['bills', 'expenses', 'expense_claims', 'journal-entries', 'journal_entries', 'accounts',
      'approval-request', 'pending-approvals'].forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    );
  };

  const approveAndPost = useMutation({
    mutationFn: async ({ doc, comments }: { doc: ApprovableDocument; comments?: string }) => {
      if (!organization?.id || !user?.id) throw new Error('No organization or user');

      const request = await getApprovalRequest(doc.documentType, doc.id);
      const eligibility = await canApprove({
        organizationId: organization.id,
        userId: user.id,
        documentType: doc.documentType,
        preparedBy: doc.preparedBy,
        request,
      });
      if (!eligibility.allowed) throw new Error(eligibility.reason || 'Not authorised to approve');

      const outcome = await approveStep({
        organizationId: organization.id,
        documentType: doc.documentType,
        documentId: doc.id,
        userId: user.id,
        amount: doc.amount,
        requestedBy: doc.preparedBy || user.id,
        comments,
      });

      if (outcome.status !== 'approved') return outcome;

      const journalEntryId = await postApprovedDocument(doc.documentType, organization.id, doc.id);

      const { table, statusField, lifecycleField } = STATUS_COLUMN[doc.documentType];
      const update: Record<string, any> = {
        [statusField]: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        posted_at: new Date().toISOString(),
      };
      let query = supabase.from(table as any).update(update).eq('id', doc.id);

      if (lifecycleField) {
        // Advance the lifecycle badge too, but never regress a bill that is
        // already paid/partially paid/void.
        await supabase
          .from(table as any)
          .update({ ...update, [lifecycleField]: 'approved' })
          .eq('id', doc.id)
          .in(lifecycleField, ADVANCEABLE_LIFECYCLE);
        // Ensure approval columns land even when the lifecycle guard filtered the row out.
        query = supabase.from(table as any).update(update).eq('id', doc.id);
      }

      await query;

      return { ...outcome, journalEntryId };
    },
    onSuccess: (outcome: any) => {
      invalidate();
      if (outcome?.status === 'approved') {
        toast.success('Approved and posted to the General Ledger');
      } else {
        toast.success(`Approved — routed to step ${outcome?.nextStep} for the next approver`);
      }
    },
    onError: (error: any) => toast.error(error.message || 'Approval failed'),
  });

  const reject = useMutation({
    mutationFn: async ({
      doc,
      comments,
      action = 'rejected',
    }: {
      doc: ApprovableDocument;
      comments?: string;
      action?: 'rejected' | 'returned';
    }) => {
      if (!organization?.id || !user?.id) throw new Error('No organization or user');

      const request = await getApprovalRequest(doc.documentType, doc.id);
      const eligibility = await canApprove({
        organizationId: organization.id,
        userId: user.id,
        documentType: doc.documentType,
        preparedBy: doc.preparedBy,
        request,
      });
      if (!eligibility.allowed) throw new Error(eligibility.reason || 'Not authorised to approve');

      await rejectStep({
        organizationId: organization.id,
        documentType: doc.documentType,
        documentId: doc.id,
        userId: user.id,
        amount: doc.amount,
        requestedBy: doc.preparedBy || user.id,
        action,
        comments,
      });

      const { table, statusField } = STATUS_COLUMN[doc.documentType];
      await supabase
        .from(table as any)
        .update({ [statusField]: action === 'returned' ? 'draft' : 'rejected' })
        .eq('id', doc.id);
    },
    onSuccess: (_d, vars) => {
      invalidate();
      toast.success(vars.action === 'returned' ? 'Returned to the preparer' : 'Document rejected');
    },
    onError: (error: any) => toast.error(error.message || 'Action failed'),
  });

  const submitForApproval = useMutation({
    mutationFn: async (doc: ApprovableDocument) => {
      if (!organization?.id || !user?.id) throw new Error('No organization or user');
      return requestApproval({
        organizationId: organization.id,
        documentType: doc.documentType,
        documentId: doc.id,
        requestedBy: doc.preparedBy || user.id,
        amount: doc.amount,
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success('Submitted for approval');
    },
    onError: (error: any) => toast.error(error.message || 'Submission failed'),
  });

  return { approveAndPost, reject, submitForApproval };
}

/** Everything currently waiting on approval across the purchases module. */
export function usePendingApprovals() {
  const { organization } = useCurrentOrganization();

  return useQuery({
    queryKey: ['pending-approvals', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];

      const [bills, expenses, claims] = await Promise.all([
        supabase
          .from('bills')
          .select('id, bill_number, bill_date, total, approval_status, prepared_by, created_by, vendor:vendors(name)')
          .eq('organization_id', organization.id)
          .eq('approval_status', 'pending_approval'),
        supabase
          .from('expenses')
          .select('id, expense_date, amount, tax_amount, approval_status, created_by, reference, notes')
          .eq('organization_id', organization.id)
          .eq('approval_status', 'pending_approval'),
        supabase
          .from('expense_claims')
          .select('id, claim_number, claim_date, total_amount, status, prepared_by, employee:employees(first_name, last_name)')
          .eq('organization_id', organization.id)
          .eq('status', 'submitted'),
      ]);

      const rows = [
        ...((bills.data || []) as any[]).map((b) => ({
          id: b.id,
          documentType: 'bill' as ApprovalDocumentType,
          label: `Bill ${b.bill_number}`,
          party: b.vendor?.name || '—',
          date: b.bill_date,
          amount: Number(b.total) || 0,
          preparedBy: b.prepared_by || b.created_by || null,
        })),
        ...((expenses.data || []) as any[]).map((e) => ({
          id: e.id,
          documentType: 'expense' as ApprovalDocumentType,
          label: e.reference ? `Expense ${e.reference}` : 'Direct expense',
          party: e.notes || '—',
          date: e.expense_date,
          amount: (Number(e.amount) || 0) + (Number(e.tax_amount) || 0),
          preparedBy: e.created_by || null,
        })),
        ...((claims.data || []) as any[]).map((c) => ({
          id: c.id,
          documentType: 'expense_claim' as ApprovalDocumentType,
          label: `Claim ${c.claim_number}`,
          party: c.employee ? `${c.employee.first_name} ${c.employee.last_name}` : '—',
          date: c.claim_date,
          amount: Number(c.total_amount) || 0,
          preparedBy: c.prepared_by || null,
        })),
      ];

      return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
    },
    enabled: !!organization?.id,
  });
}
