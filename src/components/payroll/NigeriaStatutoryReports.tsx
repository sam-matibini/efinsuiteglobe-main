import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, ChevronDown, ChevronUp, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { NIGERIA_STATUTORY_REPORTS, type StatutoryReportCategory } from '@/data/payrollLocalization';
import { dueStatus } from '@/lib/payroll/complianceCalendar';
import { buildNgStatutorySchedules, type NgScheduleEmployee, type NgScheduleStub } from '@/lib/payroll/ngStatutorySchedules';
import { downloadNgStatutoryWorkbook } from '@/lib/payroll/ngStatutoryExport';
import { remittanceMonthRange } from '@/lib/payroll/remittancePeriod';

const pad = (n: number) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const previousMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const naira = (v: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(v);
const fmtDate = (iso: string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${iso}T00:00:00`));

const STATUS_STYLE: Record<string, string> = {
  overdue: 'bg-destructive/10 text-destructive',
  due_soon: 'bg-warning/10 text-warning',
  upcoming: 'bg-muted text-muted-foreground',
  no_date: 'bg-muted text-muted-foreground',
};
const STATUS_LABEL: Record<string, string> = { overdue: 'Overdue', due_soon: 'Due soon', upcoming: 'Upcoming', no_date: 'Check scheme' };
const CATEGORY_LABEL: Record<StatutoryReportCategory, string> = {
  tax: 'Statutory tax reports', payroll: 'Payroll & employee statutory reports', remittance_control: 'Remittance control reports', management: 'Management reports',
};

/** Nigeria: compliance calendar, liabilities and downloadable monthly statutory schedules. */
export function NigeriaStatutoryReports() {
  const { organization } = useCurrentOrganization();
  const [month, setMonth] = useState(previousMonth());
  const [salaryDate, setSalaryDate] = useState('');
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['ng-statutory', organization?.id, month],
    enabled: !!organization?.id && /^\d{4}-\d{2}$/.test(month),
    queryFn: async () => {
      const { startDate, endDate } = remittanceMonthRange(month, { nigeria: true });
      const { data: runs, error: runErr } = await supabase
        .from('pay_runs')
        .select('id, pay_date')
        .eq('organization_id', organization!.id)
        .eq('status', 'paid')
        .gte('pay_period_end', startDate)
        .lte('pay_period_end', endDate);
      if (runErr) throw runErr;
      if (!runs?.length) return { stubs: [] as NgScheduleStub[], employees: [] as NgScheduleEmployee[], payDate: '' };
      const { data: stubs, error: stubErr } = await supabase
        .from('pay_stubs')
        .select('employee_id, gross_pay, regular_earnings, overtime_earnings, bonus, commission, other_earnings, cpp_contribution, cpp_employer, ei_premium, ei_employer, federal_tax, provincial_tax, other_deductions, total_deductions, net_pay')
        .in('pay_run_id', runs.map((r) => r.id));
      if (stubErr) throw stubErr;
      const ids = [...new Set((stubs ?? []).map((s) => s.employee_id))];
      const { data: emps, error: empErr } = ids.length
        ? await supabase.from('employees').select('id, employee_number, first_name, last_name, province, department, bank_institution, bank_account, statutory_profile').in('id', ids)
        : { data: [], error: null };
      if (empErr) throw empErr;
      const payDate = runs.map((r) => r.pay_date).filter(Boolean).sort().pop() ?? '';
      return { stubs: (stubs ?? []) as NgScheduleStub[], employees: (emps ?? []) as unknown as NgScheduleEmployee[], payDate };
    },
  });

  // Default the salary payment date to the latest pay date in the month (editable).
  useEffect(() => { if (data?.payDate) setSalaryDate(data.payDate.slice(0, 10)); else setSalaryDate(''); }, [data?.payDate]);

  const schedules = useMemo(
    () => buildNgStatutorySchedules({ month, employees: data?.employees ?? [], stubs: data?.stubs ?? [], salaryPaymentDate: salaryDate || undefined }),
    [month, data, salaryDate],
  );
  const now = today();
  const hasPayroll = (data?.stubs.length ?? 0) > 0;
  const warnings = showAllWarnings ? schedules.warnings : schedules.warnings.slice(0, 4);

  const download = () => {
    try {
      downloadNgStatutoryWorkbook(schedules, organization?.name);
      toast.success(`Downloaded statutory schedules for ${month}`);
    } catch (e) {
      console.error(e);
      toast.error('Download failed. Please try again.');
    }
  };

  return (
    <Card className="p-5 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><CalendarClock className="w-5 h-5 text-primary" /> Nigeria statutory reports &amp; compliance calendar</h2>
          <p className="text-sm text-muted-foreground">PAYE, pension, NHF and NSITF schedules from paid pay runs, with filing and remittance deadlines (NTA/NTAA 2025, PRA 2014, NHF Act, ECA 2010).</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="ng-month" className="text-xs">Payroll month</Label>
            <Input id="ng-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ng-salary-date" className="text-xs">Salary payment date</Label>
            <Input id="ng-salary-date" type="date" value={salaryDate} onChange={(e) => setSalaryDate(e.target.value)} className="w-44" />
          </div>
          <Button onClick={download} disabled={!hasPayroll || isLoading}>
            <Download className="w-4 h-4 mr-2" /> Download schedules (Excel)
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive">Could not load payroll for {month}: {(error as Error).message}</p>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading payroll…</div>
      ) : !hasPayroll ? (
        <p className="text-sm text-muted-foreground">No paid pay runs end in {month}. The deadlines below still apply to any payroll you run for this month.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Employees', String(schedules.totals.headcount)],
            ['Gross pay', naira(schedules.totals.gross)],
            ['PAYE', naira(schedules.totals.paye)],
            ['Pension (8% + 10%)', naira(schedules.totals.pensionTotal)],
            ['NHF / NSITF', `${naira(schedules.totals.nhf)} / ${naira(schedules.totals.nsitf)}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-semibold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="data-table [&_th]:whitespace-nowrap">
          <thead className="bg-muted/50">
            <tr><th>Obligation</th><th>Authority</th><th>Due</th><th>Status</th><th className="text-right">Amount</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {schedules.calendar.map((c) => {
              const st = dueStatus(c.dueDate, now);
              const amount = c.id === 'paye' ? schedules.totals.paye
                : c.id === 'pension' ? schedules.totals.pensionTotal
                : c.id === 'nhf' ? schedules.totals.nhf
                : c.id === 'nsitf' ? schedules.totals.nsitf : null;
              return (
                <tr key={c.id}>
                  <td className="max-w-80">{c.activity}</td>
                  <td className="text-muted-foreground text-sm max-w-64">{c.authority}</td>
                  <td className="whitespace-nowrap">{c.dueDate ? fmtDate(c.dueDate) : '—'}</td>
                  <td><Badge className={STATUS_STYLE[st]}>{STATUS_LABEL[st]}</Badge></td>
                  <td className="text-right font-mono whitespace-nowrap">{hasPayroll && amount !== null ? naira(amount) : ''}</td>
                  <td className="text-xs text-muted-foreground max-w-96">
                    {[c.missingInput, c.onNonWorkingDay ? 'Falls on a weekend/holiday: pay by the previous working day.' : '', c.note, c.confirmWithAuthority ? 'Confirm with the authority.' : ''].filter(Boolean).join(' ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasPayroll && schedules.warnings.length > 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 space-y-1">
          <p className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Fix before filing ({schedules.warnings.length})</p>
          <ul className="list-disc pl-6 text-sm text-muted-foreground">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          {schedules.warnings.length > 4 && (
            <Button variant="link" size="sm" className="h-7 px-0" onClick={() => setShowAllWarnings((v) => !v)}>
              {showAllWarnings ? 'Show fewer' : `Show all ${schedules.warnings.length}`}
            </Button>
          )}
        </div>
      )}

      <div>
        <Button variant="ghost" size="sm" className="gap-2 px-0" onClick={() => setShowChecklist((v) => !v)}>
          <FileSpreadsheet className="w-4 h-4" /> Monthly reports checklist ({NIGERIA_STATUTORY_REPORTS.length})
          {showChecklist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
        {showChecklist && (
          <div className="grid md:grid-cols-3 gap-4 mt-2">
            {(['tax', 'payroll', 'remittance_control'] as StatutoryReportCategory[]).map((cat) => (
              <div key={cat} className="space-y-2">
                <p className="text-sm font-medium">{CATEGORY_LABEL[cat]}</p>
                <ul className="space-y-1.5">
                  {NIGERIA_STATUTORY_REPORTS.filter((r) => r.category === cat).map((r) => (
                    <li key={r.id} className="text-sm">
                      <span className="font-medium">{r.name}</span>
                      <span className="text-muted-foreground"> · {r.recipient}</span>
                      {r.applicability && <span className="block text-xs text-muted-foreground">{r.applicability}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
