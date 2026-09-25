import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, ShieldCheck, Trash2, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { APPROVAL_DOCUMENT_LABELS, type ApprovalDocumentType } from '@/lib/approvals';

const DOC_TYPES: (ApprovalDocumentType | 'all')[] = ['all', 'bill', 'expense_claim', 'expense'];

const docLabel = (t: string) =>
  t === 'all' ? 'All purchase documents' : APPROVAL_DOCUMENT_LABELS[t as ApprovalDocumentType] || t;

export function ApprovalsSettingsTab() {
  const { organization } = useCurrentOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id;

  const [newApprover, setNewApprover] = useState<{ user_id: string; document_type: string }>({
    user_id: '',
    document_type: 'all',
  });
  const [workflowDraft, setWorkflowDraft] = useState({ name: '', document_type: 'bill' });
  const [stepDraft, setStepDraft] = useState<
    Record<string, { approver_id: string; min_amount: string; max_amount: string }>
  >({});

  const { data: members = [] } = useQuery({
    queryKey: ['organization-members', orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_org_member_details', {
        p_organization_id: orgId!,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!orgId,
  });

  const memberName = (userId: string) => {
    const m = members.find((x) => x.user_id === userId);
    return m?.full_name || m?.display_name || m?.email || userId.slice(0, 8);
  };

  const { data: approvers = [] } = useQuery({
    queryKey: ['document-approvers', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_approvers')
        .select('*')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['approval-workflows', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_workflows')
        .select('*, approval_workflow_steps(*)')
        .eq('organization_id', orgId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orgId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['document-approvers', orgId] });
    queryClient.invalidateQueries({ queryKey: ['approval-workflows', orgId] });
    queryClient.invalidateQueries({ queryKey: ['is-approver'] });
  };

  const addApprover = useMutation({
    mutationFn: async () => {
      if (!newApprover.user_id) throw new Error('Select a team member');
      const { error } = await supabase.from('document_approvers').insert({
        organization_id: orgId!,
        user_id: newApprover.user_id,
        document_type: newApprover.document_type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setNewApprover({ user_id: '', document_type: 'all' });
      toast.success('Approver added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeApprover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('document_approvers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Approver removed');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createWorkflow = useMutation({
    mutationFn: async () => {
      if (!workflowDraft.name.trim()) throw new Error('Name the workflow');
      const { error } = await supabase.from('approval_workflows').insert({
        organization_id: orgId!,
        name: workflowDraft.name.trim(),
        document_type: workflowDraft.document_type,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setWorkflowDraft({ name: '', document_type: 'bill' });
      toast.success('Workflow created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleWorkflow = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('approval_workflows')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const deleteWorkflow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('approval_workflows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Workflow deleted');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addStep = useMutation({
    mutationFn: async (workflow: any) => {
      const draft = stepDraft[workflow.id];
      if (!draft?.approver_id) throw new Error('Select an approver for this step');
      const nextOrder =
        Math.max(0, ...(workflow.approval_workflow_steps || []).map((s: any) => s.step_order)) + 1;
      const { error } = await supabase.from('approval_workflow_steps').insert({
        workflow_id: workflow.id,
        step_order: nextOrder,
        approver_type: 'user',
        approver_id: draft.approver_id,
        min_amount: draft.min_amount ? Number(draft.min_amount) : null,
        max_amount: draft.max_amount ? Number(draft.max_amount) : null,
        requires_all: false,
      });
      if (error) throw error;
    },
    onSuccess: (_d, workflow: any) => {
      invalidate();
      setStepDraft((prev) => ({
        ...prev,
        [workflow.id]: { approver_id: '', min_amount: '', max_amount: '' },
      }));
      toast.success('Step added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('approval_workflow_steps').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Designated approvers
          </CardTitle>
          <CardDescription>
            Bills, expense claims and direct expenses stay off the General Ledger until an approver
            approves them. Owners and admins can always approve; add other team members here. A
            preparer can never approve their own document.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <Label>Team member</Label>
              <Select
                value={newApprover.user_id}
                onValueChange={(v) => setNewApprover((p) => ({ ...p, user_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {memberName(m.user_id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px]">
              <Label>Document type</Label>
              <Select
                value={newApprover.document_type}
                onValueChange={(v) => setNewApprover((p) => ({ ...p, document_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {docLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => addApprover.mutate()} disabled={addApprover.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Add approver
            </Button>
          </div>

          <div className="divide-y rounded-md border">
            {approvers.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                No designated approvers yet — only owners and admins can approve.
              </p>
            )}
            {approvers.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{memberName(a.user_id)}</p>
                  <p className="text-xs text-muted-foreground">{docLabel(a.document_type)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeApprover.mutate(a.id)}
                  aria-label="Remove approver"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Approval hierarchies
          </CardTitle>
          <CardDescription>
            Optional multi-step routing. Add steps in order with amount thresholds — each step must
            be approved by its named approver before the document can post.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <Label>Workflow name</Label>
              <Input
                value={workflowDraft.name}
                onChange={(e) => setWorkflowDraft((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Bills over 100,000"
              />
            </div>
            <div className="min-w-[200px]">
              <Label>Applies to</Label>
              <Select
                value={workflowDraft.document_type}
                onValueChange={(v) => setWorkflowDraft((p) => ({ ...p, document_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.filter((t) => t !== 'all').map((t) => (
                    <SelectItem key={t} value={t}>
                      {docLabel(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => createWorkflow.mutate()} disabled={createWorkflow.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Create workflow
            </Button>
          </div>

          {workflows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No workflows yet — a single approval by any designated approver is required.
            </p>
          )}

          {workflows.map((wf) => {
            const steps = [...(wf.approval_workflow_steps || [])].sort(
              (a: any, b: any) => a.step_order - b.step_order,
            );
            const draft = stepDraft[wf.id] || { approver_id: '', min_amount: '', max_amount: '' };
            return (
              <div key={wf.id} className="space-y-3 rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{wf.name}</p>
                    <Badge variant="outline">{docLabel(wf.document_type)}</Badge>
                    <Badge variant={wf.is_active ? 'default' : 'secondary'}>
                      {wf.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleWorkflow.mutate({ id: wf.id, is_active: !wf.is_active })}
                    >
                      {wf.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteWorkflow.mutate(wf.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="divide-y rounded-md border">
                  {steps.length === 0 && (
                    <p className="p-3 text-sm text-muted-foreground">No steps yet.</p>
                  )}
                  {steps.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-3 text-sm">
                      <span>
                        Step {s.step_order} — {memberName(s.approver_id)}
                        {(s.min_amount || s.max_amount) && (
                          <span className="text-muted-foreground">
                            {' '}
                            ({s.min_amount ?? 0} – {s.max_amount ?? '∞'})
                          </span>
                        )}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => deleteStep.mutate(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <Label>Approver</Label>
                    <Select
                      value={draft.approver_id}
                      onValueChange={(v) =>
                        setStepDraft((p) => ({ ...p, [wf.id]: { ...draft, approver_id: v } }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select approver" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {memberName(m.user_id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Label>Min amount</Label>
                    <Input
                      type="number"
                      value={draft.min_amount}
                      onChange={(e) =>
                        setStepDraft((p) => ({
                          ...p,
                          [wf.id]: { ...draft, min_amount: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="w-32">
                    <Label>Max amount</Label>
                    <Input
                      type="number"
                      value={draft.max_amount}
                      onChange={(e) =>
                        setStepDraft((p) => ({
                          ...p,
                          [wf.id]: { ...draft, max_amount: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => addStep.mutate(wf)}>
                    <Plus className="mr-2 h-4 w-4" /> Add step
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
