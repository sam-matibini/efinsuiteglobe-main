import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  MoreHorizontal,
  Send,
  Calendar,
  User,
  Filter,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn, parseLocalDate } from '@/lib/utils';
import { format } from 'date-fns';
import { useTimesheets, TimesheetStatus, TimesheetWithEmployee } from '@/hooks/useTimesheets';
import { useEmployees } from '@/hooks/useEmployees';
import { CreateTimesheetDialog } from '@/components/payroll/CreateTimesheetDialog';
import { EditTimesheetDialog } from '@/components/payroll/EditTimesheetDialog';
import { usePayrollLocalization } from '@/hooks/usePayrollLocalization';

const statusConfig: Record<TimesheetStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: FileText },
  submitted: { label: 'Submitted', color: 'bg-blue-500/10 text-blue-600', icon: Send },
  approved: { label: 'Approved', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  processed: { label: 'Processed', color: 'bg-primary/10 text-primary', icon: CheckCircle2 },
};

export default function EmployeeTimesheets() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<TimesheetWithEmployee | null>(null);

  const { timesheets, isLoading, submitTimesheet, approveTimesheet, rejectTimesheet, deleteTimesheet } = useTimesheets();
  const { employees } = useEmployees();
  const { payrollConfig } = usePayrollLocalization();

  const handleEditClick = (timesheet: TimesheetWithEmployee, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTimesheet(timesheet);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (timesheet: TimesheetWithEmployee, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTimesheet(timesheet);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedTimesheet) {
      deleteTimesheet.mutate(selectedTimesheet.id);
      setDeleteDialogOpen(false);
      setSelectedTimesheet(null);
    }
  };

  const filteredTimesheets = timesheets.filter(ts => {
    const employeeName = ts.employees 
      ? `${ts.employees.first_name} ${ts.employees.last_name}`.toLowerCase()
      : '';
    const matchesSearch = 
      employeeName.includes(searchQuery.toLowerCase()) ||
      ts.employees?.employee_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ts.status === statusFilter;
    const matchesEmployee = employeeFilter === 'all' || ts.employee_id === employeeFilter;
    return matchesSearch && matchesStatus && matchesEmployee;
  });

  const stats = {
    total: timesheets.length,
    pending: timesheets.filter(t => t.status === 'submitted').length,
    approved: timesheets.filter(t => t.status === 'approved').length,
    draft: timesheets.filter(t => t.status === 'draft').length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-12 w-full" />
            </Card>
          ))}
        </div>
        <Card className="p-4">
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employee Timesheets</h1>
          <p className="text-muted-foreground">Manage and approve employee time entries</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Timesheet
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Timesheets</p>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Approval</p>
              <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle2 className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-bold text-success">{stats.approved}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Drafts</p>
              <p className="text-2xl font-bold text-muted-foreground">{stats.draft}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by employee name or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map(emp => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Timesheets Table */}
      <Card className="overflow-hidden">
        {filteredTimesheets.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No timesheets found. Create one to get started.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Employee</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Entry Type</TableHead>
                <TableHead className="text-right">Regular Hours</TableHead>
                <TableHead className="text-right">Overtime</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTimesheets.map((timesheet) => {
                const status = statusConfig[timesheet.status];
                const StatusIcon = status.icon;

                return (
                  <TableRow 
                    key={timesheet.id} 
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => navigate(`/payroll/timesheets/${timesheet.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-foreground">
                            {timesheet.employees?.first_name} {timesheet.employees?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {timesheet.employees?.employee_number}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {format(parseLocalDate(timesheet.period_start), 'MMM d')} -{' '}
                          {format(parseLocalDate(timesheet.period_end), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {timesheet.entry_type}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {timesheet.total_regular_hours ?? 0}h
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {timesheet.total_overtime_hours ?? 0}h
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {timesheet.total_hours ?? 0}h
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("gap-1", status.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              navigate(`/payroll/timesheets/${timesheet.id}`); 
                            }}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {(timesheet.status === 'draft' || timesheet.status === 'rejected') && (
                            <>
                              <DropdownMenuItem onClick={(e) => handleEditClick(timesheet, e)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  submitTimesheet.mutate(timesheet.id); 
                                }}
                              >
                                <Send className="w-4 h-4 mr-2" />
                                Submit for Approval
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => handleDeleteClick(timesheet, e)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                          {timesheet.status === 'submitted' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  approveTimesheet.mutate({ timesheetId: timesheet.id, method: 'manager' }); 
                                }}
                                className="text-success"
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  rejectTimesheet.mutate({ timesheetId: timesheet.id, reason: 'Needs correction' }); 
                                }}
                                className="text-destructive"
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <CreateTimesheetDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <EditTimesheetDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        timesheet={selectedTimesheet}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Timesheet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this timesheet? This action cannot be undone and will remove all associated time entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
