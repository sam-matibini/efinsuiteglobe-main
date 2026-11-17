import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { REPRESENT_A_CLIENT_URL } from '@/lib/cra/mypayment/catalog';
import type { EfileReturnType } from '@/lib/cra/types';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

const GST_NETFILE_URL = 'https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/gst-hst-netfile.html';
const CORPORATION_INTERNET_FILING_URL =
  'https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/corporation-internet-filing.html';

interface Channel {
  label: string;
  url: string;
}

/** Where CRA accepts each return. eFinsuite only links to these official pages. */
function channelsFor(returnType: EfileReturnType): { channels: Channel[]; guidance: string } {
  if (returnType === 'GST34') {
    return {
      channels: [
        { label: 'Represent a Client', url: REPRESENT_A_CLIENT_URL },
        { label: 'GST/HST NETFILE', url: GST_NETFILE_URL },
      ],
      guidance:
        'Sign in to Represent a Client (or use GST/HST NETFILE) and enter the figures below. CRA shows a confirmation number when it accepts the return.',
    };
  }
  return {
    channels: [{ label: 'Corporation Internet Filing', url: CORPORATION_INTERNET_FILING_URL }],
    guidance:
      'CRA accepts a T2 only from CRA-certified T2 software through Corporation Internet Filing. File it there, then record the confirmation CRA returns.',
  };
}

/**
 * Prepare-and-record filing: the user files on CRA's own channel and eFinsuite stores the
 * confirmation number. Nothing here transmits a return or signs in to CRA.
 */
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
  const { channels, guidance } = channelsFor(returnType);
  const today = new Date().toISOString().slice(0, 10);
  const [confirmation, setConfirmation] = useState('');
  const [filedOn, setFiledOn] = useState(today);
  const [channel, setChannel] = useState(channels[0].label);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setConfirmation('');
    setFiledOn(new Date().toISOString().slice(0, 10));
    setChannel(channelsFor(returnType).channels[0].label);
    setError('');
  }, [open, returnType]);

  const record = () => {
    const result = cra.recordFiling({ returnType, obligationId, taxYear, account, confirmationNumber: confirmation, filedOn, channel });
    if (result.ok === false) setError(result.error);
    else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            File {returnType} for BN {cra.ledger.profile.businessNumber || '—'} on CRA, then record the confirmation here. Filing does not move money.
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
            <dt className="text-muted-foreground">Account</dt>
            <dd>{account}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tax year</dt>
            <dd>{taxYear}</dd>
          </div>
        </dl>

        <div className="space-y-2 rounded-md border p-3 text-sm">
          <div className="font-medium">1. File on CRA</div>
          <p className="text-muted-foreground">{guidance}</p>
          <div className="flex flex-wrap gap-2">
            {channels.map((item) => (
              <Button key={item.url} asChild variant="outline" size="sm" onClick={() => setChannel(item.label)}>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {item.label} <ExternalLink className="ml-1 h-3.5 w-3.5" />
                </a>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-3 text-sm">
          <div className="font-medium">2. Record CRA's confirmation</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="cra-filing-confirmation">Confirmation number</Label>
              <Input id="cra-filing-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cra-filing-date">Date filed</Label>
              <Input id="cra-filing-date" type="date" max={today} value={filedOn} onChange={(event) => setFiledOn(event.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Filed through {channel}. The return is marked filed only after you record CRA's confirmation.</p>
          {error ? <p className="text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={record} disabled={!cra.can('file_return') || !confirmation.trim()}>
            Record filing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
