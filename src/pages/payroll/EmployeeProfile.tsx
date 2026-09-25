import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Edit, 
  Mail, 
  Phone, 
  MapPin, 
  Building2,
  Calendar,
  DollarSign,
  Clock,
  FileText,
  History
} from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PROVINCE_NAMES } from '@/types/payroll';
import { getDefaultTD1Claims } from '@/lib/payrollCalculator';
import EditEmployeeDialog from '@/components/employees/EditEmployeeDialog';
import EmployeePayHistoryDialog from '@/components/employees/EmployeePayHistoryDialog';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [payHistoryOpen, setPayHistoryOpen] = useState(false);

  const { data: employee, isLoading, error } = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      if (!id) throw new Error('Employee ID is required');
      
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { formatWithSymbol, currencySymbol } = useCurrencyFormatter();
  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return '-';
    return formatWithSymbol(value);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return format(parseLocalDate(dateStr), 'MMM d, yyyy');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card className="p-6">
          <div className="flex items-center gap-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <Skeleton className="h-48 w-full" />
        </Card>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <FileText className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Employee Not Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          The employee you're looking for doesn't exist or has been removed.
        </p>
        <Button onClick={() => navigate('/payroll/employees')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Employees
        </Button>
      </div>
    );
  }

  const statusConfig = {
    active: { label: 'Active', color: 'bg-success/10 text-success' },
    on_leave: { label: 'On Leave', color: 'bg-warning/10 text-warning' },
    terminated: { label: 'Terminated', color: 'bg-muted text-muted-foreground' },
    onboarding: { label: 'Onboarding', color: 'bg-blue-500/10 text-blue-600' },
  };

  const status = statusConfig[employee.status] || statusConfig.active;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/payroll/employees')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Employee Profile</h1>
            <p className="text-muted-foreground">View and manage employee details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setPayHistoryOpen(true)}>
            <History className="w-4 h-4 mr-2" />
            Pay History
          </Button>
          <Button onClick={() => setEditDialogOpen(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Profile Card */}
      <Card className="p-6">
        <div className="flex items-start gap-6">
          <Avatar className="h-24 w-24">
            <AvatarFallback className="text-3xl font-bold bg-primary/10 text-primary">
              {employee.first_name[0]}{employee.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-foreground">
                {employee.first_name} {employee.last_name}
              </h2>
              <Badge className={status.color}>{status.label}</Badge>
            </div>
            <p className="text-lg text-muted-foreground mb-4">{employee.job_title || 'No title'}</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4" />
                {employee.email}
              </div>
              {employee.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  {employee.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {PROVINCE_NAMES[employee.province] || employee.province} (Employment)
              </div>
              {employee.department && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                  {employee.department}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Details Tabs */}
      <Tabs defaultValue="employment" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="compensation">Compensation</TabsTrigger>
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="tax">Tax Information</TabsTrigger>
        </TabsList>

        <TabsContent value="employment">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Employment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Employee Number</p>
                <p className="font-medium">{employee.employee_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hire Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <p className="font-medium">{formatDate(employee.hire_date)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employment Type</p>
                <Badge variant="outline" className="mt-1">
                  {employee.employment_type === 'full_time' ? 'Full-time' : 
                   employee.employment_type === 'part_time' ? 'Part-time' : 
                   employee.employment_type === 'contract' ? 'Contract' : 
                   employee.employment_type}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pay Frequency</p>
                <p className="font-medium capitalize">{employee.pay_frequency?.replace('_', '-') || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-medium">{employee.department || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Job Title</p>
                <p className="font-medium">{employee.job_title || '-'}</p>
              </div>
              {employee.termination_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Termination Date</p>
                  <p className="font-medium text-destructive">{formatDate(employee.termination_date)}</p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="compensation">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Compensation Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {employee.annual_salary && (
                <div>
                  <p className="text-sm text-muted-foreground">Annual Salary</p>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-success" />
                    <p className="font-semibold text-xl">{formatCurrency(employee.annual_salary)}</p>
                  </div>
                </div>
              )}
              {employee.hourly_rate && (
                <div>
                  <p className="text-sm text-muted-foreground">Hourly Rate</p>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <p className="font-semibold text-xl">{currencySymbol}{employee.hourly_rate}/hr</p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Pay Method</p>
                <p className="font-medium">Direct Deposit</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vacation Pay (%)</p>
                <p className="font-medium">4%</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="personal">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium">{formatDate(employee.date_of_birth)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">SIN (Last 3 digits)</p>
                <p className="font-medium">***-***-***</p>
              </div>
              {(employee as any).nin && (
                <div>
                  <p className="text-sm text-muted-foreground">NIN (National Identification Number)</p>
                  <p className="font-medium">{(employee as any).nin}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Province (Employment)</p>
                <p className="font-medium">{PROVINCE_NAMES[employee.province] || employee.province}</p>
              </div>
              {(employee as any).mailing_province && (
                <div>
                  <p className="text-sm text-muted-foreground">Province (Mailing)</p>
                  <p className="font-medium">{PROVINCE_NAMES[(employee as any).mailing_province] || (employee as any).mailing_province}</p>
                </div>
              )}
              {(employee.address_line1 || employee.city) && (
                <div className="col-span-full">
                  <p className="text-sm text-muted-foreground">Mailing Address</p>
                  <p className="font-medium">
                    {[employee.address_line1, employee.address_line2, employee.city, (employee as any).mailing_province || employee.province, employee.postal_code]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Tax Information</h3>
            {(() => {
              const claims = getDefaultTD1Claims(employee.province);
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Federal TD1 Claim</p>
                    <p className="font-medium">{formatCurrency(claims.federalClaim)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Provincial TD1 Claim</p>
                    <p className="font-medium">{formatCurrency(claims.provincialClaim)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Province of Employment</p>
                    <p className="font-medium">{PROVINCE_NAMES[employee.province] || employee.province}</p>
                  </div>
                  {(() => {
                    const c = (employee.country || '').toLowerCase();
                    const isNG = c === 'nigeria' || c === 'ng';
                    return (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground">{isNG ? 'Pension Exempt' : 'CPP Exempt'}</p>
                          <p className="font-medium">{employee.cpp_exempt ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{isNG ? 'NHF Exempt' : 'EI Exempt'}</p>
                          <p className="font-medium">{employee.ei_exempt ? 'Yes' : 'No'}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              );
            })()}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EditEmployeeDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        employee={employee}
      />
      <EmployeePayHistoryDialog
        open={payHistoryOpen}
        onOpenChange={setPayHistoryOpen}
        employee={employee}
      />
    </div>
  );
}
