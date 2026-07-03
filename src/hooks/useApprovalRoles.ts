import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type ApprovalRole = 'preparer' | 'reviewer' | 'approver';

export interface ApprovalRoleRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: ApprovalRole;
  created_at: string;
}

export interface OrgMemberLite {
  user_id: string;
  display_name: string | null;
  role: string;
}

export function useApprovalRoles() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgId = currentOrganization?.id;

  const rolesQuery = useQuery({
    queryKey: ['payment-approval-roles', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_approval_roles' as never)
        .select('*')
        .eq('organization_id', orgId!);
      if (error) throw error;
      return (data ?? []) as unknown as ApprovalRoleRow[];
    },
  });

  const membersQuery = useQuery({
    queryKey: ['org-members-lite', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('user_id, display_name, role')
        .eq('organization_id', orgId!);
      if (error) throw error;
      const members = (data ?? []) as unknown as OrgMemberLite[];
      const userIds = members.map(m => m.user_id);
      if (userIds.length === 0) return members;
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
      const map = new Map((profiles ?? []).map((p: { user_id: string; full_name: string | null; email: string | null }) => [p.user_id, p]));
      return members.map(m => {
        const p = map.get(m.user_id);
        return { ...m, display_name: m.display_name ?? p?.full_name ?? p?.email ?? null };
      });
    },
  });

  const orgQuery = useQuery({
    queryKey: ['org-threshold', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('approval_threshold_amount')
        .eq('id', orgId!)
        .single();
      if (error) throw error;
      return data as { approval_threshold_amount: number };
    },
  });

  const myRoles = (rolesQuery.data ?? []).filter(r => r.user_id === user?.id).map(r => r.role);
  const isPreparer = myRoles.includes('preparer');
  const isReviewer = myRoles.includes('reviewer');
  const isApprover = myRoles.includes('approver');

  const toggleRole = useMutation({
    mutationFn: async ({ user_id, role, enabled }: { user_id: string; role: ApprovalRole; enabled: boolean }) => {
      if (!orgId) throw new Error('No organization');
      if (enabled) {
        const { error } = await (supabase as any).from('payment_approval_roles')
          .insert({ organization_id: orgId, user_id, role, created_by: user?.id });
        if (error && !String(error.message).includes('duplicate')) throw error;
      } else {
        const { error } = await (supabase as any).from('payment_approval_roles')
          .delete().eq('organization_id', orgId).eq('user_id', user_id).eq('role', role);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-approval-roles'] });
      toast.success('Role updated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  const setThreshold = useMutation({
    mutationFn: async (amount: number) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('organizations')
        .update({ approval_threshold_amount: amount } as never)
        .eq('id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-threshold'] });
      toast.success('Approval threshold updated');
    },
    onError: (e: Error) => toast.error(`Failed: ${e.message}`),
  });

  return {
    roles: rolesQuery.data ?? [],
    members: membersQuery.data ?? [],
    threshold: orgQuery.data?.approval_threshold_amount ?? 5000,
    isLoading: rolesQuery.isLoading || membersQuery.isLoading,
    isPreparer,
    isReviewer,
    isApprover,
    toggleRole,
    setThreshold,
  };
}

export function hasRole(roles: ApprovalRoleRow[], userId: string | undefined, role: ApprovalRole) {
  if (!userId) return false;
  return roles.some(r => r.user_id === userId && r.role === role);
}
