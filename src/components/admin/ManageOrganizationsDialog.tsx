import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, Check, X, Trash2 } from 'lucide-react';
import {
  OrgRole,
  ROLE_MODULE_ACCESS,
  ROLE_MODULE_DESCRIPTIONS,
  MODULE_DISPLAY_NAMES,
} from '@/config/roleModuleAccess';
import type { ModuleCode } from '@/hooks/useEnabledModules';

const ALL_MODULES = Object.keys(MODULE_DISPLAY_NAMES) as ModuleCode[];

const ORG_ROLES: { value: OrgRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'finance_manager', label: 'Finance Manager' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'payroll_officer', label: 'Payroll Officer' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'member', label: 'Member' },
];

export interface OrgMembership {
  org_id: string;
  org_name: string;
  role: string;
}

interface ManageOrganizationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    user_id: string;
    email: string;
    full_name: string | null;
    orgMemberships?: OrgMembership[];
  } | null;
}

function ModuleAccessPreview({ role }: { role: OrgRole }) {
  const accessibleModules = ROLE_MODULE_ACCESS[role] || [];

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {ROLE_MODULE_DESCRIPTIONS[role]}
      </p>
      <div className="grid grid-cols-2 gap-1">
        {ALL_MODULES.map((mod) => {
          const hasAccess = accessibleModules.includes(mod);
          return (
            <div key={mod} className="flex items-center gap-1.5 text-xs">
              {hasAccess ? (
                <Check className="h-3 w-3 text-success shrink-0" />
              ) : (
                <X className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              )}
              <span className={hasAccess ? 'text-foreground' : 'text-muted-foreground/50'}>
                {MODULE_DISPLAY_NAMES[mod]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ManageOrganizationsDialog({
  open,
  onOpenChange,
  user,
}: ManageOrganizationsDialogProps) {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedRole, setSelectedRole] = useState<OrgRole>('member');

  const { data: allOrgs } = useQuery({
    queryKey: ['all-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const addMembership = useMutation({
    mutationFn: async ({ userId, orgId, role }: { userId: string; orgId: string; role: string }) => {
      const { error } = await supabase
        .from('organization_members')
        .insert({ user_id: userId, organization_id: orgId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('User added to organization');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setSelectedOrgId('');
      setSelectedRole('member');
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const removeMembership = useMutation({
    mutationFn: async ({ userId, orgId }: { userId: string; orgId: string }) => {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('user_id', userId)
        .eq('organization_id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Membership removed');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, orgId, role }: { userId: string; orgId: string; role: string }) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ role })
        .eq('user_id', userId)
        .eq('organization_id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  });

  if (!user) return null;

  const memberships = user.orgMemberships || [];
  const memberOrgIds = new Set(memberships.map((m) => m.org_id));
  const availableOrgs = allOrgs?.filter((o) => !memberOrgIds.has(o.id)) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Manage Organizations
          </DialogTitle>
          <DialogDescription>
            Assign {user.full_name || user.email} to organizations and set their role & module access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Current Memberships */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Memberships</label>
            {memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not a member of any organization.</p>
            ) : (
              <div className="space-y-3">
                {memberships.map((m) => (
                  <div key={m.org_id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{m.org_name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeMembership.mutate({ userId: user.user_id, orgId: m.org_id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        updateRole.mutate({ userId: user.user_id, orgId: m.org_id, role: v })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORG_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ModuleAccessPreview role={m.role as OrgRole} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add to Organization */}
          {availableOrgs.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <label className="text-sm font-medium">Add to Organization</label>
              <div className="flex gap-2">
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select organization..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOrgs.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as OrgRole)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!selectedOrgId || addMembership.isPending}
                  onClick={() =>
                    addMembership.mutate({
                      userId: user.user_id,
                      orgId: selectedOrgId,
                      role: selectedRole,
                    })
                  }
                >
                  Add
                </Button>
              </div>
              {selectedRole && (
                <ModuleAccessPreview role={selectedRole} />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
