import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PayrollReadiness } from '@/lib/timeAttendance/engine';

export function PayrollReadinessCard({ readiness }: { readiness: PayrollReadiness }) {
  if (!readiness.enabled) return null;
  return (
    <Card data-testid="payroll-readiness">
      <CardHeader className="pb-2">
        <CardTitle>Time & Attendance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p>Employees using time tracking: {readiness.employeesUsingTimeTracking}</p>
        <p>Completed timesheets: {readiness.completedTimesheets}</p>
        <p>Pending approval: {readiness.pendingApproval}</p>
        <p>Missing clock-out: {readiness.missingClockOut}</p>
        <p>Approved hours: {readiness.approvedHours.toFixed(2)}</p>
        {readiness.warning && <p className="font-medium">{readiness.warning}</p>}
        <Button variant="outline" size="sm" asChild>
          <Link to="/payroll/time-attendance">Review time records</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
