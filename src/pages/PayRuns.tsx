import { useState, useMemo } from 'react';
import { Plus, Calendar, Download, MoreHorizontal, Play, Check, Clock, FileText, AlertCircle, Loader2, FileSpreadsheet, Eye, DollarSign, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Checkbox } from '@/components/ui/checkbox';
import { TimesheetEntryDialog } from '@/components/payroll/TimesheetEntryDialog';
import { NewPayRunDialog } from '@/components/payroll/NewPayRunDialog';
import { ViewPayRunDialog } from '@/components/payroll/ViewPayRunDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { downloadPayStubPdf, type PayStubData } from '@/lib/generatePayStubPdf';
import type { PayRunStatus } from '@/types/payroll';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization, getLocaleForCountry } from '@/data/countryLocalizations';
import { usePayrollProcessing } from '@/hooks/usePayrollProcessing';
import { postPayrollJournalEntries } from '@/lib/payrollJournalPosting';
import * as XLSX from 'xlsx';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { parseLocalDate } from '@/lib/utils';

interface PayRun {
  id: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  status: PayRunStatus;
  total_gross: number | null;
  total_deductions: number | null;
  total_net: number | null;
  total_employer_contributions: number | null;
  employee_count: number | null;
  notes: string | null;
  created_at: string;
  journal_entry_id: string | null;
}

export default function PayRuns() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [timesheetOpen, setTimesheetOpen] = useState(false);
  const isReadOnly = useIsReadOnly();
  const [newPayRunOpen, setNewPayRunOpen] = useState(false);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [selectedPayRun, setSelectedPayRun] = useState<PayRun | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();
  const { markPayRunPaid } = usePayrollProcessing();

  // Fetch pay runs from database
  const { data: payRuns = [], isLoading, error } = useQuery({
    queryKey: ['pay-runs', organization?.id, year],
    queryFn: async () => {
      if (!organization?.id) return [];
      
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      
      const { data, error } = await supabase
        .from('pay_runs')
        .select('*')
        .eq('organization_id', organization.id)
        .gte('pay_period_start', startOfYear)
        .lte('pay_period_start', endOfYear)
        .order('pay_period_start', { ascending: false });

      if (error) throw error;
      return data as PayRun[];
    },
    enabled: !!organization?.id,
  });

  // Get country-based currency formatting
  const countryCode = (organization as any)?.country?.code || 'CA';
  const localization = useMemo(() => getCountryLocalization(countryCode), [countryCode]);
  const locale = useMemo(() => getLocaleForCountry(countryCode), [countryCode]);

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);
  };


  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-CA', {
      month: 'short',
      day: 'numeric',
    }).format(parseLocalDate(dateStr));
  };

  const formatFullDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(parseLocalDate(dateStr));
  };

  const statusConfig: Record<PayRunStatus, { label: string; icon: typeof Clock; color: string }> = {
    draft: { label: 'Draft', icon: Clock, color: 'bg-warning/10 text-warning' },
    processing: { label: 'Processing', icon: Loader2, color: 'bg-blue-500/10 text-blue-600' },
    approved: { label: 'Approved', icon: Check, color: 'bg-blue-500/10 text-blue-600' },
    paid: { label: 'Paid', icon: Check, color: 'bg-success/10 text-success' },
    cancelled: { label: 'Cancelled', icon: AlertCircle, color: 'bg-muted text-muted-foreground' },
  };

  // Include both 'approved' and 'paid' runs in YTD calculations
  const completedRuns = payRuns.filter(p => p.status === 'paid' || p.status === 'approved');
  const ytdGross = completedRuns.reduce((s, p) => s + (p.total_gross || 0), 0);
  const ytdDeductions = completedRuns.reduce((s, p) => s + (p.total_deductions || 0), 0);
  const ytdNet = completedRuns.reduce((s, p) => s + (p.total_net || 0), 0);
  const draftRun = payRuns.find(p => p.status === 'draft');

  const confirmDelete = (ids: string[]) => {
    setDeleteTarget(ids);
    setDeleteConfirmOpen(true);
  };

  const handleDeletePayRuns = async () => {
    if (!deleteTarget || deleteTarget.length === 0) return;
    setIsDeleting(true);
    try {
      // Delete associated pay stubs first (foreign key constraint)
      const { error: stubError } = await supabase
        .from('pay_stubs')
        .delete()
        .in('pay_run_id', deleteTarget);
      if (stubError) throw stubError;

      // Then delete the pay runs
      const { error } = await supabase
        .from('pay_runs')
        .delete()
        .in('id', deleteTarget);
      if (error) throw error;

      toast.success(`${deleteTarget.length} pay run(s) deleted`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete pay run(s)');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  const handlePostToGL = async (payRun: PayRun) => {
    if (!organization?.id) return;
    try {
      // Use a unique reference based on pay run ID to prevent duplicates
      const payRunRef = payRun.id.slice(-8).toUpperCase();
      const result = await postPayrollJournalEntries(
        payRun.id,
        organization.id,
        payRunRef,
        payRun.pay_date
      );
      if (result) {
        toast.success('Payroll journal entry posted to GL');
        queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
        queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
      } else {
        toast.error('Could not post JE - check that payroll GL accounts exist');
      }
    } catch (err: any) {
      const msg = err.message || 'Unknown error';
      if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
        toast.error('Journal entry reference already exists. The entry may have been posted previously.');
      } else {
        toast.error('Failed to post JE: ' + msg);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === payRuns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(payRuns.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleProcessPayRun = async (payRun: PayRun) => {
    // Pay runs with 0 employees need timesheets entered first
    if (!payRun.employee_count || payRun.employee_count === 0) {
      toast.error('Please enter timesheets before processing the pay run');
      setSelectedPayRun(payRun);
      setTimesheetOpen(true);
      return;
    }

    try {
      // Move directly to approved status since timesheets are already processed
      const { error } = await supabase
        .from('pay_runs')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', payRun.id);

      if (error) throw error;

      toast.success('Pay run approved and ready for payment');
      queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to process pay run');
    }
  };

  const refreshPayRuns = () => {
    queryClient.invalidateQueries({ queryKey: ['pay-runs'] });
  };

  const handleViewDetails = (payRun: PayRun) => {
    setSelectedPayRun(payRun);
    setViewDetailsOpen(true);
  };

  const handleExportExcel = async (payRun: PayRun) => {
    try {
      const { data: payStubs, error } = await supabase
        .from('pay_stubs')
        .select(`*, employee:employees(id, first_name, last_name, employee_number, department)`)
        .eq('pay_run_id', payRun.id);

      if (error) throw error;
      if (!payStubs || payStubs.length === 0) {
        toast.error('No pay stubs found for this pay run');
        return;
      }

      const data = payStubs.map((stub: any) => ({
        'Employee Name': stub.employee ? `${stub.employee.first_name} ${stub.employee.last_name}` : 'Unknown',
        'Employee #': stub.employee?.employee_number || '',
        'Department': stub.employee?.department || '',
        'Regular Hours': stub.regular_hours || 0,
        'Regular Earnings': stub.regular_earnings || 0,
        'Overtime Hours': stub.overtime_hours || 0,
        'Overtime Earnings': stub.overtime_earnings || 0,
        'Vacation Pay': stub.vacation_pay || 0,
        'Gross Pay': stub.gross_pay,
        'CPP': stub.cpp_contribution || 0,
        'EI': stub.ei_premium || 0,
        'Federal Tax': stub.federal_tax || 0,
        'Provincial Tax': stub.provincial_tax || 0,
        'Total Deductions': stub.total_deductions,
        'Net Pay': stub.net_pay,
      }));

      // Add totals row
      data.push({
        'Employee Name': 'TOTALS',
        'Employee #': '',
        'Department': '',
        'Regular Hours': payStubs.reduce((s: number, p: any) => s + (p.regular_hours || 0), 0),
        'Regular Earnings': payStubs.reduce((s: number, p: any) => s + (p.regular_earnings || 0), 0),
        'Overtime Hours': payStubs.reduce((s: number, p: any) => s + (p.overtime_hours || 0), 0),
        'Overtime Earnings': payStubs.reduce((s: number, p: any) => s + (p.overtime_earnings || 0), 0),
        'Vacation Pay': payStubs.reduce((s: number, p: any) => s + (p.vacation_pay || 0), 0),
        'Gross Pay': payRun.total_gross || 0,
        'CPP': payStubs.reduce((s: number, p: any) => s + (p.cpp_contribution || 0), 0),
        'EI': payStubs.reduce((s: number, p: any) => s + (p.ei_premium || 0), 0),
        'Federal Tax': payStubs.reduce((s: number, p: any) => s + (p.federal_tax || 0), 0),
        'Provincial Tax': payStubs.reduce((s: number, p: any) => s + (p.provincial_tax || 0), 0),
        'Total Deductions': payRun.total_deductions || 0,
        'Net Pay': payRun.total_net || 0,
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Pay Run');

      const filename = `PayRun_${payRun.pay_period_start}_to_${payRun.pay_period_end}.xlsx`;
      XLSX.writeFile(workbook, filename);
      toast.success('Exported to Excel');
    } catch (error: any) {
      toast.error(error.message || 'Failed to export');
    }
  };

  const handleDownloadPayStubs = async (payRun: PayRun) => {
    try {
      // Fetch pay stubs with employee data for this pay run
      const { data: payStubs, error } = await supabase
        .from('pay_stubs')
        .select(`
          *,
          employee:employees(id, first_name, last_name, employee_number, department, province, address_line1, address_line2, city, postal_code, country)
        `)
        .eq('pay_run_id', payRun.id);

      if (error) throw error;
      if (!payStubs || payStubs.length === 0) {
        toast.error('No pay stubs found for this pay run');
        return;
      }

      const org = organization as any;

      // Generate PDF for each employee
      for (const stub of payStubs) {
        const employee = stub.employee as any;
        if (!employee) continue;

        const stubData: PayStubData = {
          employeeName: `${employee.first_name} ${employee.last_name}`,
          employeeNumber: employee.employee_number,
          department: employee.department || undefined,
          province: employee.province || 'ON',
          employeeAddressLine1: employee.address_line1 || undefined,
          employeeAddressLine2: employee.address_line2 || undefined,
          employeeCity: employee.city || undefined,
          employeeProvince: employee.province || undefined,
          employeePostalCode: employee.postal_code || undefined,
          employeeCountry: employee.country || undefined,
          payPeriodStart: payRun.pay_period_start,
          payPeriodEnd: payRun.pay_period_end,
          payDate: payRun.pay_date,
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
          grossPay: stub.gross_pay,
          cppContribution: stub.cpp_contribution || 0,
          eiPremium: stub.ei_premium || 0,
          federalTax: stub.federal_tax || 0,
          provincialTax: stub.provincial_tax || 0,
          otherDeductions: stub.other_deductions || 0,
          totalDeductions: stub.total_deductions,
          netPay: stub.net_pay,
          ytdGross: stub.ytd_gross || 0,
          ytdCpp: stub.ytd_cpp || 0,
          ytdEi: stub.ytd_ei || 0,
          ytdFederalTax: stub.ytd_federal_tax || 0,
          ytdProvincialTax: stub.ytd_provincial_tax || 0,
          companyName: org?.name || undefined,
          companyAddressLine1: org?.address_line1 || undefined,
          companyAddressLine2: org?.address_line2 || undefined,
          companyCity: org?.city || undefined,
          companyProvince: org?.province || undefined,
          companyPostalCode: org?.postal_code || undefined,
          companyCountry: typeof org?.country === 'string' ? org.country : org?.country?.name || undefined,
        };

        downloadPayStubPdf(stubData);
      }

      toast.success(`Downloaded ${payStubs.length} pay stub(s)`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to download pay stubs');
    }
  };

  // Generate year options
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pay Runs</h1>
          <p className="text-muted-foreground">Process and manage payroll runs</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {!isReadOnly && (
            <Button 
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setNewPayRunOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Pay Run
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">YTD Gross Pay</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(ytdGross)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">YTD Deductions</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(ytdDeductions)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">YTD Net Pay</p>
          <p className="text-2xl font-bold text-success">{formatCurrency(ytdNet)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Pay Runs (YTD)</p>
          <p className="text-2xl font-bold text-foreground">{completedRuns.length}</p>
        </Card>
      </div>

      {/* Pending Pay Run */}
      {draftRun && (
        <Card className="p-6 border-l-4 border-l-warning">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5 text-warning" />
                Pending Pay Run
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Period: {formatDate(draftRun.pay_period_start)} - {formatDate(draftRun.pay_period_end)} • 
                Pay Date: {formatFullDate(draftRun.pay_date)} • 
                {draftRun.employee_count || 0} Employees
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Net Pay</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(draftRun.total_net)}</p>
              </div>
              <Button 
                variant="outline"
                onClick={() => {
                  setSelectedPayRun(draftRun);
                  setTimesheetOpen(true);
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                Enter Timesheets
              </Button>
              <Button 
                className="bg-accent hover:bg-accent/90"
                onClick={() => handleProcessPayRun(draftRun)}
              >
                <Play className="w-4 h-4 mr-2" />
                Process Pay Run
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Year:</span>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => confirmDelete(Array.from(selectedIds))}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}

      {/* Pay Runs Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-muted-foreground">Failed to load pay runs</p>
          </div>
        ) : payRuns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Calendar className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground">No pay runs found for {year}</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setNewPayRunOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Pay Run
            </Button>
          </div>
        ) : (
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10">
                  <Checkbox
                    checked={selectedIds.size === payRuns.length && payRuns.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="text-left">Period</th>
                <th className="text-left">Pay Date</th>
                <th className="text-center">Employees</th>
                <th className="text-right">Gross Pay</th>
                <th className="text-right">Deductions</th>
                <th className="text-right">Net Pay</th>
                <th className="text-left">Status</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {payRuns.map((payRun) => {
                const status = statusConfig[payRun.status];
                const StatusIcon = status.icon;
                
                return (
                  <tr key={payRun.id} className={cn("hover:bg-muted/20", selectedIds.has(payRun.id) && "bg-muted/30")}>
                    <td>
                      <Checkbox
                        checked={selectedIds.has(payRun.id)}
                        onCheckedChange={() => toggleSelect(payRun.id)}
                      />
                    </td>
                    <td className="text-left font-medium">
                      {formatDate(payRun.pay_period_start)} - {formatDate(payRun.pay_period_end)}
                    </td>
                    <td className="text-left text-muted-foreground">{formatFullDate(payRun.pay_date)}</td>
                    <td className="text-center">{payRun.employee_count || 0}</td>
                    <td className="text-right font-mono">{formatCurrency(payRun.total_gross)}</td>
                    <td className="text-right font-mono text-destructive">{formatCurrency(payRun.total_deductions)}</td>
                    <td className="text-right font-mono font-medium text-success">{formatCurrency(payRun.total_net)}</td>
                    <td className="text-left">
                      <Badge className={cn("gap-1", status.color)}>
                        <StatusIcon className={cn("w-3 h-3", payRun.status === 'processing' && 'animate-spin')} />
                        {status.label}
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
                          <DropdownMenuItem onClick={() => handleViewDetails(payRun)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {payRun.status === 'draft' && (
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedPayRun(payRun);
                                setTimesheetOpen(true);
                              }}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Enter Timesheets
                            </DropdownMenuItem>
                          )}
                          {payRun.status === 'approved' && (
                            <DropdownMenuItem 
                              onClick={() => markPayRunPaid.mutate(payRun.id)}
                              disabled={markPayRunPaid.isPending}
                            >
                              <DollarSign className="w-4 h-4 mr-2" />
                              {markPayRunPaid.isPending ? 'Posting...' : 'Mark as Paid & Post to GL'}
                            </DropdownMenuItem>
                          )}
                          {payRun.status === 'paid' && !payRun.journal_entry_id && (
                            <DropdownMenuItem onClick={() => handlePostToGL(payRun)}>
                              <DollarSign className="w-4 h-4 mr-2" />
                              Post to GL
                            </DropdownMenuItem>
                          )}
                          {(payRun.status === 'paid' || payRun.status === 'approved') && (
                            <DropdownMenuItem onClick={() => handleDownloadPayStubs(payRun)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download Pay Stubs
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleExportExcel(payRun)}>
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            Export to Excel
                          </DropdownMenuItem>
                          {payRun.status === 'draft' && (
                            <DropdownMenuItem 
                              onClick={() => handleProcessPayRun(payRun)}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Process
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => confirmDelete([payRun.id])}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pay Run{deleteTarget && deleteTarget.length > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.length || 0} pay run{deleteTarget && deleteTarget.length > 1 ? 's' : ''} and all associated pay stubs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePayRuns}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Pay Run Dialog */}
      <NewPayRunDialog
        open={newPayRunOpen}
        onOpenChange={setNewPayRunOpen}
        onSuccess={refreshPayRuns}
      />

      {/* Timesheet Entry Dialog */}
      {selectedPayRun && (
        <TimesheetEntryDialog
          open={timesheetOpen}
          onOpenChange={setTimesheetOpen}
          payRunId={selectedPayRun.id}
          periodStart={parseLocalDate(selectedPayRun.pay_period_start)}
          periodEnd={parseLocalDate(selectedPayRun.pay_period_end)}
          onSave={refreshPayRuns}
        />
      )}

      {/* View Pay Run Details Dialog */}
      <ViewPayRunDialog
        open={viewDetailsOpen}
        onOpenChange={setViewDetailsOpen}
        payRun={selectedPayRun}
      />
    </div>
  );
}
