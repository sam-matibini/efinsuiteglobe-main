import { useAuth } from '@/hooks/useAuth';
import { useEmployees } from '@/hooks/useEmployees';
import { useCurrentOrganization, useMyOrganizationMemberships } from '@/hooks/useOrganization';
import type { Actor, AttendanceRole } from '@/lib/timeAttendance/types';

function mapRole(role?: string | null): AttendanceRole {
  switch (role) {
    case 'owner':
    case 'admin':
    case 'company_admin':
      return 'company_admin';
    case 'payroll_officer':
    case 'payroll_admin':
    case 'finance_manager':
      return 'payroll_admin';
    case 'hr':
    case 'hr_manager':
      return 'hr';
    case 'manager':
      return 'manager';
    case 'accountant':
      return 'accountant';
    default:
      return 'employee';
  }
}

export function useAttendanceActor(explicitEmployeeId?: string | null): Actor {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const { data: memberships = [] } = useMyOrganizationMemberships();
  const { employees } = useEmployees();
  const membership = memberships.find((item) => item.organization_id === organization?.id);
  const email = user?.email?.toLowerCase();
  const matched = email ? employees.find((employee) => employee.email?.toLowerCase() === email) : undefined;
  const employeeId = explicitEmployeeId ?? matched?.id ?? null;
  const teamEmployeeIds = employees
    .filter((employee) => employee.manager_id && employee.manager_id === employeeId)
    .map((employee) => employee.id);

  return {
    userId: user?.id ?? 'system',
    role: mapRole(membership?.role),
    employeeId,
    teamEmployeeIds,
  };
}
