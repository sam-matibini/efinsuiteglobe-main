import { useState, useEffect, useMemo } from 'react';
import { Clock, Save, Calculator, AlertCircle, Play, FileCheck, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { usePayrollProcessing, type TimesheetEntry as ProcessingTimesheetEntry } from '@/hooks/usePayrollProcessing';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { usePayrollLocalization } from '@/hooks/usePayrollLocalization';

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  employment_type: string;
  pay_frequency: string;
  annual_salary: number | null;
  hourly_rate: number | null;
}

interface ApprovedTimesheet {
  id: string;
  employee_id: string;
  total_regular_hours: number | null;
  total_overtime_hours: number | null;
  period_start: string;
  period_end: string;
}

interface TimesheetEntry {
  employeeId: string;
  regularHours: number;
  overtimeHours: number;
  vacationHours: number;
  sickHours: number;
  bonus: number;
  commission: number;
  selected: boolean;
  hasApprovedTimesheet: boolean;
  timesheetId?: string;
}

interface TimesheetEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payRunId?: string;
  periodStart: Date;
  periodEnd: Date;
  onSave?: () => void;
}

export function TimesheetEntryDialog({
  open,
  onOpenChange,
  payRunId,
  periodStart,
  periodEnd,
  onSave,
}: TimesheetEntryDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timesheets, setTimesheets] = useState<Record<string, TimesheetEntry>>({});
  const [approvedTimesheets, setApprovedTimesheets] = useState<ApprovedTimesheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { organization } = useCurrentOrganization();
  
  const { processPayRun } = usePayrollProcessing();
  const { payrollConfig, countryCode } = usePayrollLocalization();

  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  // Calculate default hours based on pay frequency
  const getDefaultRegularHours = (payFrequency: string) => {
    switch (payFrequency) {
      case 'weekly': return 40;
      case 'bi_weekly': return 80;
      case 'semi_monthly': return 86.67;
      case 'monthly': return 173.33;
      default: return 80;
    }
  };

  useEffect(() => {
    if (open && organization?.id) {
      fetchEmployeesAndTimesheets();
    }
  }, [open, organization?.id]);

  const fetchEmployeesAndTimesheets = async () => {
    setIsLoading(true);
    try {
      // Fetch active and onboarding employees for this organization
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('organization_id', organization?.id)
        .is('deleted_at', null)
        .in('status', ['active', 'onboarding'])
        .order('last_name');

      if (empError) throw empError;

      // Fetch approved timesheets that overlap with the pay period
      // A timesheet overlaps if its start is <= pay period end AND its end is >= pay period start
      const periodStartStr = format(periodStart, 'yyyy-MM-dd');
      const periodEndStr = format(periodEnd, 'yyyy-MM-dd');
      
      const { data: tsData, error: tsError } = await supabase
        .from('employee_timesheets')
        .select('id, employee_id, total_regular_hours, total_overtime_hours, period_start, period_end')
        .eq('organization_id', organization?.id)
        .eq('status', 'approved')
        .is('pay_run_id', null) // Only get timesheets not already linked to a pay run
        .lte('period_start', periodEndStr)
        .gte('period_end', periodStartStr);

      if (tsError) throw tsError;

      setEmployees(empData || []);
      setApprovedTimesheets(tsData || []);
      
      // Initialize timesheets for each employee, using approved timesheet data if available
      const initialTimesheets: Record<string, TimesheetEntry> = {};
      (empData || []).forEach((emp) => {
        const approvedTs = (tsData || []).find(ts => ts.employee_id === emp.id);
        
        initialTimesheets[emp.id] = {
          employeeId: emp.id,
          regularHours: approvedTs?.total_regular_hours ?? getDefaultRegularHours(emp.pay_frequency),
          overtimeHours: approvedTs?.total_overtime_hours ?? 0,
          vacationHours: 0,
          sickHours: 0,
          bonus: 0,
          commission: 0,
          selected: true,
          hasApprovedTimesheet: !!approvedTs,
          timesheetId: approvedTs?.id,
        };
      });
      setTimesheets(initialTimesheets);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load employees and timesheets');
    } finally {
      setIsLoading(false);
    }
  };

  const updateTimesheet = (employeeId: string, field: keyof TimesheetEntry, value: number | boolean) => {
    setTimesheets(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: value,
      },
    }));
  };

  const calculateGrossPay = (employee: Employee, entry: TimesheetEntry): number => {
    if (employee.annual_salary) {
      // Salaried employee - calculate per-period amount
      const periodsPerYear = employee.pay_frequency === 'weekly' ? 52 
        : employee.pay_frequency === 'bi_weekly' ? 26
        : employee.pay_frequency === 'semi_monthly' ? 24
        : 12;
      const basePay = employee.annual_salary / periodsPerYear;
      const overtimePay = employee.hourly_rate 
        ? entry.overtimeHours * employee.hourly_rate * 1.5 
        : 0;
      return basePay + overtimePay + entry.bonus + entry.commission;
    } else if (employee.hourly_rate) {
      // Hourly employee
      const regularPay = entry.regularHours * employee.hourly_rate;
      const overtimePay = entry.overtimeHours * employee.hourly_rate * 1.5;
      const vacationPay = entry.vacationHours * employee.hourly_rate;
      const sickPay = entry.sickHours * employee.hourly_rate;
      return regularPay + overtimePay + vacationPay + sickPay + entry.bonus + entry.commission;
    }
    return 0;
  };

  const getTotalHours = (entry: TimesheetEntry): number => {
    return entry.regularHours + entry.overtimeHours + entry.vacationHours + entry.sickHours;
  };

  const selectedCount = Object.values(timesheets).filter(t => t.selected).length;
  const totalGrossPay = employees.reduce((sum, emp) => {
    const entry = timesheets[emp.id];
    if (entry?.selected) {
      return sum + calculateGrossPay(emp, entry);
    }
    return sum;
  }, 0);

  const handleProcessPayRun = async () => {
    if (!payRunId) {
      toast.error('No pay run selected');
      return;
    }

    // Build timesheet entries for processing
    const timesheetEntries: ProcessingTimesheetEntry[] = employees
      .filter(emp => timesheets[emp.id]?.selected)
      .map(emp => {
        const entry = timesheets[emp.id];
        return {
          employeeId: emp.id,
          regularHours: entry.regularHours,
          overtimeHours: entry.overtimeHours,
          vacationHours: entry.vacationHours,
          sickHours: entry.sickHours,
          bonus: entry.bonus,
          commission: entry.commission,
          otherEarnings: 0,
        };
      });

    try {
      // Collect timesheet IDs to link to pay run
      const timesheetIds = employees
        .filter(emp => timesheets[emp.id]?.selected && timesheets[emp.id]?.timesheetId)
        .map(emp => timesheets[emp.id].timesheetId!);

      await processPayRun.mutateAsync({
        payRunId,
        timesheets: timesheetEntries,
        timesheetIds,
      });
      onSave?.();
      onOpenChange(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const approvedCount = Object.values(timesheets).filter(t => t.hasApprovedTimesheet).length;

  const selectAll = (checked: boolean) => {
    setTimesheets(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(id => {
        updated[id] = { ...updated[id], selected: checked };
      });
      return updated;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Timesheet Entry
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Pay Period: {format(periodStart, 'MMM d')} - {format(periodEnd, 'MMM d, yyyy')}
          </p>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 py-4">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Selected Employees</p>
            <p className="text-xl font-bold">{selectedCount}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-1">
              <FileCheck className="w-3 h-3 text-success" />
              <p className="text-xs text-muted-foreground">Approved Timesheets</p>
            </div>
            <p className="text-xl font-bold text-success">{approvedCount}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Total Hours</p>
            <p className="text-xl font-bold">
              {Object.values(timesheets)
                .filter(t => t.selected)
                .reduce((sum, t) => sum + getTotalHours(t), 0)
                .toFixed(1)}
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Est. Gross Pay</p>
            <p className="text-xl font-bold text-success">{formatCurrency(totalGrossPay)}</p>
          </Card>
        </div>

        {/* Employee Timesheets Table */}
        <div className="flex-1 overflow-auto border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-muted-foreground">Loading employees...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
              <p className="text-muted-foreground">No active employees found</p>
              <p className="text-xs text-muted-foreground">Add employees first to create timesheets</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedCount === employees.length}
                      onCheckedChange={(checked) => selectAll(!!checked)}
                    />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center w-24">Regular Hrs</TableHead>
                  <TableHead className="text-center w-24">OT Hrs</TableHead>
                  <TableHead className="text-center w-24">Vacation</TableHead>
                  <TableHead className="text-center w-24">Sick</TableHead>
                  <TableHead className="text-center w-28">Bonus ($)</TableHead>
                  <TableHead className="text-right w-28">Gross Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const entry = timesheets[employee.id];
                  if (!entry) return null;
                  
                  const grossPay = calculateGrossPay(employee, entry);
                  const isSalaried = !!employee.annual_salary;

                  return (
                    <TableRow 
                      key={employee.id}
                      className={!entry.selected ? 'opacity-50' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={entry.selected}
                          onCheckedChange={(checked) => 
                            updateTimesheet(employee.id, 'selected', !!checked)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <div>
                            <p className="font-medium">
                              {employee.first_name} {employee.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {employee.employee_number}
                            </p>
                          </div>
                          {entry.hasApprovedTimesheet ? (
                            <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                              <FileCheck className="w-3 h-3 mr-1" />
                              Timesheet
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                              <FileWarning className="w-3 h-3 mr-1" />
                              Manual
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {isSalaried ? 'Salary' : 'Hourly'}
                        </Badge>
                        {employee.hourly_rate && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatCurrency(employee.hourly_rate)}/hr
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={entry.regularHours}
                          onChange={(e) => 
                            updateTimesheet(employee.id, 'regularHours', parseFloat(e.target.value) || 0)
                          }
                          className="w-20 text-center h-8"
                          disabled={!entry.selected}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={entry.overtimeHours}
                          onChange={(e) => 
                            updateTimesheet(employee.id, 'overtimeHours', parseFloat(e.target.value) || 0)
                          }
                          className="w-20 text-center h-8"
                          disabled={!entry.selected}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={entry.vacationHours}
                          onChange={(e) => 
                            updateTimesheet(employee.id, 'vacationHours', parseFloat(e.target.value) || 0)
                          }
                          className="w-20 text-center h-8"
                          disabled={!entry.selected}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={entry.sickHours}
                          onChange={(e) => 
                            updateTimesheet(employee.id, 'sickHours', parseFloat(e.target.value) || 0)
                          }
                          className="w-20 text-center h-8"
                          disabled={!entry.selected}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={entry.bonus}
                          onChange={(e) => 
                            updateTimesheet(employee.id, 'bonus', parseFloat(e.target.value) || 0)
                          }
                          className="w-24 text-center h-8"
                          disabled={!entry.selected}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {entry.selected ? formatCurrency(grossPay) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calculator className="w-4 h-4" />
            <span>
              {payrollConfig.remittances.columns.pension}, {payrollConfig.remittances.columns.socialInsurance}, and taxes calculated automatically using {payrollConfig.remittances.authority} {periodEnd.getFullYear()} rates
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleProcessPayRun}
              disabled={processPayRun.isPending || selectedCount === 0}
              className="bg-accent hover:bg-accent/90"
            >
              <Play className="w-4 h-4 mr-2" />
              {processPayRun.isPending ? 'Processing...' : `Process Pay Run (${selectedCount})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
