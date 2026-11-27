import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, UserCheck, Clock, UserX, MoreHorizontal, FileText, Edit, History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { PROVINCE_NAMES } from '@/types/payroll';
import { format } from 'date-fns';
import { useEmployees } from '@/hooks/useEmployees';
import { Database } from '@/integrations/supabase/types';
import EditEmployeeDialog from '@/components/employees/EditEmployeeDialog';
import EmployeePayHistoryDialog from '@/components/employees/EmployeePayHistoryDialog';
import DeleteEmployeeDialog from '@/components/employees/DeleteEmployeeDialog';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { EmployeeFilterBar, SortHeader } from '@/components/employees/EmployeeListControls';
import { EMPTY_FILTERS, EmployeeFilters, filterEmployees, nextSort, SortKey, SortState, sortEmployees } from '@/lib/employeeListView';

type EmployeeStatus = Database['public']['Enums']['employee_status'];

const statusConfig: Record<EmployeeStatus, { label: string; color: string; icon: typeof Users }> = {
  active: { label: 'Active', color: 'bg-success/10 text-success', icon: UserCheck },
  on_leave: { label: 'On Leave', color: 'bg-warning/10 text-warning', icon: Clock },
  terminated: { label: 'Terminated', color: 'bg-muted text-muted-foreground', icon: UserX },
  onboarding: { label: 'Onboarding', color: 'bg-blue-500/10 text-blue-600', icon: Users },
};

export default function EmployeesList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<EmployeeFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' });
  const onSort = (key: SortKey) => setSort((s) => nextSort(s, key));
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [payHistoryOpen, setPayHistoryOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null);

  const { employees, isLoading, stats, departments, deleteEmployee } = useEmployees();

  const filteredEmployees = useMemo(
    () => sortEmployees(filterEmployees(employees, filters), sort),
    [employees, filters, sort],
  );
  const departmentOptions = useMemo(() => (departments ?? []).filter((d): d is string => !!d).sort(), [departments]);

  const { formatWithSymbol, currencySymbol } = useCurrencyFormatter();
  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return '-';
    return formatWithSymbol(value);
  };

  const anyFilter = filters.search !== '' || JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
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
          <Skeleton className="h-10 w-full" />
        </Card>
        <Card className="p-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full mb-2" />
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-muted-foreground">Manage employee records and HR information</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/payroll/employees/bulk-upload')}>
            <FileText className="w-4 h-4 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={() => navigate('/payroll/employees/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>

      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Employees</p>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <UserCheck className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-success">{stats.active}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Onboarding</p>
              <p className="text-2xl font-bold text-blue-600">{stats.onboarding}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">On Leave</p>
              <p className="text-2xl font-bold text-warning">{stats.onLeave}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search, filters and result count */}
      <Card className="p-4">
        <EmployeeFilterBar
          filters={filters}
          onChange={setFilters}
          departments={departmentOptions}
          shown={filteredEmployees.length}
          total={employees.length}
          currencySymbol={currencySymbol}
        />
      </Card>

      {/* Employees Table */}
      <Card className="overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {anyFilter
              ? 'No employees found matching your filters.'
              : 'No employees yet. Add your first employee to get started.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead><SortHeader label="Employee" sortKey="name" sort={sort} onSort={onSort} /></TableHead>
                <TableHead><SortHeader label="Department" sortKey="department" sort={sort} onSort={onSort} /></TableHead>
                <TableHead><SortHeader label="Province" sortKey="province" sort={sort} onSort={onSort} /></TableHead>
                <TableHead><SortHeader label="Hire Date" sortKey="hire_date" sort={sort} onSort={onSort} /></TableHead>
                <TableHead><SortHeader label="Compensation" sortKey="pay" sort={sort} onSort={onSort} /></TableHead>
                <TableHead><SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} /></TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map((employee) => {
                const status = statusConfig[employee.status];
                const StatusIcon = status.icon;
                
                return (
                  <TableRow key={employee.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/payroll/employees/${employee.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">
                            {employee.first_name[0]}{employee.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{employee.first_name} {employee.last_name}</p>
                          <p className="text-sm text-muted-foreground">{employee.job_title || '-'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{employee.department || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{PROVINCE_NAMES[employee.province] || employee.province}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(employee.hire_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {employee.annual_salary ? (
                        <span className="font-mono text-foreground">{formatCurrency(employee.annual_salary)}/yr</span>
                      ) : employee.hourly_rate ? (
                        <span className="font-mono text-foreground">{formatCurrency(employee.hourly_rate)}/hr</span>
                      ) : '-'}
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
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/payroll/employees/${employee.id}`); }}>
                            <FileText className="w-4 h-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedEmployee(employee); setEditDialogOpen(true); }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Employee
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedEmployee(employee); setPayHistoryOpen(true); }}>
                            <History className="w-4 h-4 mr-2" />
                            View Pay History
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); setSelectedEmployee(employee); setDeleteDialogOpen(true); }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Employee
                          </DropdownMenuItem>
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

      {/* Dialogs */}
      <EditEmployeeDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        employee={selectedEmployee}
      />
      <EmployeePayHistoryDialog
        open={payHistoryOpen}
        onOpenChange={setPayHistoryOpen}
        employee={selectedEmployee}
      />
      <DeleteEmployeeDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        employee={selectedEmployee}
        onConfirm={() => {
          if (selectedEmployee) {
            deleteEmployee.mutate(selectedEmployee.id, {
              onSuccess: () => {
                setDeleteDialogOpen(false);
                setSelectedEmployee(null);
              },
            });
          }
        }}
        isDeleting={deleteEmployee.isPending}
      />
    </div>
  );
}
