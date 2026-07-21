import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, UserPlus, Loader2, Mail, Clock, X, XCircle, ShieldCheck, Users } from 'lucide-react';
import { BulkInviteDialog } from './BulkInviteDialog';
import { getModulesForRole, ROLE_MODULE_DESCRIPTIONS, MODULE_DISPLAY_NAMES, OrgRole } from '@/config/roleModuleAccess';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuditLog, AuditActions } from '@/hooks/useAuditLog';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionUpgradeModal } from '@/components/SubscriptionUpgradeModal';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface OrganizationMember {
  member_id: string;
  user_id: string;
  role: string;
  display_name: string | null;
  joined_at: string | null;
  created_at: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface OrganizationInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  expires_at: string;
}

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'finance_manager', label: 'Finance Manager' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'payroll_officer', label: 'Payroll Officer' },
  { value: 'auditor', label: 'Auditor (Read-only)' },
  { value: 'member', label: 'Member' },
];

export function UsersSettingsTab() {
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [editMember, setEditMember] = useState<OrganizationMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<OrganizationMember | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('accountant');
  const [editRole, setEditRole] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');

  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { hasPermission } = usePermissions();
  const { logEvent } = useAuditLog();
  const queryClient = useQueryClient();
  const { canAddUser, userCount, maxUsers } = useUsageLimits();
  const { planTier, isActive } = useSubscription();

  // Permission checks for UI rendering
  const canInviteUsers = hasPermission('USER_INVITE');
  const canManageUsers = hasPermission('USER_MANAGE');

  const handleInviteClick = () => {
    if (!isActive || !canAddUser) {
      setUpgradeOpen(true);
      return;
    }
    setInviteOpen(true);
  };

  // Fetch organization members using RPC function
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['organization-members', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .rpc('get_org_member_details', { p_organization_id: organization.id });
      
      if (error) {
        console.error('Error fetching members:', error);
        throw error;
      }
      
      return (data || []) as OrganizationMember[];
    },
    enabled: !!organization?.id,
  });

  // Fetch all invitations (pending, accepted, expired)
  const { data: invitations, isLoading: invitationsLoading } = useQuery({
    queryKey: ['organization-invitations', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as OrganizationInvitation[];
    },
    enabled: !!organization?.id,
  });

  // Update member role and display name
  const updateMemberMutation = useMutation({
    mutationFn: async ({ memberId, newRole, displayName, oldRole }: { 
      memberId: string; 
      newRole: string; 
      displayName: string;
      oldRole?: string;
    }) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ 
          role: newRole,
          display_name: displayName || null 
        })
        .eq('id', memberId);
      
      if (error) throw error;
      
      // Log the role change if role actually changed
      if (oldRole && oldRole !== newRole) {
        await logEvent(
          AuditActions.USER_ROLE_CHANGED,
          'organization_member',
          memberId,
          { role: oldRole },
          { role: newRole }
        );
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', organization?.id] });
      queryClient.invalidateQueries({ queryKey: ['user-org-role-modules'] });
      queryClient.invalidateQueries({ queryKey: ['user-org-role'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      const roleLabel = ROLE_OPTIONS.find(r => r.value === variables.newRole)?.label || variables.newRole;
      toast.success(`Role updated to ${roleLabel}. Changes take effect on the member's next page load.`);
      setEditMember(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update member: ${error.message}`);
    },
  });

  // Remove member
  const removeMemberMutation = useMutation({
    mutationFn: async ({ memberId, memberEmail, memberRole }: { 
      memberId: string; 
      memberEmail?: string;
      memberRole?: string;
    }) => {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);
      
      if (error) throw error;
      
      // Log the removal
      await logEvent(
        AuditActions.USER_REMOVED,
        'organization_member',
        memberId,
        { email: memberEmail, role: memberRole },
        null
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', organization?.id] });
      toast.success('Member removed from organization');
      setDeleteMember(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove member: ${error.message}`);
    },
  });

  // Invite user via edge function
  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('send-invitation', {
        body: {
          email,
          role,
          organizationId: organization?.id,
          organizationName: organization?.name,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send invitation');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invitations', organization?.id] });
      toast.success('Invitation sent successfully');
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('accountant');
    },
    onError: (error: Error) => {
      // Provide helpful messages for common issues
      if (error.message.includes('already a team member') || error.message.includes('ALREADY_MEMBER')) {
        toast.info('This person is already a team member. You can update their role from the list above.');
      } else if (error.message.includes('Sender Identity') || error.message.includes('verified')) {
        toast.error('Email service configuration issue: The sender address needs to be verified. Contact your administrator.');
      } else if (error.message.includes('pending')) {
        toast.info('An invitation is already pending for this email. You can resend it from the pending invitations section.');
      } else {
        toast.error(error.message || 'Failed to send invitation. Please try again.');
      }
    },
  });

  // Cancel invitation
  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('organization_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invitations', organization?.id] });
      toast.success('Invitation cancelled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel invitation: ${error.message}`);
    },
  });

  // Cancel all pending invitations
  const cancelAllInvitationsMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error('No organization');
      const { error } = await supabase
        .from('organization_invitations')
        .update({ status: 'cancelled' })
        .eq('organization_id', organization.id)
        .eq('status', 'pending');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invitations', organization?.id] });
      toast.success('All pending invitations cancelled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel invitations: ${error.message}`);
    },
  });

  // Delete invitation
  const deleteInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('organization_invitations')
        .delete()
        .eq('id', invitationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invitations', organization?.id] });
      toast.success('Invitation deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete invitation: ${error.message}`);
    },
  });

  // Resend invitation
  const resendInvitationMutation = useMutation({
    mutationFn: async (invitation: OrganizationInvitation) => {
      // First cancel the old invitation
      await supabase
        .from('organization_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitation.id);

      // Then create a new one
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('send-invitation', {
        body: {
          email: invitation.email,
          role: invitation.role,
          organizationId: organization?.id,
          organizationName: organization?.name,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to resend invitation');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invitations', organization?.id] });
      toast.success('Invitation resent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to resend invitation');
    },
  });

  const handleEditClick = (member: OrganizationMember) => {
    setEditMember(member);
    setEditRole(member.role);
    setEditDisplayName(member.display_name || member.full_name || '');
  };

  const handleSaveMember = () => {
    if (editMember && editRole) {
      updateMemberMutation.mutate({ 
        memberId: editMember.member_id, 
        newRole: editRole,
        displayName: editDisplayName,
        oldRole: editMember.role,
      });
    }
  };

  const handleConfirmDelete = () => {
    if (deleteMember) {
      removeMemberMutation.mutate({
        memberId: deleteMember.member_id,
        memberEmail: deleteMember.email || undefined,
        memberRole: deleteMember.role,
      });
    }
  };

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return email?.slice(0, 2).toUpperCase() || 'U';
  };

  const getRoleLabel = (role: string) => {
    return ROLE_OPTIONS.find(r => r.value === role)?.label || role;
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (orgLoading) {
    return <Skeleton className="h-[300px]" />;
  }

  if (!organization) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-lg font-semibold text-foreground mb-2">No Organization Found</h2>
        <p className="text-muted-foreground mb-4">Create an organization to manage users.</p>
        <Button onClick={() => setCreateOrgOpen(true)}>Create Organization</Button>
        <CreateOrganizationDialog open={createOrgOpen} onOpenChange={setCreateOrgOpen} />
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Team Members</h2>
          {canInviteUsers && (
            <Button onClick={handleInviteClick}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </Button>
          )}
        </div>
        <SubscriptionUpgradeModal
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          currentPlanTier={planTier ?? 'starter'}
          reason={!isActive ? 'no_subscription' : 'limit_users'}
          currentCount={userCount}
          currentMax={maxUsers}
        />

        {membersLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : members && members.length > 0 ? (
          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.member_id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {getInitials(member.full_name || null, member.email)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {member.display_name || member.full_name || 'Unknown User'}
                    </p>
                    <p className="text-sm text-muted-foreground">{member.email || 'No email'}</p>
                    {member.joined_at && (
                      <p className="text-xs text-muted-foreground">
                        Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground px-3 py-1 rounded-full bg-muted">
                    {getRoleLabel(member.role)}
                  </span>
                  {canManageUsers && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleEditClick(member)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {canManageUsers && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteMember(member)}
                      disabled={member.role === 'owner'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No team members found. Invite users to get started.
          </div>
        )}
      </Card>

      {/* Invitations */}
      {!invitationsLoading && invitations && invitations.length > 0 && (
        <Card className="p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Invitations</h2>
            {invitations.some(i => i.status === 'pending') && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => cancelAllInvitationsMutation.mutate()}
                disabled={cancelAllInvitationsMutation.isPending}
              >
                {cancelAllInvitationsMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <XCircle className="w-3 h-3 mr-1" />
                )}
                Cancel All Pending
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {invitations.map((invitation) => {
              const expired = isExpired(invitation.expires_at);
              return (
                <div key={invitation.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-warning/10">
                      <Mail className="w-4 h-4 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{invitation.email}</p>
                       <div className="flex items-center gap-2 text-sm text-muted-foreground">
                         {expired ? (
                           <>
                             <Clock className="w-3 h-3" />
                             <span className="text-destructive">Expired</span>
                           </>
                         ) : (
                           <>
                             <Clock className="w-3 h-3" />
                             <span>Pending · Expires {format(new Date(invitation.expires_at), 'MMM d, yyyy')}</span>
                           </>
                         )}
                       </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">Pending</Badge>
                    <Badge variant="outline">{getRoleLabel(invitation.role)}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resendInvitationMutation.mutate(invitation)}
                      disabled={resendInvitationMutation.isPending}
                    >
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                      disabled={cancelInvitationMutation.isPending}
                      title="Cancel invitation"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteInvitationMutation.mutate(invitation.id)}
                      disabled={deleteInvitationMutation.isPending}
                      title="Delete invitation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Invite User Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to add a new team member to your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.filter(r => r.value !== 'owner').map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_MODULE_DESCRIPTIONS[inviteRole as OrgRole] || ''}
              </p>
            </div>

            {/* Module Access Preview */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">Module Access</Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {getModulesForRole(inviteRole).map((mod) => (
                  <Badge key={mod} variant="secondary" className="text-xs">
                    {MODULE_DISPLAY_NAMES[mod]}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
              disabled={!inviteEmail || inviteMutation.isPending}
            >
              {inviteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={!!editMember} onOpenChange={(open) => !open && setEditMember(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update details for {editMember?.full_name || editMember?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Enter display name"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                This name will be shown instead of their profile name within this organization.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem 
                      key={role.value} 
                      value={role.value}
                      disabled={role.value === 'owner' && editMember?.role !== 'owner'}
                    >
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_MODULE_DESCRIPTIONS[editRole as OrgRole] || ''}
              </p>
            </div>

            {/* Module Access Preview */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">Module Access for this Role</Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {getModulesForRole(editRole).map((mod) => (
                  <Badge key={mod} variant="secondary" className="text-xs">
                    {MODULE_DISPLAY_NAMES[mod]}
                  </Badge>
                ))}
              </div>
              {editRole === 'auditor' && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  ⚠ Auditor has read-only access — cannot create, edit, or delete any records.
                </p>
              )}
            </div>

            {editMember?.email && (
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editMember.email} disabled className="bg-muted" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveMember}
              disabled={updateMemberMutation.isPending}
            >
              {updateMemberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteMember} onOpenChange={(open) => !open && setDeleteMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {deleteMember?.full_name || deleteMember?.email} from this organization? They will lose access to all organization data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMemberMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
