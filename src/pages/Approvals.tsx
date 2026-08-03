import { useState } from 'react';
import { CheckCircle2, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { usePendingApprovals, useApprovalActions, useIsApprover } from '@/hooks/useApprovals';
import { APPROVAL_DOCUMENT_LABELS } from '@/lib/approvals';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { parseLocalDate } from '@/lib/utils';

export default function Approvals() {
  const { user } = useAuth();
  const { organization } = useCurrentOrganization();
  const { data: rows = [], isLoading } = usePendingApprovals();
  const { approveAndPost, reject } = useApprovalActions();
  const { data: isBillApprover } = useIsApprover('bill');
  const [busyId, setBusyId] = useState<string | null>(null);

  const countryCode = organization?.country || 'CA';
  const locale = getLocaleForCountry(countryCode);
  const currency = organization?.currency || getCountryLocalization(countryCode).currency;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(value) || 0);

  const formatDate = (d?: string | null) =>
    d
      ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(
          parseLocalDate(d),
        )
      : '—';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
        <p className="text-muted-foreground">
          Approve purchase documents to post them to the General Ledger.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Pending approval
            <Badge variant="secondary">{rows.length}</Badge>
          </CardTitle>
          <CardDescription>
            Bills, expense claims and direct expenses waiting for approval. Preparers cannot approve
            their own documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing is waiting for approval.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const isPreparer = !!row.preparedBy && row.preparedBy === user?.id;
                  const doc = {
                    id: row.id,
                    documentType: row.documentType,
                    amount: row.amount,
                    preparedBy: row.preparedBy,
                  };
                  const busy = busyId === row.id;
                  return (
                    <TableRow key={`${row.documentType}-${row.id}`}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {APPROVAL_DOCUMENT_LABELS[row.documentType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{row.party}</TableCell>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPreparer ? (
                          <span className="text-xs text-muted-foreground">
                            You prepared this — another approver is required
                          </span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                setBusyId(row.id);
                                approveAndPost.mutate(
                                  { doc },
                                  { onSettled: () => setBusyId(null) },
                                );
                              }}
                            >
                              <CheckCircle2 className="mr-1 h-4 w-4" /> Approve &amp; Post
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setBusyId(row.id);
                                reject.mutate(
                                  { doc, action: 'returned' },
                                  { onSettled: () => setBusyId(null) },
                                );
                              }}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => {
                                setBusyId(row.id);
                                reject.mutate(
                                  { doc, action: 'rejected' },
                                  { onSettled: () => setBusyId(null) },
                                );
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {!isBillApprover && (
            <p className="mt-4 text-xs text-muted-foreground">
              You are not a designated approver. Approvers are managed in Settings → Approvals.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
