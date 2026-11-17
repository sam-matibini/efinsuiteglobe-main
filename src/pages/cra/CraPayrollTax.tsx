import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CraModule } from '@/components/cra/CraModule';
import { formatCad } from '@/lib/cra/engine';
import { STATUS_LABEL, type WorkflowStatus } from '@/lib/cra/mypayment/workflow';
import { remittanceMonthRange } from '@/lib/payroll/remittancePeriod';
import { parseLocalDate } from '@/lib/utils';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';
import { useRemittances, type Remittance } from '@/hooks/useRemittances';
import { useTaxReportPayments } from '@/hooks/useTaxReportPayments';

const monthLabel = (period: string) =>
  parseLocalDate(`${period.substring(0, 7)}-01`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
const dayLabel = (date: string) => parseLocalDate(date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

function reportStatus(remittance: Remittance) {
  if (remittance.status === 'paid') return { label: 'Paid', tone: 'bg-emerald-500/10 text-emerald-700' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parseLocalDate(remittance.due_date) < today) return { label: 'Overdue', tone: 'bg-destructive/10 text-destructive' };
  return { label: 'Pending', tone: 'bg-amber-500/10 text-amber-700' };
}

export default function CraPayrollTax() {
  const cra = useCraTaxCentre();
  const navigate = useNavigate();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const { remittances, isLoading } = useRemittances(year);
  const { linkedByReport, startPayment } = useTaxReportPayments();
  const canPay = cra.can('prepare_payment');

  const pay = async (remittance: Remittance) => {
    const period = remittance.remittance_period.substring(0, 7);
    const range = remittanceMonthRange(period);
    try {
      await startPayment.mutateAsync({
        kind: 'pd7a',
        id: remittance.id,
        amount: Number(remittance.total_amount),
        periodStart: range.startDate,
        periodEnd: range.endDate,
        periodLabel: monthLabel(period),
        dueDate: remittance.due_date,
      });
      navigate('/tax-cra/payments');
    } catch {
      // Error shown by the hook
    }
  };

  return (
    <CraModule
      title="Payroll source deductions"
      description="PD7A remittances come from Payroll → Remittances. Each month includes the pay runs whose pay period ends in that month. Pay a remittance through CRA My Payment; it is marked paid once CRA's confirmation is recorded."
      actions={
        <Button asChild variant="outline">
          <Link to="/payroll/remittances">Generate or manage PD7As</Link>
        </Button>
      }
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>PD7A remittances</CardTitle>
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="w-28" aria-label="Year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[thisYear, thisYear - 1, thisYear - 2].map((option) => (
                <SelectItem key={option} value={String(option)}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading remittances…</p>
          ) : remittances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No PD7A remittances for {year}. Generate one in{' '}
              <Link to="/payroll/remittances" className="text-primary underline">Payroll → Remittances</Link> after the pay runs are paid.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Period</th>
                    <th className="py-2 pr-3 font-medium">Due</th>
                    <th className="py-2 pr-3 text-right font-medium">Total</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">CRA payment</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {remittances.map((remittance) => {
                    const status = reportStatus(remittance);
                    const linked = linkedByReport.get(remittance.id);
                    return (
                      <tr key={remittance.id} className="border-t">
                        <td className="py-2 pr-3 font-medium">{monthLabel(remittance.remittance_period)}</td>
                        <td className="py-2 pr-3">{dayLabel(remittance.due_date)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{formatCad(Number(remittance.total_amount))}</td>
                        <td className="py-2 pr-3">
                          <span className={`rounded px-2 py-0.5 text-xs ${status.tone}`}>{status.label}</span>
                          {remittance.confirmation_number ? (
                            <div className="mt-1 text-xs text-muted-foreground">CRA confirmation {remittance.confirmation_number}</div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          {linked ? (
                            <span>
                              {linked.reference}
                              <span className="block text-xs text-muted-foreground">
                                {STATUS_LABEL[linked.workflow_status as WorkflowStatus] ?? linked.workflow_status}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {linked ? (
                            <Button asChild size="sm" variant="outline">
                              <Link to="/tax-cra/payments">Open in CRA Payments</Link>
                            </Button>
                          ) : remittance.status !== 'paid' ? (
                            <Button
                              size="sm"
                              onClick={() => pay(remittance)}
                              disabled={!canPay || startPayment.isPending || !(Number(remittance.total_amount) > 0)}
                            >
                              Pay with CRA My Payment
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Paying creates a draft in CRA Payments with the amount, period and payroll (RP) account filled in. It still needs approval there, and the
        payment itself is made on CRA's site.
      </p>
    </CraModule>
  );
}
