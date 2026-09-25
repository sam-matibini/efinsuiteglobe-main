import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Plus, MoreHorizontal, Trash2, Edit, Users } from 'lucide-react';
import { 
  usePMAllStaff, 
  useDeletePMEngagementStaff,
  PM_STAFF_ROLES,
  PMEngagementStaff,
} from '@/hooks/usePMEngagementStaff';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { AddPMEngagementStaffDialog } from './AddPMEngagementStaffDialog';
import { PMEngagement } from '@/types/practiceManagement';

interface PMEngagementStaffTabProps {
  engagements: PMEngagement[];
  onAddStaff?: () => void;
}

export function PMEngagementStaffTab({ engagements, onAddStaff }: PMEngagementStaffTabProps) {
  const { data: allStaff, isLoading } = usePMAllStaff();
  const deleteStaff = useDeletePMEngagementStaff();
  const { formatWithSymbol } = useCurrencyFormatter();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editStaff, setEditStaff] = useState<PMEngagementStaff | null>(null);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'partner': return 'default';
      case 'manager': return 'secondary';
      case 'senior': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    return PM_STAFF_ROLES.find(r => r.value === role)?.label || role;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteStaff.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Engagement Team</CardTitle>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Team Member
          </Button>
        </CardHeader>
        <CardContent>
          {!allStaff || allStaff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No team members assigned yet</p>
              <p className="text-sm">Add staff members to track engagement assignments and utilization</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allStaff.map((staff: any) => (
                  <TableRow key={staff.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={staff.profile?.avatar_url} />
                          <AvatarFallback>{getInitials(staff.staff_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{staff.staff_name}</div>
                          {staff.staff_email && (
                            <div className="text-xs text-muted-foreground">{staff.staff_email}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(staff.role)}>
                        {getRoleLabel(staff.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {staff.engagement?.engagement_number}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {staff.engagement?.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {staff.engagement?.client?.legal_name || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {staff.billing_rate ? formatWithSymbol(staff.billing_rate) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm">
                        {staff.actual_hours || 0} / {staff.budgeted_hours || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditStaff(staff)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => setDeleteConfirmId(staff.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddPMEngagementStaffDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        engagements={engagements}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this team member from the engagement?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
