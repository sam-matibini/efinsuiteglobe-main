import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { parseLocalDate } from '@/lib/utils';
import { PurchaseAttachmentsSection } from '@/components/purchases/PurchaseAttachmentsSection';
import { ApprovalPanel } from '@/components/approvals/ApprovalPanel';

interface ViewBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: any | null;
}

interface BillLineRow {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_rate: number | null;
  tax_amount: number | null;
  line_order: number;
  expense_account_id: string | null;
  account?: { code: string; name: string } | null;
}

export function ViewBillDialog({ open, onOpenChange, bill }: ViewBillDialogProps) {
  const { organization } = useCurrentOrganization();
  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: bill?.currency || localization.currency,
      minimumFractionDigits: 2,
    }).format(Number(value) || 0);

  const formatDate = (date?: string | null) =>
    date
      ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(
          parseLocalDate(date),
        )
      : '—';

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['bill-lines', bill?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bill_lines')
        .select('*, account:accounts!bill_lines_expense_account_id_fkey(code, name)')
        .eq('bill_id', bill.id)
        .order('line_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BillLineRow[];
    },
    enabled: open && !!bill?.id,
  });

  const { data: journalEntry } = useQuery({
    queryKey: ['bill-journal-entry', bill?.journal_entry_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id, reference, status, entry_date')
        .eq('id', bill.journal_entry_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!bill?.journal_entry_id,
  });

  const handlePrint = () => {
    if (!bill) return;
    const rows = lines
      .map(
        (l) => `<tr>
          <td>${escapeHtml(l.description)}</td>
          <td>${escapeHtml(l.account?.code ?? '')}</td>
          <td class="num">${Number(l.quantity)}</td>
          <td class="num">${formatCurrency(Number(l.unit_price))}</td>
          <td class="num">${Number(l.tax_rate ?? 0)}%</td>
          <td class="num">${formatCurrency(Number(l.amount))}</td>
        </tr>`,
      )
      .join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Bill ${escapeHtml(
      bill.bill_number,
    )}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#111}
      h1{font-size:20px;margin:0 0 4px}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
      th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
      .num{text-align:right}
      .totals{margin-top:16px;width:260px;margin-left:auto;font-size:13px}
      .totals div{display:flex;justify-content:space-between;padding:3px 0}
    </style></head><body>
      <h1>Bill ${escapeHtml(bill.bill_number)}</h1>
      <div>${escapeHtml(organization?.name ?? '')}</div>
      <p>
        <strong>Vendor:</strong> ${escapeHtml(bill.vendor?.name ?? 'Unknown Vendor')}<br/>
        <strong>Bill Date:</strong> ${formatDate(bill.bill_date)}<br/>
        <strong>Due Date:</strong> ${formatDate(bill.due_date)}<br/>
        <strong>Status:</strong> ${escapeHtml(bill.status)}
      </p>
      <table><thead><tr>
        <th>Description</th><th>Account</th><th class="num">Qty</th>
        <th class="num">Price</th><th class="num">Tax</th><th class="num">Amount</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <div class="totals">
        <div><span>Subtotal</span><span>${formatCurrency(Number(bill.subtotal))}</span></div>
        <div><span>Tax</span><span>${formatCurrency(Number(bill.tax_amount))}</span></div>
        <div><strong>Total</strong><strong>${formatCurrency(Number(bill.total))}</strong></div>
        <div><span>Paid</span><span>${formatCurrency(Number(bill.amount_paid || 0))}</span></div>
        <div><strong>Balance Due</strong><strong>${formatCurrency(
          Number(bill.balance_due || 0),
        )}</strong></div>
      </div>
    </body></html>`;

    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        win.focus();
        win.print();
      });
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  if (!bill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap">
            <span className="font-mono">Bill {bill.bill_number}</span>
            <Badge className={cn('capitalize', BILL_STATUS_STYLES[bill.status] ?? BILL_STATUS_STYLES.draft)}>
              {bill.status}
            </Badge>
            {bill.approval_status === 'rejected' && (
              <Badge className="bg-destructive/10 text-destructive">Rejected</Badge>
            )}
          </DialogTitle>
          <DialogDescription>{bill.vendor?.name || 'Unknown Vendor'}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Bill Date</p>
            <p className="font-medium">{formatDate(bill.bill_date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Due Date</p>
            <p className="font-medium">{formatDate(bill.due_date)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Terms</p>
            <p className="font-medium">{bill.terms || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Journal Entry</p>
            <p className="font-medium font-mono">
              {journalEntry ? `${journalEntry.reference} (${journalEntry.status})` : 'Not posted'}
            </p>
          </div>
        </div>

        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Description</th>
                <th className="text-left p-3 w-32">Account</th>
                <th className="text-right p-3 w-16">Qty</th>
                <th className="text-right p-3 w-28">Price</th>
                <th className="text-right p-3 w-16">Tax %</th>
                <th className="text-right p-3 w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-3">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ) : lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    No line items recorded for this bill.
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id} className="border-t">
                    <td className="p-3">{line.description}</td>
                    <td className="p-3 font-mono text-xs" title={line.account?.name || ''}>
                      {line.account?.code || '—'}
                    </td>
                    <td className="p-3 text-right font-mono">{Number(line.quantity)}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(Number(line.unit_price))}</td>
                    <td className="p-3 text-right font-mono">{Number(line.tax_rate ?? 0)}%</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(Number(line.amount))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatCurrency(Number(bill.subtotal))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-mono">{formatCurrency(Number(bill.tax_amount))}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(Number(bill.total))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span className="font-mono">{formatCurrency(Number(bill.amount_paid || 0))}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Balance Due</span>
              <span className="font-mono">{formatCurrency(Number(bill.balance_due || 0))}</span>
            </div>
          </div>
        </div>

        {bill.notes && (
          <div className="text-sm">
            <p className="text-muted-foreground mb-1">Notes</p>
            <p className="whitespace-pre-wrap">{bill.notes}</p>
          </div>
        )}

        <ApprovalPanel
          documentType="bill"
          documentId={bill.id}
          amount={Number(bill.total) || 0}
          preparedBy={bill.prepared_by ?? bill.created_by ?? null}
          status={bill.approval_status}
          isPosted={!!bill.journal_entry_id}
        />

        <div className="rounded-lg border p-4">
          <PurchaseAttachmentsSection
            entityType="bill"
            entityId={bill.id}
            organizationId={organization?.id}
            readOnly
          />
        </div>


        <DialogFooter>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print / PDF
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
