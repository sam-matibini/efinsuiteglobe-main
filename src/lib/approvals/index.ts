import { supabase } from '@/integrations/supabase/client';

export type ApprovalDocumentType = 'bill' | 'expense_claim' | 'expense';

export const APPROVAL_DOCUMENT_LABELS: Record<ApprovalDocumentType, string> = {
  bill: 'Bill',
  expense_claim: 'Expense Claim',
  expense: 'Direct Expense',
};

export interface WorkflowStep {
  id: string;
  step_order: number;
  approver_type: string;
  approver_id: string | null;
  min_amount: number | null;
  max_amount: number | null;
  requires_all: boolean;
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  document_type: string;
  is_active: boolean;
  steps: WorkflowStep[];
}

export interface ApprovalRequestRow {
  id: string;
  organization_id: string | null;
  document_type: string;
  document_id: string;
  workflow_id: string | null;
  current_step: number;
  status: string;
  requested_by: string;
  requested_at: string;
  completed_at: string | null;
}

/** Resolve the active workflow (if any) for a document type + amount. */
export async function getActiveWorkflow(
  organizationId: string,
  documentType: ApprovalDocumentType,
  amount: number,
): Promise<ApprovalWorkflow | null> {
  const { data: workflows, error } = await supabase
    .from('approval_workflows')
    .select('id, name, document_type, is_active, approval_workflow_steps(*)')
    .eq('organization_id', organizationId)
    .eq('document_type', documentType)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error || !workflows?.length) return null;

  for (const wf of workflows) {
    const steps = ((wf as any).approval_workflow_steps || [])
      .filter((s: WorkflowStep) => {
        const min = s.min_amount == null ? -Infinity : Number(s.min_amount);
        const max = s.max_amount == null ? Infinity : Number(s.max_amount);
        return amount >= min && amount <= max;
      })
      .sort((a: WorkflowStep, b: WorkflowStep) => a.step_order - b.step_order);

    if (steps.length > 0) {
      return {
        id: wf.id,
        name: wf.name,
        document_type: wf.document_type,
        is_active: wf.is_active,
        steps,
      };
    }
  }
  return null;
}

/** True when the user is an owner/admin of the organization. */
export async function isOrgAdmin(organizationId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();
  const role = (data as any)?.role;
  return role === 'owner' || role === 'admin';
}

/** True when the user is on the designated approver list for this document type. */
export async function isDesignatedApprover(
  organizationId: string,
  userId: string,
  documentType: ApprovalDocumentType,
): Promise<boolean> {
  const { data } = await supabase
    .from('document_approvers')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .in('document_type', ['all', documentType])
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export interface CanApproveResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Segregation of duties: the preparer can never approve their own document.
 * Otherwise the user must be an org owner/admin, a designated approver, or the
 * named approver on the current workflow step.
 */
export async function canApprove(params: {
  organizationId: string;
  userId: string;
  documentType: ApprovalDocumentType;
  preparedBy?: string | null;
  request?: ApprovalRequestRow | null;
}): Promise<CanApproveResult> {
  const { organizationId, userId, documentType, preparedBy, request } = params;

  if (preparedBy && preparedBy === userId) {
    return {
      allowed: false,
      reason: 'Segregation of duties — the preparer cannot approve their own document.',
    };
  }

  // Named approver on the current step wins.
  if (request?.workflow_id) {
    const { data: steps } = await supabase
      .from('approval_workflow_steps')
      .select('*')
      .eq('workflow_id', request.workflow_id)
      .eq('step_order', request.current_step);

    const step = (steps || [])[0] as WorkflowStep | undefined;
    if (step && step.approver_type === 'user') {
      return step.approver_id === userId
        ? { allowed: true }
        : { allowed: false, reason: 'This step is assigned to another approver.' };
    }
  }

  const [admin, designated] = await Promise.all([
    isOrgAdmin(organizationId, userId),
    isDesignatedApprover(organizationId, userId, documentType),
  ]);

  if (admin || designated) return { allowed: true };
  return { allowed: false, reason: 'You are not an approver for this document type.' };
}

/** Fetch the open approval request for a document, if one exists. */
export async function getApprovalRequest(
  documentType: ApprovalDocumentType,
  documentId: string,
): Promise<ApprovalRequestRow | null> {
  const { data } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('document_type', documentType)
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ApprovalRequestRow) || null;
}

/** Create (or reuse) an approval request for a freshly prepared document. */
export async function requestApproval(params: {
  organizationId: string;
  documentType: ApprovalDocumentType;
  documentId: string;
  requestedBy: string;
  amount: number;
}): Promise<ApprovalRequestRow> {
  const { organizationId, documentType, documentId, requestedBy, amount } = params;

  const existing = await getApprovalRequest(documentType, documentId);
  if (existing && existing.status === 'pending') return existing;

  const workflow = await getActiveWorkflow(organizationId, documentType, amount);

  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      organization_id: organizationId,
      document_type: documentType,
      document_id: documentId,
      workflow_id: workflow?.id ?? null,
      current_step: workflow?.steps[0]?.step_order ?? 1,
      status: 'pending',
      requested_by: requestedBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ApprovalRequestRow;
}

async function recordAction(params: {
  requestId: string;
  stepOrder: number;
  userId: string;
  action: 'approved' | 'rejected' | 'returned';
  comments?: string;
}) {
  const { error } = await supabase.from('approval_actions').insert({
    approval_request_id: params.requestId,
    step_order: params.stepOrder,
    action_by: params.userId,
    action: params.action,
    comments: params.comments ?? null,
  });
  if (error) throw error;
}

export interface ApprovalOutcome {
  /** 'approved' means every step is complete and the document may post. */
  status: 'approved' | 'pending' | 'rejected' | 'returned';
  nextStep?: number;
  totalSteps?: number;
}

/** Record an approval on the current step and advance the workflow. */
export async function approveStep(params: {
  organizationId: string;
  documentType: ApprovalDocumentType;
  documentId: string;
  userId: string;
  amount: number;
  requestedBy: string;
  comments?: string;
}): Promise<ApprovalOutcome> {
  const { organizationId, documentType, documentId, userId, amount, requestedBy, comments } = params;

  const request =
    (await getApprovalRequest(documentType, documentId)) ??
    (await requestApproval({ organizationId, documentType, documentId, requestedBy, amount }));

  await recordAction({
    requestId: request.id,
    stepOrder: request.current_step,
    userId,
    action: 'approved',
    comments,
  });

  const workflow = request.workflow_id
    ? await getActiveWorkflow(organizationId, documentType, amount)
    : null;
  const steps = workflow?.steps ?? [];
  const nextStep = steps.find((s) => s.step_order > request.current_step);

  if (nextStep) {
    await supabase
      .from('approval_requests')
      .update({ current_step: nextStep.step_order })
      .eq('id', request.id);
    return { status: 'pending', nextStep: nextStep.step_order, totalSteps: steps.length };
  }

  await supabase
    .from('approval_requests')
    .update({ status: 'approved', completed_at: new Date().toISOString() })
    .eq('id', request.id);

  return { status: 'approved', totalSteps: steps.length || 1 };
}

/** Reject or return a document for correction. */
export async function rejectStep(params: {
  organizationId: string;
  documentType: ApprovalDocumentType;
  documentId: string;
  userId: string;
  amount: number;
  requestedBy: string;
  action?: 'rejected' | 'returned';
  comments?: string;
}): Promise<ApprovalOutcome> {
  const action = params.action ?? 'rejected';
  const request =
    (await getApprovalRequest(params.documentType, params.documentId)) ??
    (await requestApproval({
      organizationId: params.organizationId,
      documentType: params.documentType,
      documentId: params.documentId,
      requestedBy: params.requestedBy,
      amount: params.amount,
    }));

  await recordAction({
    requestId: request.id,
    stepOrder: request.current_step,
    userId: params.userId,
    action,
    comments: params.comments,
  });

  await supabase
    .from('approval_requests')
    .update({ status: action, completed_at: new Date().toISOString() })
    .eq('id', request.id);

  return { status: action };
}
