import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CraModule } from '@/components/cra/CraModule';
import { PayCraDialog } from '@/components/cra/PayCraDialog';
import { formatCad, formatDay, formatWhen, isReconciled, paymentLabel, statusTone } from '@/lib/cra/engine';
import type { CraPayment, PaymentStatus } from '@/lib/cra/types';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

const PIPELINE: PaymentStatus[] = ['draft', 'authorized', 'submitted', 'processing', 'accepted', 'settled', 'confirmed'];

export default function CraRemittances() {
  const cra = useCraTaxCentre();
  const [payOpen, setPayOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(cra.ledger.payments[0]?.id ?? null);
  const [confirmation, setConfirmation] = useState('CRA-');
  const payment = cra.ledger.payments.find((item) => item.id === selected) ?? cra.ledger.payments[0];

  return (
    <CraModule
      title="Tax remittances"
      description="CRA payments move through draft, authorization, submission, and settlement. A payment is reconciled only after the wallet, the bank, and CRA all agree."
      actions={
        <Button onClick={() => setPayOpen(true)} disabled={!cra.can('prepare_payment')}>
          Pay CRA
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cra.ledger.payments.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${payment?.id === item.id ? 'border-primary' : ''}`}
              >
                <span>
                  <span className="font-medium">{item.id}</span>
                  <span className="block text-muted-foreground">{item.account} · {item.purpose}</span>
                </span>
                <span className="text-right">
                  <span className="block">{formatCad(item.amount)}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${statusTone(item.status)}`}>{paymentLabel(item.status)}</span>
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
        {payment ? <PaymentDetail cra={cra} payment={payment} confirmation={confirmation} setConfirmation={setConfirmation} /> : null}
      </div>
      <Button asChild variant="link" className="h-auto p-0">
        <Link to="/tax-cra/reconciliation">Open CRA reconciliation in Reports</Link>
      </Button>
      <PayCraDialog open={payOpen} onOpenChange={setPayOpen} />
    </CraModule>
  );
}

function PaymentDetail({
  cra,
  payment,
  confirmation,
  setConfirmation,
}: {
  cra: ReturnType<typeof useCraTaxCentre>;
  payment: CraPayment;
  confirmation: string;
  setConfirmation: (value: string) => void;
}) {
  const index = PIPELINE.indexOf(payment.status);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{payment.id}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-1">
          {PIPELINE.map((status, step) => (
            <span key={status} className={`rounded px-2 py-1 text-xs ${step <= index && index >= 0 ? 'bg-primary/15' : 'bg-muted text-muted-foreground'}`}>
              {paymentLabel(status)}
            </span>
          ))}
        </div>
        <div>Prepared by {payment.preparedBy}</div>
        {payment.approvedBy ? <div>Approved by {payment.approvedBy}</div> : <div>Approved by — waiting</div>}
        <div>Released by {payment.releasedAt ? `eFinsuite payment engine · ${formatWhen(payment.releasedAt)}` : 'eFinsuite payment engine'}</div>
        <div>Payment date {formatDay(payment.paymentDate)} · Due {formatDay(payment.dueDate)}</div>
        <div>Wallet {payment.walletDeduction ? formatCad(-payment.walletDeduction) : '—'} · Bank {payment.bankSettlement ? formatCad(-payment.bankSettlement) : '—'}</div>
        <div>CRA confirmation {payment.craConfirmation ?? '—'} · {isReconciled(payment) ? '✓ Reconciled' : 'Not reconciled'}</div>
        {payment.failureReason ? <div className="text-destructive">{payment.failureReason}</div> : null}
        <Journal title="Before settlement" lines={payment.glAccrual} />
        <Journal title="After settlement" lines={payment.glSettlement} />
        <div className="flex flex-wrap gap-2">
          {payment.status === 'draft' ? (
            <Button size="sm" onClick={() => cra.approvePayment(payment.id)} disabled={!cra.can('approve_payment')}>
              Approve
            </Button>
          ) : null}
          {payment.status === 'authorized' ? (
            <Button size="sm" onClick={() => cra.releasePayment(payment.id)} disabled={!cra.can('approve_payment')}>
              Release
            </Button>
          ) : null}
          {['submitted', 'processing', 'accepted'].includes(payment.status) ? (
            <Button size="sm" variant="outline" onClick={() => cra.pollPayment(payment.id)}>
              Poll status
            </Button>
          ) : null}
          {payment.status === 'settled' ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input className="h-9 w-44" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              <Button size="sm" onClick={() => cra.recordConfirmation(payment.id, confirmation)}>
                Record CRA confirmation
              </Button>
            </div>
          ) : null}
          {payment.status === 'draft' || payment.status === 'authorized' ? (
            <Button size="sm" variant="ghost" onClick={() => cra.recordException(payment.id, 'cancelled', 'Cancelled before release')}>
              Cancel
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground">
          Four-eyes control: {payment.preparedByName} prepared this payment. The approver must be a different user with pay permission.
        </p>
      </CardContent>
    </Card>
  );
}

function Journal({ title, lines }: { title: string; lines: CraPayment['glAccrual'] }) {
  if (!lines.length) return null;
  return (
    <div>
      <div className="mb-1 font-medium">{title}</div>
      {lines.map((line) => (
        <div key={`${line.account}-${line.memo}`} className="flex justify-between gap-3">
          <span>{line.debit ? 'Dr.' : 'Cr.'} {line.account}</span>
          <span>{formatCad(line.debit || line.credit)}</span>
        </div>
      ))}
    </div>
  );
}
