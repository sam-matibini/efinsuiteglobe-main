import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CraModule } from '@/components/cra/CraModule';
import { formatWhen, statusTone } from '@/lib/cra/engine';
import type { CraNotice } from '@/lib/cra/types';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';

const SEVERITY = {
  action: 'Action required',
  review: 'Review',
  info: 'Information',
} as const;

export default function CraNotices() {
  const cra = useCraTaxCentre();
  const [open, setOpen] = useState<CraNotice | null>(null);

  return (
    <CraModule
      title="CRA notices"
      description="Notices shown here are limited to program accounts covered by the representative authorization."
    >
      <div className="space-y-3">
        {cra.ledger.notices.length === 0 ? <p className="text-sm text-muted-foreground">CRA has not returned any notices.</p> : null}
        {cra.ledger.notices.map((notice) => (
          <Card key={notice.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className={`inline-flex rounded px-2 py-0.5 text-xs ${statusTone(notice.severity)}`}>
                  {SEVERITY[notice.severity]}
                </div>
                <div className="mt-1 font-medium">{notice.title}</div>
                <div className="text-sm text-muted-foreground">{notice.program} · {formatWhen(notice.receivedAt)}{notice.read ? ' · Viewed' : ''}</div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  cra.markNoticeRead(notice.id);
                  setOpen(notice);
                }}
              >
                View
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{open?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{open?.body}</p>
        </DialogContent>
      </Dialog>
    </CraModule>
  );
}
