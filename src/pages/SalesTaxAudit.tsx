import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { useBankingTaxAudit, TaxAuditRow } from '@/hooks/useBankingTaxAudit';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);

const ISSUE_LABEL: Record<TaxAuditRow['issue'], { label: string; tone: 'amber' | 'red' }> = {
  missing_tax: { label: 'No tax code applied', tone: 'amber' },
  unmapped_tax_code: { label: 'Tax code unmapped', tone: 'red' },
  no_tax_on_taxable_account: { label: 'Missing tax line', tone: 'red' },
};

export default function SalesTaxAudit() {
  const { currentOrganization } = useOrganizationContext();
  const { data: rows = [], isLoading, error } = useBankingTaxAudit(currentOrganization?.id);

  const grouped = useMemo(() => {
    const missing = rows.filter((r) => r.issue === 'missing_tax');
    const unmapped = rows.filter((r) => r.issue === 'unmapped_tax_code');
    return { missing, unmapped };
  }, [rows]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sales Tax Audit</h1>
        <p className="text-muted-foreground text-sm">
          Posted bank and credit-card transactions whose journal entries do not
          include a GST/HST/PST line. Open each transaction to add a tax code
          and re-post it to the General Ledger.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Scanning ledger…
        </div>
      )}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-destructive text-sm">
            Failed to load audit: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (
        <>
          <SummaryGrid
            unmapped={grouped.unmapped.length}
            missing={grouped.missing.length}
            total={rows.length}
          />

          {grouped.unmapped.length > 0 && (
            <Section
              title="Tax code selected but not posted"
              description="A sales tax code was attached, but no tax line landed on the journal entry — usually because the tax code is missing its GL account mapping."
              rows={grouped.unmapped}
            />
          )}

          <Section
            title="Categorized without a tax code"
            description="Transactions posted directly to a revenue/expense account with no tax code. Review and re-post if sales tax should have applied."
            rows={grouped.missing}
          />
        </>
      )}
    </div>
  );
}

function SummaryGrid({ unmapped, missing, total }: { unmapped: number; missing: number; total: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total flagged</CardDescription>
          <CardTitle className="text-3xl">{total}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader className="pb-2">
          <CardDescription className="text-destructive">Tax code unmapped</CardDescription>
          <CardTitle className="text-3xl text-destructive">{unmapped}</CardTitle>
        </CardHeader>
      </Card>
      <Card className="border-amber-500/40">
        <CardHeader className="pb-2">
          <CardDescription className="text-amber-600">Missing tax code</CardDescription>
          <CardTitle className="text-3xl text-amber-600">{missing}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}

function Section({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: TaxAuditRow[];
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">None.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {title}
              <Badge variant="secondary">{rows.length}</Badge>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Posted to</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 250).map((r) => {
                const meta = ISSUE_LABEL[r.issue];
                const link =
                  r.source === 'bank'
                    ? `/banking/transactions?account=${r.bankAccountId}&open=${r.transactionId}`
                    : `/banking/credit-cards/${r.creditCardId}/transactions?open=${r.transactionId}`;
                return (
                  <TableRow key={`${r.source}-${r.transactionId}`}>
                    <TableCell className="whitespace-nowrap">{r.transactionDate}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium">{r.accountName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.source === 'bank' ? 'Bank' : 'Credit Card'}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      <div>{r.description}</div>
                      {r.payeePayor && (
                        <div className="text-xs text-muted-foreground">{r.payeePayor}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Math.abs(r.amount))}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {r.glAccountName ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={meta.tone === 'red' ? 'destructive' : 'secondary'}
                        className={
                          meta.tone === 'amber'
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                            : ''
                        }
                      >
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={link}>
                          Open <ExternalLink className="h-3 w-3 ml-1" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length > 250 && (
            <div className="p-3 text-xs text-muted-foreground">
              Showing first 250 of {rows.length} flagged transactions.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
