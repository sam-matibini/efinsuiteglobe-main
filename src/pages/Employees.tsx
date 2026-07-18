import { useState } from 'react';
import { parseLocalDate } from '@/lib/utils';
import { Plus, Search, MoreHorizontal, Building2, FileText, Edit, History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmployees } from '@/hooks/useEmployees';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddEmployeeDialog } from '@/components/employees/AddEmployeeDialog';
import EditEmployeeDialog from '@/components/employees/EditEmployeeDialog';
import EmployeePayHistoryDialog from '@/components/employees/EmployeePayHistoryDialog';
import DeleteEmployeeDialog from '@/components/employees/DeleteEmployeeDialog';
import { useNavigate } from 'react-router-dom';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionUpgradeModal } from '@/components/SubscriptionUpgradeModal';

export default function Employees() {
  const navigate = useNavigate();
  const isReadOnly = useIsReadOnly();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [payHistoryOpen, setPayHistoryOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null);

  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const { employees, isLoading, stats, deleteEmployee } = useEmployees();
  const { canAddEmployee, employeeCount, maxEmployees } = useUsageLimits();
  const { planTier, isActive } = useSubscription();

  const handleAddClick = () => {
    if (!isActive || !canAddEmployee) {
      setUpgradeOpen(true);
      return;
    }
    setIsAddOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(parseLocalDate(dateStr));
  };

  const filteredEmployees = employees.filter(e => 
    e.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate payroll stats from actual data
  const salariedEmployees = employees.filter(e => e.annual_salary && e.annual_salary > 0);
  const totalPayroll = salariedEmployees.reduce((sum, e) => sum + (e.annual_salary || 0), 0);
  const avgSalary = salariedEmployees.length > 0 ? totalPayroll / salariedEmployees.length : 0;

  // Show loading only while checking org
  if (orgLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-20" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show org creation prompt if no organization
  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to manage employees.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>Create Organization</Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-muted-foreground">Manage employee information and payroll</p>
        </div>
        {!isReadOnly && (
          <Button 
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={handleAddClick}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        )}
        <AddEmployeeDialog 
          open={isAddOpen} 
          onOpenChange={setIsAddOpen}
        />
        <SubscriptionUpgradeModal
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          currentPlanTier={planTier ?? 'starter'}
          reason={!isActive ? 'no_subscription' : 'limit_employees'}
          currentCount={employeeCount}
          currentMax={maxEmployees}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Employees</p>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Active</p>
          <p className="text-2xl font-bold text-success">{stats.active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Annual Payroll</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalPayroll)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Avg. Salary</p>
          <p className="text-2xl font-bold text-foreground">
            {salariedEmployees.length > 0 ? formatCurrency(avgSalary) : '-'}
          </p>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Employees Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {employees.length === 0 ? 'No employees yet. Add your first employee to get started.' : 'No employees match your search.'}
          </div>
        ) : (
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Position</th>
                <th>Employment Type</th>
                <th className="text-right">Pay Rate</th>
                <th>Start Date</th>
                <th>Status</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((employee) => (
                <tr key={employee.id} className="hover:bg-muted/20">
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {employee.first_name[0]}{employee.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{employee.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{employee.department || '-'}</td>
                  <td>{employee.job_title || '-'}</td>
                  <td>
                    <Badge variant="outline">
                      {employee.employment_type === 'full_time' ? 'Full-time' : 
                       employee.employment_type === 'part_time' ? 'Part-time' : 
                       employee.employment_type === 'contract' ? 'Contract' : 
                       employee.employment_type}
                    </Badge>
                  </td>
                  <td className="text-right font-mono">
                    {employee.annual_salary 
                      ? formatCurrency(employee.annual_salary) + '/yr'
                      : employee.hourly_rate 
                        ? formatCurrency(employee.hourly_rate) + '/hr'
                        : '-'
                    }
                  </td>
                  <td className="text-muted-foreground">{formatDate(employee.hire_date)}</td>
                  <td>
                    <Badge className={
                      employee.status === 'active' ? "bg-success/10 text-success" : 
                      employee.status === 'on_leave' ? "bg-warning/10 text-warning" :
                      "bg-muted text-muted-foreground"
                    }>
                      {employee.status === 'active' ? 'Active' : 
                       employee.status === 'on_leave' ? 'On Leave' :
                       employee.status === 'onboarding' ? 'Onboarding' :
                       employee.status === 'terminated' ? 'Terminated' :
                       employee.status}
                    </Badge>
                  </td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/payroll/employees/${employee.id}`)}>
                          <FileText className="w-4 h-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedEmployee(employee); setEditDialogOpen(true); }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Employee
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedEmployee(employee); setPayHistoryOpen(true); }}>
                          <History className="w-4 h-4 mr-2" />
                          View Pay History
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => { setSelectedEmployee(employee); setDeleteDialogOpen(true); }}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Employee
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
