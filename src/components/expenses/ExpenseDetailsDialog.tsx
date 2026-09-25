import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Receipt, Car } from 'lucide-react';
import { format } from 'date-fns';
import type { Expense } from '@/hooks/useExpenses';
import { ApprovalPanel } from '@/components/approvals/ApprovalPanel';

interface Props {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function fmt(n: number | null | undefined, cur = 'CAD') {
  if (n == null) return '—';
  return `${cur} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm py-1.5 border-b border-border/50 last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2 font-medium">{children ?? '—'}</div>
    </div>
  );
}

export function ExpenseDetailsDialog({ expense, open, onOpenChange }: Props) {
  if (!expense) return null;
  const isMileage = expense.expense_type === 'mileage';
  const cur = expense.currency || 'CAD';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isMileage ? <Car className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
            Expense Details
            <Badge variant={expense.is_posted ? 'default' : 'secondary'} className="ml-2">
              {expense.is_posted ? 'Posted' : 'Draft'}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {expense.reference ? `Ref ${expense.reference}` : `ID ${expense.id.slice(0, 8)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Row label="Date">{format(new Date(expense.expense_date), 'PPP')}</Row>
          <Row label="Type">
            <Badge variant="outline">{isMileage ? 'Mileage' : 'Expense'}</Badge>
          </Row>
          <Row label="Vendor">{expense.vendor?.name}</Row>
          <Row label="Customer">{expense.customer?.name}</Row>
          <Row label="Expense Account">
            {expense.expense_account ? `${expense.expense_account.code} — ${expense.expense_account.name}` : null}
          </Row>
          <Row label="Paid Through">
            {expense.paid_through_account ? `${expense.paid_through_account.code} — ${expense.paid_through_account.name}` : null}
          </Row>
          <Row label="Reference">{expense.reference}</Row>
          <Row label="Amount">{fmt(Number(expense.amount), cur)}</Row>
          <Row label="Tax">{fmt(Number(expense.tax_amount || 0), cur)} ({expense.tax_treatment})</Row>
          <Row label="Total">{fmt(Number(expense.amount) + Number(expense.tax_amount || 0), cur)}</Row>
          <Row label="Billable">{expense.is_billable ? 'Yes' : 'No'}</Row>

          {isMileage && (
            <>
              <Row label="From">{expense.from_location}</Row>
              <Row label="To">{expense.to_location}</Row>
              <Row label="Distance">
                {expense.distance != null ? `${expense.distance} ${expense.distance_unit || 'km'}` : null}
              </Row>
              <Row label="Rate">{expense.rate_per_unit != null ? fmt(Number(expense.rate_per_unit), cur) : null}</Row>
              <Row label="Vehicle">{expense.vehicle_description}</Row>
            </>
          )}

          <Row label="Notes">
            <span className="whitespace-pre-wrap">{expense.notes}</span>
          </Row>
          <Row label="Created">{format(new Date(expense.created_at), 'PPp')}</Row>
        </div>

        <ApprovalPanel
          documentType="expense"
          documentId={expense.id}
          amount={(Number(expense.amount) || 0) + (Number(expense.tax_amount) || 0)}
          preparedBy={(expense as any).created_by ?? null}
          status={(expense as any).approval_status}
          isPosted={!!expense.is_posted}
        />
      </DialogContent>
    </Dialog>
  );
}
