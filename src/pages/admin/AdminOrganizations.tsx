import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Search, Building2, Users, Eye, Trash2, Plus, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';

interface Organization {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string | null;
  created_at: string;
  member_count?: number;
  subscription_status?: string;
}

interface CreateOrgForm {
  name: string;
  slug: string;
  ownerEmail: string;
  industry: string;
  notes: string;
}

export default function AdminOrganizations() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateOrgForm>({
    name: '',
    slug: '',
    ownerEmail: '',
    industry: '',
    notes: '',
  });

  const { data: organizations, isLoading } = useQuery({
    queryKey: ['admin-organizations'],
    queryFn: async () => {
      const { data: orgs, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch member counts
      const { data: members } = await supabase
        .from('organization_members')
        .select('organization_id');

      const memberCounts: Record<string, number> = {};
      members?.forEach(m => {
        memberCounts[m.organization_id] = (memberCounts[m.organization_id] || 0) + 1;
      });

      // Fetch subscription statuses
      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('organization_id, status');

      const subStatus: Record<string, string> = {};
      subscriptions?.forEach(s => {
        subStatus[s.organization_id] = s.status;
      });

      return orgs.map(org => ({
        ...org,
        member_count: memberCounts[org.id] || 0,
        subscription_status: subStatus[org.id] || 'none',
      })) as Organization[];
    },
    enabled: isAdmin,
  });

  const deleteOrg = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Organization deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const createOrg = useMutation({
    mutationFn: async (form: CreateOrgForm) => {
      // Find user by email if provided
      let ownerId: string | null = null;
      if (form.ownerEmail) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('email', form.ownerEmail)
          .single();
        
        if (profile) {
          ownerId = profile.user_id;
        }
      }

      // Create the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: form.name,
          slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
          owner_id: ownerId,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add owner as member if found
      if (ownerId) {
        await supabase
          .from('organization_members')
          .insert({
            organization_id: org.id,
            user_id: ownerId,
            role: 'owner',
          });
      }

      return org;
    },
    onSuccess: () => {
      toast.success('Organization created successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      setCreateDialogOpen(false);
      setCreateForm({ name: '', slug: '', ownerEmail: '', industry: '', notes: '' });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create organization: ${error.message}`);
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

  const filteredOrgs = organizations?.filter(org =>
    org.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/20 text-success border-success/30">Active</Badge>;
      case 'trialing':
        return <Badge className="bg-accent/20 text-accent border-accent/30">Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Past Due</Badge>;
      case 'canceled':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Canceled</Badge>;
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
          <p className="text-muted-foreground">Manage all organizations on the platform</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="bg-accent hover:bg-accent/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Organization
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations?.filter(o => o.subscription_status === 'active').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations?.reduce((sum, o) => sum + (o.member_count || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Organizations</CardTitle>
              <CardDescription>View and manage organizations</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
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
                <TableHead>Slug</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Created</TableHead>
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
              ) : filteredOrgs.length > 0 ? (
                filteredOrgs.map(org => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {org.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{org.slug || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        {org.member_count}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(org.subscription_status || 'none')}</TableCell>
                    <TableCell>{format(new Date(org.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedOrg(org);
                            setDetailsDialogOpen(true);
                          }}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/admin/organizations/${org.id}/modules`)}>
                            <Package className="w-4 h-4 mr-2" />
                            Manage Modules
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setOrgToDelete(org);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No organizations found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Organization Details</DialogTitle>
            <DialogDescription>
              Detailed information about {selectedOrg?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedOrg && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Name</label>
                  <p className="font-medium">{selectedOrg.name}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Slug</label>
                  <p className="font-medium">{selectedOrg.slug || '-'}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Members</label>
                  <p className="font-medium">{selectedOrg.member_count}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Subscription</label>
                  <p>{getStatusBadge(selectedOrg.subscription_status || 'none')}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Created</label>
                  <p className="font-medium">{format(new Date(selectedOrg.created_at), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">ID</label>
                  <p className="font-mono text-xs">{selectedOrg.id}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{orgToDelete?.name}</strong>? This action cannot be undone and will remove all associated data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (orgToDelete) {
                  deleteOrg.mutate(orgToDelete.id);
                  setDeleteDialogOpen(false);
                  setOrgToDelete(null);
                }
              }}
              disabled={deleteOrg.isPending}
            >
              {deleteOrg.isPending ? 'Deleting...' : 'Delete Organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Organization Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Manually onboard a new organization to the platform
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name *</Label>
              <Input
                id="org-name"
                placeholder="Enter organization name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">Slug (URL-friendly identifier)</Label>
              <Input
                id="org-slug"
                placeholder="auto-generated-from-name"
                value={createForm.slug}
                onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-generate from name
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner-email">Owner Email (optional)</Label>
              <Input
                id="owner-email"
                type="email"
                placeholder="owner@example.com"
                value={createForm.ownerEmail}
                onChange={(e) => setCreateForm({ ...createForm, ownerEmail: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                If provided and user exists, they will be assigned as owner
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={createForm.industry}
                onValueChange={(value) => setCreateForm({ ...createForm, industry: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="professional_services">Professional Services</SelectItem>
                  <SelectItem value="fintech">Fintech</SelectItem>
                  <SelectItem value="npo">Non-Profit</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="transportation_logistics">Transportation & Logistics</SelectItem>
                  <SelectItem value="automotive_repairs">Automotive Repairs</SelectItem>
                  <SelectItem value="car_dealers">Car Dealers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Internal Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any notes about this organization..."
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createOrg.mutate(createForm)}
              disabled={!createForm.name || createOrg.isPending}
              className="bg-accent hover:bg-accent/90"
            >
              {createOrg.isPending ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
