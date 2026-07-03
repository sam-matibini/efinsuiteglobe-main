import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ShieldCheck, AlertTriangle } from 'lucide-react';
import { usePadAgreements } from '@/hooks/usePadAgreements';
import { PadAgreementDialog } from '@/components/treasury/PadAgreementDialog';
import { useFundingBankAccounts } from '@/hooks/useFundingBankAccounts';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { format } from 'date-fns';

export function PadAgreementsCard() {
  const { pads, isLoading, revoke } = usePadAgreements({ scope: 'cra' });
  const { accounts } = useFundingBankAccounts();
  const isReadOnly = useIsReadOnly();
  const [dialogOpen, setDialogOpen] = useState(false);

  const bankName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? '—';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Pre-Authorized Debit (PAD) Agreements
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Required by Payments Canada Rule H1 before efinsuite can debit your bank account for CRA
            remittances via EFT. One PAD per funding bank account.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={isReadOnly}>
          <Plus className="mr-1 h-4 w-4" /> New PAD
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : pads.length === 0 ? (
          <div className="flex items-center gap-2 rounded border border-dashed p-4 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            No PAD agreements on file. EFT-rail CRA remittances will be blocked until you capture one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bank account</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Per-debit cap</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Signed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pads.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{bankName(p.bank_account_id)}</TableCell>
                  <TableCell>
                    <div>{p.payer_name}</div>
                    {p.payer_title && <div className="text-xs text-muted-foreground">{p.payer_title}</div>}
                  </TableCell>
                  <TableCell>
                    {p.max_amount_per_debit
                      ? `CAD ${Number(p.max_amount_per_debit).toLocaleString()}`
                      : '—'}
                  </TableCell>
                  <TableCell className="capitalize">{p.frequency}</TableCell>
                  <TableCell>{p.accepted_at ? format(new Date(p.accepted_at), 'yyyy-MM-dd') : '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={p.status === 'active' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {p.status === 'active' && !isReadOnly && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => revoke.mutate({ id: p.id, reason: 'Revoked from Treasury Settings' })}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <PadAgreementDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
}
