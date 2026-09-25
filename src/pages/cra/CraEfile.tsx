import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CraModule } from '@/components/cra/CraModule';
import { formatWhen, statusTone } from '@/lib/cra/engine';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export default function CraEfile() {
  const cra = useCraTaxCentre();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = cra.ledger.submissions.find((item) => item.id === selectedId) ?? null;

  return (
    <CraModule
      title="EFILE gateway"
      description="Certified software submits supported returns to CRA web services. Represent a Client does not replace EFILE. T1 and T3 appear when the authorization covers them; this corporation files a T2."
    >
      <Card>
        <CardHeader>
          <CardTitle>Path</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>eFinsuite → EFILE gateway → T1 · T2/T3 · GST34 · PD7A · ReFILE → CRA web services → CRA</div>
          <div className="text-muted-foreground">
            Each submission keeps an ID, business number, tax year, return type, date and time, CRA response, confirmation, errors, and status.
          </div>
        </CardContent>
      </Card>
      {cra.ledger.submissions.length === 0 ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            No submissions yet. File a GST/HST return or a T2 and the gateway will list it here. Payment is still a separate action.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Submission', 'Client', 'Return', 'Year', 'Submitted', 'Status', 'Confirmation', ''].map((heading) => (
                  <th key={heading} className="px-3 py-2 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cra.ledger.submissions.map((submission) => (
                <tr key={submission.id} className="border-t">
                  <td className="px-3 py-2">{submission.id}</td>
                  <td className="px-3 py-2">{submission.clientName}<div className="text-muted-foreground">{submission.clientBn}</div></td>
                  <td className="px-3 py-2">{submission.returnType}</td>
                  <td className="px-3 py-2">{submission.taxYear}</td>
                  <td className="px-3 py-2">{submission.submittedAt ? formatWhen(submission.submittedAt) : '—'}</td>
                  <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${statusTone(submission.status)}`}>{submission.status}</span></td>
                  <td className="px-3 py-2">{submission.confirmationNumber ?? '—'}</td>
                  <td className="px-3 py-2">
                    <Button variant="link" className="h-auto p-0" onClick={() => setSelectedId(submission.id)}>View submission</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog open={Boolean(selected)} onOpenChange={(next) => !next && setSelectedId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.returnType} · {selected?.id}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-2 text-sm">
              <div>Client {selected.clientName}</div>
              <div>BN {selected.clientBn}</div>
              <div>Tax year {selected.taxYear}</div>
              <div>Status {selected.status}</div>
              <div>CRA response {selected.craResponse ?? 'Waiting'}</div>
              <div>Confirmation {selected.confirmationNumber ?? '—'}</div>
              {selected.errors.length ? <div className="text-destructive">{selected.errors.join(' ')}</div> : null}
              {selected.status === 'submitted' ? (
                <Button onClick={() => cra.acknowledgeEfile(selected.id)}>Retrieve CRA acknowledgement</Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </CraModule>
  );
}
