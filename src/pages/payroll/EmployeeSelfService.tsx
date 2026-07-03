import { useState } from 'react';
import {
  User,
  Clock,
  FileText,
  DollarSign,
  Calendar,
  Edit2,
  Send,
  CheckCircle2,
  XCircle,
  Plus,
  Eye,
  Download,
  Settings,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useEmployees } from '@/hooks/useEmployees';
import { useTimesheets, TimesheetStatus } from '@/hooks/useTimesheets';
import { CreateTimesheetDialog } from '@/components/payroll/CreateTimesheetDialog';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { toast } from 'sonner';
import { downloadPayStubPdf, generatePayStubPdf, type PayStubData } from '@/lib/generatePayStubPdf';

const statusConfig: Record<TimesheetStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: FileText },
  submitted: { label: 'Submitted', color: 'bg-blue-500/10 text-blue-600', icon: Send },
  approved: { label: 'Approved', color: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  processed: { label: 'Processed', color: 'bg-primary/10 text-primary', icon: CheckCircle2 },
};

export default function EmployeeSelfService() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { employees, isLoading: employeesLoading } = useEmployees();
  const { organization } = useCurrentOrganization();
  const [createTimesheetOpen, setCreateTimesheetOpen] = useState(false);

  // Find the employee record associated with current user (by email match)
  const currentEmployee = employees.find(e => e.email === user?.email);
  
  const { timesheets, isLoading: timesheetsLoading, submitTimesheet } = useTimesheets(currentEmployee?.id);

  // Fetch pay stubs for this employee
  const { data: payStubs = [], isLoading: payStubsLoading } = useQuery({
    queryKey: ['pay-stubs', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return [];
      const { data, error } = await supabase
        .from('pay_stubs')
        .select('*, pay_runs(pay_period_start, pay_period_end, pay_date)')
        .eq('employee_id', currentEmployee.id)
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
    enabled: !!currentEmployee?.id,
  });

  // Fetch tax slips for this employee
  const { data: taxSlips = [], isLoading: taxSlipsLoading } = useQuery({
    queryKey: ['tax-slips', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return [];
      const { data, error } = await supabase
        .from('tax_slips')
        .select('*')
        .eq('employee_id', currentEmployee.id)
        .order('tax_year', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentEmployee?.id,
  });

  const isLoading = employeesLoading || timesheetsLoading;

  const buildPayStubData = (stub: any): PayStubData | null => {
    if (!currentEmployee) return null;
    if (!stub?.pay_runs?.pay_period_start || !stub?.pay_runs?.pay_period_end || !stub?.pay_runs?.pay_date) {
      return null;
    }

    return {
      employeeName: `${currentEmployee.first_name} ${currentEmployee.last_name}`,
      employeeNumber: currentEmployee.employee_number,
      department: currentEmployee.department || undefined,
      province: currentEmployee.province || 'ON',
      employeeAddress: [currentEmployee.address_line1, currentEmployee.address_line2, [currentEmployee.city, currentEmployee.province, currentEmployee.postal_code].filter(Boolean).join(', ')].filter(Boolean).join(', ') || undefined,

      payPeriodStart: stub.pay_runs.pay_period_start,
      payPeriodEnd: stub.pay_runs.pay_period_end,
      payDate: stub.pay_runs.pay_date,

      regularHours: stub.regular_hours || 0,
      regularEarnings: stub.regular_earnings || 0,
      overtimeHours: stub.overtime_hours || 0,
      overtimeEarnings: stub.overtime_earnings || 0,
      vacationHours: stub.vacation_hours || 0,
      vacationPay: stub.vacation_pay || 0,
      sickHours: stub.sick_hours || 0,
      bonus: stub.bonus || 0,
      commission: stub.commission || 0,
      otherEarnings: stub.other_earnings || 0,
      grossPay: stub.gross_pay || 0,

      cppContribution: stub.cpp_contribution || 0,
      eiPremium: stub.ei_premium || 0,
      federalTax: stub.federal_tax || 0,
      provincialTax: stub.provincial_tax || 0,
      otherDeductions: stub.other_deductions || 0,
      totalDeductions: stub.total_deductions || 0,

      netPay: stub.net_pay || 0,

      ytdGross: stub.ytd_gross || 0,
      ytdCpp: stub.ytd_cpp || 0,
      ytdEi: stub.ytd_ei || 0,
      ytdFederalTax: stub.ytd_federal_tax || 0,
      ytdProvincialTax: stub.ytd_provincial_tax || 0,

      companyName: organization?.name || undefined,
    };
  };

  const handleDownloadPayStub = (stub: any) => {
    const data = buildPayStubData(stub);
    if (!data) {
      toast.error('This pay stub is missing pay period details');
      return;
    }
    downloadPayStubPdf(data);
  };

  const handleViewPayStub = (stub: any) => {
    const data = buildPayStubData(stub);
    if (!data) {
      toast.error('This pay stub is missing pay period details');
      return;
    }

    const doc = generatePayStubPdf(data);
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!currentEmployee) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <User className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Employee Portal</h2>
        <p className="text-muted-foreground max-w-md">
          Your user account is not linked to an employee record. Please contact your HR administrator to set up your employee profile.
        </p>
      </div>
    );
  }

  const pendingTimesheets = timesheets.filter(t => t.status === 'draft' || t.status === 'rejected');

  return (
    <div className="space-y-6">
      {/* Header with Profile */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="w-20 h-20">
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {currentEmployee.first_name[0]}{currentEmployee.last_name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">
                Welcome, {currentEmployee.first_name}!
              </h1>
              <p className="text-muted-foreground">{currentEmployee.job_title || 'Employee'}</p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                <span>Employee ID: {currentEmployee.employee_number}</span>
                <span>•</span>
                <span>Department: {currentEmployee.department || 'N/A'}</span>
                <span>•</span>
                <span>Hire Date: {format(new Date(currentEmployee.hire_date), 'MMM d, yyyy')}</span>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate(`/payroll/employees/${currentEmployee.id}`)}>
              <Settings className="w-4 h-4 mr-2" />
              View Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setCreateTimesheetOpen(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Timesheets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingTimesheets.length}</p>
            <p className="text-sm text-muted-foreground">Pending action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Last Pay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {payStubs[0] ? `$${payStubs[0].net_pay?.toLocaleString()}` : '-'}
            </p>
            <p className="text-sm text-muted-foreground">
              {payStubs[0]?.pay_runs?.pay_date 
                ? format(parseISO(payStubs[0].pay_runs.pay_date), 'MMM d, yyyy')
                : 'No pay stubs'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Tax Slips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{taxSlips.length}</p>
            <p className="text-sm text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              YTD Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {timesheets
                .filter(t => t.status === 'approved' || t.status === 'processed')
                .reduce((sum, t) => sum + (t.total_hours || 0), 0)
                .toFixed(1)}h
            </p>
            <p className="text-sm text-muted-foreground">This year</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="timesheets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timesheets" className="gap-2">
            <Clock className="w-4 h-4" />
            Timesheets
          </TabsTrigger>
          <TabsTrigger value="paystubs" className="gap-2">
            <DollarSign className="w-4 h-4" />
            Pay Stubs
          </TabsTrigger>
          <TabsTrigger value="taxslips" className="gap-2">
            <FileText className="w-4 h-4" />
            Tax Slips
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Personal Info
          </TabsTrigger>
        </TabsList>

        {/* Timesheets Tab */}
        <TabsContent value="timesheets" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">My Timesheets</h2>
            <Button onClick={() => setCreateTimesheetOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Timesheet
            </Button>
          </div>
          <Card>
            {timesheets.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No timesheets yet. Create one to start tracking your hours.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheets.map((ts) => {
                    const status = statusConfig[ts.status];
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={ts.id}>
                        <TableCell className="font-medium">
                          {format(parseISO(ts.period_start), 'MMM d')} - {format(parseISO(ts.period_end), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="capitalize text-muted-foreground">{ts.entry_type}</TableCell>
                        <TableCell className="text-right font-mono">
                          {ts.total_hours ?? 0}h
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("gap-1", status.color)}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate(`/payroll/timesheets/${ts.id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {ts.status === 'draft' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => submitTimesheet.mutate(ts.id)}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Pay Stubs Tab */}
        <TabsContent value="paystubs" className="space-y-4">
          <h2 className="text-lg font-semibold">Pay Stubs</h2>
          <Card>
            {payStubsLoading ? (
              <div className="p-4"><Skeleton className="h-32 w-full" /></div>
            ) : payStubs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No pay stubs available yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pay Period</TableHead>
                    <TableHead>Pay Date</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payStubs.map((stub: any) => (
                    <TableRow key={stub.id}>
                      <TableCell>
                        {stub.pay_runs?.pay_period_start && stub.pay_runs?.pay_period_end
                          ? `${format(parseISO(stub.pay_runs.pay_period_start), 'MMM d')} - ${format(parseISO(stub.pay_runs.pay_period_end), 'MMM d')}`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {stub.pay_runs?.pay_date 
                          ? format(parseISO(stub.pay_runs.pay_date), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${stub.gross_pay?.toLocaleString() ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        -${stub.total_deductions?.toLocaleString() ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-success">
                        ${stub.net_pay?.toLocaleString() ?? 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleViewPayStub(stub)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadPayStub(stub)}>
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Tax Slips Tab */}
        <TabsContent value="taxslips" className="space-y-4">
          <h2 className="text-lg font-semibold">Tax Slips</h2>
          <Card>
            {taxSlipsLoading ? (
              <div className="p-4"><Skeleton className="h-32 w-full" /></div>
            ) : taxSlips.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No tax slips available yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tax Year</TableHead>
                    <TableHead>Slip Type</TableHead>
                    <TableHead className="text-right">Employment Income</TableHead>
                    <TableHead className="text-right">Tax Deducted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxSlips.map((slip: any) => (
                    <TableRow key={slip.id}>
                      <TableCell className="font-medium">{slip.tax_year}</TableCell>
                      <TableCell>{slip.slip_type}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${slip.employment_income?.toLocaleString() ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${slip.income_tax_deducted?.toLocaleString() ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge variant={slip.status === 'filed' ? 'default' : 'secondary'}>
                          {slip.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <Download className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Personal Info Tab */}
        <TabsContent value="profile" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Personal Information</h2>
            <Button variant="outline" onClick={() => navigate(`/payroll/employees/${currentEmployee.id}`)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{currentEmployee.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{currentEmployee.phone || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{currentEmployee.address_line1 || 'Not provided'}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Employment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Job Title</p>
                  <p className="font-medium">{currentEmployee.job_title || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{currentEmployee.department || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Employment Type</p>
                  <p className="font-medium capitalize">{currentEmployee.employment_type?.replace('_', ' ') || 'Full Time'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pay Frequency</p>
                  <p className="font-medium capitalize">{currentEmployee.pay_frequency?.replace('_', '-') || 'Bi-Weekly'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <CreateTimesheetDialog
        open={createTimesheetOpen}
        onOpenChange={setCreateTimesheetOpen}
        defaultEmployeeId={currentEmployee.id}
      />
    </div>
  );
}
