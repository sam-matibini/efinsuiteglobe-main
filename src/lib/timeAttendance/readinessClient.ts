import { supabase } from '@/integrations/supabase/client';
import { calendarDate, emptyOrg, inferPayType, payrollReadiness, type PayrollReadiness } from '@/lib/timeAttendance/engine';
import { timeRequest } from '@/lib/timeAttendance/persistence';
import type { OrgAttendance } from '@/lib/timeAttendance/types';

const OPEN_PAYROLL: PayrollReadiness = {
  enabled: false,
  employeesUsingTimeTracking: 0,
  completedTimesheets: 0,
  pendingApproval: 0,
  missingClockOut: 0,
  approvedHours: 0,
  canFinalize: true,
  warning: null,
};

export async function loadAttendanceOrg(organizationId: string): Promise<OrgAttendance> {
  const result = await timeRequest('GET', '/api/time/state', {}, { organizationId });
  if (result.status >= 400) return emptyOrg(organizationId);
  return (result.body.org as OrgAttendance) ?? emptyOrg(organizationId);
}

/** Company time tracking that is off, or an unreachable clock service, leaves payroll open. */
export async function fetchPayrollReadiness(
  organizationId: string,
  periodStart: string,
  periodEnd: string,
): Promise<PayrollReadiness> {
  try {
    const org = await loadAttendanceOrg(organizationId);
    if (!org.company.enabled) return OPEN_PAYROLL;
    const { data, error } = await supabase
      .from('employees')
      .select('id, annual_salary, hourly_rate')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .in('status', ['active', 'onboarding']);
    if (error || !data) return OPEN_PAYROLL;
    return payrollReadiness(org, {
      periodStart,
      periodEnd,
      today: calendarDate(new Date().toISOString(), org.company.timezone),
      employees: data.map((employee) => ({ id: employee.id, payType: inferPayType(employee) })),
    });
  } catch {
    return OPEN_PAYROLL;
  }
}
