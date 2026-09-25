import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MoreHorizontal, Search, UserPlus, Shield, ShieldOff, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import ManageOrganizationsDialog, { type OrgMembership } from '@/components/admin/ManageOrganizationsDialog';

interface AddUserForm {
  email: string;
  password: string;
  full_name: string;
  role: 'user' | 'subscriber' | 'moderator' | 'admin';
}

type AppRole = 'admin' | 'moderator' | 'subscriber' | 'user';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles?: AppRole[];
  orgMemberships?: OrgMembership[];
}

export default function AdminUsers() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('user');
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [addUserForm, setAddUserForm] = useState<AddUserForm>({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
  });
  const [orgUser, setOrgUser] = useState<UserProfile | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch roles for each user
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const userRolesMap: Record<string, string[]> = {};
      roles?.forEach(r => {
        if (!userRolesMap[r.user_id]) {
          userRolesMap[r.user_id] = [];
        }
        userRolesMap[r.user_id].push(r.role);
      });

      // Fetch org memberships
      const { data: orgMembers } = await supabase
        .from('organization_members')
        .select('user_id, organization_id, role, organizations(id, name)');

      const userOrgsMap: Record<string, OrgMembership[]> = {};
      orgMembers?.forEach((om: any) => {
        if (!userOrgsMap[om.user_id]) {
          userOrgsMap[om.user_id] = [];
        }
        userOrgsMap[om.user_id].push({
          org_id: om.organization_id,
          org_name: om.organizations?.name || 'Unknown',
          role: om.role,
        });
      });

      return profiles.map(p => ({
        ...p,
        roles: userRolesMap[p.user_id] || ['user'],
        orgMemberships: userOrgsMap[p.user_id] || [],
      })) as UserProfile[];
    },
    enabled: isAdmin,
  });

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'moderator' | 'subscriber' | 'user' }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Role added successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setRoleDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add role: ${error.message}`);
    },
  });

  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'moderator' | 'subscriber' | 'user' }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Role removed successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove role: ${error.message}`);
    },
  });

  const createUser = useMutation({
    mutationFn: async (formData: AddUserForm) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('admin-create-user', {
        body: formData,
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      toast.success('User created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setAddUserDialogOpen(false);
      setAddUserForm({ email: '', password: '', full_name: '', role: 'user' });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create user: ${error.message}`);
    },
  });

  // Note: Admin access is now verified at route level by AdminRoute component
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredUsers = users?.filter(user =>
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Admin</Badge>;
      case 'moderator':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Moderator</Badge>;
      case 'subscriber':
        return <Badge className="bg-success/20 text-success border-success/30">Subscriber</Badge>;
      default:
        return <Badge variant="secondary">User</Badge>;
    }
  };

  const handleAddRole = (user: UserProfile) => {
    setSelectedUser(user);
    setSelectedRole('user');
    setRoleDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage user accounts and roles</p>
        </div>
        <Button onClick={() => setAddUserDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Users</CardTitle>
              <CardDescription>{users?.length || 0} total users</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Organizations</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name || 'No name'}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.map(role => (
                          <span key={role}>{getRoleBadge(role)}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.orgMemberships && user.orgMemberships.length > 0 ? (
                          user.orgMemberships.map((m) => (
                            <Badge key={m.org_id} variant="outline" className="text-xs">
                              <Building2 className="h-3 w-3 mr-1" />
                              {m.org_name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleAddRole(user)}>
                            <Shield className="w-4 h-4 mr-2" />
                            Manage Roles
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setOrgUser(user); setOrgDialogOpen(true); }}>
                            <Building2 className="w-4 h-4 mr-2" />
                            Manage Organizations
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.roles?.includes('admin') && (
                            <DropdownMenuItem
                              onClick={() => removeRole.mutate({ userId: user.user_id, role: 'admin' })}
                              className="text-destructive"
                            >
                              <ShieldOff className="w-4 h-4 mr-2" />
                              Remove Admin
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Management Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage User Roles</DialogTitle>
            <DialogDescription>
              Add or remove roles for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Roles</label>
              <div className="flex flex-wrap gap-2">
                {selectedUser?.roles?.map(role => (
                  <Badge
                    key={role}
                    variant="outline"
                    className="cursor-pointer hover:bg-destructive/10"
                    onClick={() => removeRole.mutate({ userId: selectedUser.user_id, role })}
                  >
                    {role} ×
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Add Role</label>
              <div className="flex gap-2">
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="subscriber">Subscriber</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => {
                    if (selectedUser) {
                      addRole.mutate({ userId: selectedUser.user_id, role: selectedRole });
                    }
                  }}
                  disabled={addRole.isPending}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account with optional role assignment.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createUser.mutate(addUserForm);
            }}
            className="space-y-4 py-4"
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                placeholder="John Doe"
                value={addUserForm.full_name}
                onChange={(e) => setAddUserForm({ ...addUserForm, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={addUserForm.email}
                onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 6 characters"
                value={addUserForm.password}
                onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={addUserForm.role}
                onValueChange={(v) => setAddUserForm({ ...addUserForm, role: v as AddUserForm['role'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="subscriber">Subscriber</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Organizations Dialog */}
      <ManageOrganizationsDialog
        open={orgDialogOpen}
        onOpenChange={setOrgDialogOpen}
        user={orgUser}
      />
    </div>
  );
}
