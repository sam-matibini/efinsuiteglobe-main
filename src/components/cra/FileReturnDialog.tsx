import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { EfileReturnType } from '@/lib/cra/types';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

export function FileReturnDialog({
  open,
  onOpenChange,
  title,
  returnType,
  taxYear,
  account,
  obligationId,
  summary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  returnType: EfileReturnType;
  taxYear: string;
  account: string;
  obligationId: string;
  summary: { label: string; value: string }[];
}) {
  const cra = useCraTaxCentre();
  const [submissionId, setSubmissionId] = useState<string | undefined>();

  useEffect(() => {
    if (open) setSubmissionId(undefined);
  }, [open]);

  const submission = cra.ledger.submissions.find((item) => item.id === submissionId);

  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await cra.submitEfile({ returnType, obligationId, taxYear, account });
      if (result.id) setSubmissionId(result.id);
    } finally {
      setBusy(false);
    }
  };

  const acknowledge = async () => {
    if (!submissionId) return;
    setBusy(true);
    try {
      await cra.acknowledgeEfile(submissionId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {returnType} is sent through the EFILE gateway for BN {cra.ledger.profile.businessNumber}. Filing does not move money.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {summary.map((row) => (
            <div key={row.label}>
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
          <div>
            <dt className="text-muted-foreground">Return</dt>
            <dd>{returnType}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tax year</dt>
            <dd>{taxYear}</dd>
          </div>
        </dl>
        {submission ? (
          <div className="rounded-md border p-3 text-sm">
            <div>Submission {submission.id}</div>
            <div className="capitalize">Status: {submission.status}</div>
            {submission.confirmationNumber ? <div>CRA confirmation: {submission.confirmationNumber}</div> : null}
            {submission.errors.length ? <div className="text-destructive">{submission.errors.join(' ')}</div> : null}
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button asChild variant="link" className="h-auto px-0">
            <Link to="/tax-cra/efile">EFILE gateway</Link>
          </Button>
          <div className="flex gap-2">
            {!submission ? (
              <Button onClick={submit} disabled={!cra.can('file_return') || busy}>
                Submit to EFILE
              </Button>
            ) : null}
            {submission?.status === 'submitted' ? (
              <Button onClick={acknowledge} disabled={busy}>Retrieve CRA acknowledgement</Button>
            ) : null}
            {submission?.status === 'accepted' ? <Button onClick={() => onOpenChange(false)}>Close</Button> : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
