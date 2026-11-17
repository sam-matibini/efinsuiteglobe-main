import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CraModule } from '@/components/cra/CraModule';
import { FileReturnDialog } from '@/components/cra/FileReturnDialog';
import { formatCad } from '@/lib/cra/engine';
import { STATUS_LABEL, type WorkflowStatus } from '@/lib/cra/mypayment/workflow';
import { parseLocalDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useTaxReturns, useUpdateTaxReturn, type TaxReturn } from '@/hooks/useSalesTax';
import { useTaxReportPayments } from '@/hooks/useTaxReportPayments';

const STEPS = ['Prepare the return in Sales Tax', 'File on CRA', 'Pay through CRA My Payment', 'Confirmation recorded'];

const dayLabel = (date: string) => parseLocalDate(date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

function returnStatus(item: TaxReturn) {
  if (item.status === 'paid') return { label: 'Paid', tone: 'bg-emerald-500/10 text-emerald-700' };
  if (item.status === 'filed') return { label: 'Filed', tone: 'bg-sky-500/10 text-sky-700' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parseLocalDate(item.due_date) < today) return { label: 'Overdue', tone: 'bg-destructive/10 text-destructive' };
  return { label: 'Not filed', tone: 'bg-amber-500/10 text-amber-700' };
}

/** The confirmation number saved when the return was recorded as filed. */
function filingConfirmation(notes: string | null) {
  return notes?.match(/CRA filing confirmation ([A-Za-z0-9-]+)/)?.[1] ?? null;
}

export default function CraGstHst() {
  const cra = useCraTaxCentre();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const orgId = organization?.id;
  const { data: returns = [], isLoading } = useTaxReturns(orgId);
  const updateReturn = useUpdateTaxReturn();
  const { linkedByReport, startPayment } = useTaxReportPayments();
  const [filing, setFiling] = useState<TaxReturn | null>(null);
  const canPay = cra.can('prepare_payment');
  const canFile = cra.can('file_return');

  const pay = async (item: TaxReturn) => {
    try {
      await startPayment.mutateAsync({
        kind: 'gst_hst',
        id: item.id,
        amount: Number(item.net_payable),
        periodStart: item.period_start,
        periodEnd: item.period_end,
        periodLabel: item.period_name,
        dueDate: item.due_date,
      });
      navigate('/tax-cra/payments');
    } catch {
      // Error shown by the hook
    }
  };

  const recordFiling = async (input: { confirmationNumber: string; filedOn: string; channel: string }) => {
    if (!filing || !orgId) return 'Choose an organization first.';
    const note = `CRA filing confirmation ${input.confirmationNumber} (filed on ${input.channel}, ${input.filedOn})`;
    try {
      await updateReturn.mutateAsync({
        id: filing.id,
        organizationId: orgId,
        updates: {
          status: 'filed',
          filed_at: new Date(`${input.filedOn}T12:00:00`).toISOString(),
          filed_by: user?.id ?? null,
          notes: filing.notes ? `${filing.notes}\n${note}` : note,
        },
      });
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'The filing was not saved.';
    }
  };

  return (
    <CraModule
      title="GST/HST"
      description="GST/HST returns are prepared in Sales Tax. File each one on CRA, record the confirmation here, and pay the balance through CRA My Payment. Filing and paying stay separate."
      actions={
        <Button asChild variant="outline">
          <Link to="/tax">Prepare returns in Sales Tax</Link>
        </Button>
      }
    >
      <ol className="grid gap-2 md:grid-cols-4">
        {STEPS.map((label, index) => (
          <li key={label} className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>GST/HST returns</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading returns…</p>
          ) : returns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No GST/HST returns yet. Prepare one in <Link to="/tax" className="text-primary underline">Sales Tax</Link>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Period</th>
                    <th className="py-2 pr-3 font-medium">Due</th>
                    <th className="py-2 pr-3 text-right font-medium">Collected</th>
                    <th className="py-2 pr-3 text-right font-medium">ITCs</th>
                    <th className="py-2 pr-3 text-right font-medium">Net tax</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">CRA payment</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {returns.map((item) => {
                    const status = returnStatus(item);
                    const linked = linkedByReport.get(item.id);
                    const net = Number(item.net_payable);
                    const confirmation = filingConfirmation(item.notes);
                    return (
                      <tr key={item.id} className="border-t align-top">
                        <td className="py-2 pr-3 font-medium">
                          {item.period_name}
                          <span className="block text-xs text-muted-foreground">{dayLabel(item.period_start)} – {dayLabel(item.period_end)}</span>
                        </td>
                        <td className="py-2 pr-3">{dayLabel(item.due_date)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{formatCad(Number(item.tax_collected))}</td>
                        <td className="py-2 pr-3 text-right font-mono">{formatCad(Number(item.tax_paid))}</td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {formatCad(net)}
                          {net < 0 ? <span className="block text-xs text-muted-foreground">Refund</span> : null}
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`rounded px-2 py-0.5 text-xs ${status.tone}`}>{status.label}</span>
                          {confirmation ? <div className="mt-1 text-xs text-muted-foreground">Filing {confirmation}</div> : null}
                          {item.payment_reference ? <div className="text-xs text-muted-foreground">Payment {item.payment_reference}</div> : null}
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
                        <td className="py-2">
                          <div className="flex flex-wrap justify-end gap-2">
                            {item.status === 'draft' ? (
                              <Button size="sm" variant="outline" onClick={() => setFiling(item)} disabled={!canFile}>
                                File on CRA
                              </Button>
                            ) : null}
                            {linked ? (
                              <Button asChild size="sm" variant="outline">
                                <Link to="/tax-cra/payments">Open in CRA Payments</Link>
                              </Button>
                            ) : item.status !== 'paid' && net > 0 ? (
                              <Button size="sm" onClick={() => pay(item)} disabled={!canPay || startPayment.isPending}>
                                Pay
                              </Button>
                            ) : null}
                          </div>
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

      {filing ? (
        <FileReturnDialog
          open
          onOpenChange={(open) => !open && setFiling(null)}
          title={`File GST/HST return · ${filing.period_name}`}
          returnType="GST34"
          taxYear={filing.period_end.slice(0, 4)}
          account="RT0001"
          obligationId={filing.id}
          summary={[
            { label: 'Period', value: `${dayLabel(filing.period_start)} – ${dayLabel(filing.period_end)}` },
            { label: 'GST/HST collected', value: formatCad(Number(filing.tax_collected)) },
            { label: 'Input tax credits', value: formatCad(Number(filing.tax_paid)) },
            { label: 'Net tax', value: formatCad(Number(filing.net_payable)) },
          ]}
          onRecord={recordFiling}
        />
      ) : null}
    </CraModule>
  );
}
