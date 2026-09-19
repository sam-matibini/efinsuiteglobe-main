import { Check, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatQbPeriodLong } from '@/lib/gstHstStatement';
import type { TaxReturn } from '@/hooks/useSalesTax';

export interface SalesTaxFilingRow {
  id: string;
  taxLabel: string;
  periodStart: string;
  periodEnd: string;
  net: number;
  status: TaxReturn['status'] | 'draft';
  isSynthetic?: boolean;
}

interface SalesTaxFilingsProps {
  rows: SalesTaxFilingRow[];
  formatCurrency: (value: number) => string;
  isReadOnly?: boolean;
  onPrepareReturn: (row: SalesTaxFilingRow) => void;
  onViewSummary: (row: SalesTaxFilingRow) => void;
  onViewDetail: (row: SalesTaxFilingRow) => void;
  onUndoFiling?: (row: SalesTaxFilingRow) => void;
}

function Stepper({ status }: { status: SalesTaxFilingRow['status'] }) {
  const prepared = true;
  const filed = status === 'filed' || status === 'paid';
  const paid = status === 'paid';
  const steps = [
    { n: 1, label: 'Prepared', done: prepared && filed },
    { n: 2, label: 'Filed', done: filed },
    { n: 3, label: 'Paid', done: paid },
  ];
  return (
    <div className="flex items-center gap-3">
      {steps.map((step, index) => (
        <div key={step.n} className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border',
                step.done
                  ? 'bg-[#2CA01C] border-[#2CA01C] text-white'
                  : 'bg-muted border-muted-foreground/30 text-muted-foreground',
              )}
            >
              {step.done ? <Check className="h-3.5 w-3.5" /> : step.n}
            </div>
            <span className="text-[10px] text-muted-foreground">{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <div className={cn('h-px w-8 mb-4', step.done ? 'bg-[#2CA01C]' : 'bg-muted-foreground/30')} />
          )}
        </div>
      ))}
    </div>
  );
}

function FilingRow({
  row,
  section,
  formatCurrency,
  isReadOnly,
  onPrepareReturn,
  onViewSummary,
  onViewDetail,
  onUndoFiling,
}: {
  row: SalesTaxFilingRow;
  section: 'toFile' | 'filed';
  formatCurrency: (value: number) => string;
  isReadOnly?: boolean;
  onPrepareReturn: (row: SalesTaxFilingRow) => void;
  onViewSummary: (row: SalesTaxFilingRow) => void;
  onViewDetail: (row: SalesTaxFilingRow) => void;
  onUndoFiling?: (row: SalesTaxFilingRow) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 py-4 border-b last:border-b-0">
      <div className="min-w-[140px]">
        <p className="text-lg font-semibold">{formatCurrency(row.net)}</p>
        <p className="text-xs text-muted-foreground">{row.taxLabel}</p>
      </div>
      <p className="flex-1 text-sm text-muted-foreground min-w-[180px]">
        {formatQbPeriodLong(row.periodStart, row.periodEnd)}
      </p>
      <Stepper status={row.status} />
      <div className="ml-auto">
        {section === 'toFile' ? (
          <Button
            className="bg-[#2CA01C] hover:bg-[#249018] text-white"
            size="sm"
            disabled={isReadOnly}
            onClick={() => onPrepareReturn(row)}
          >
            Prepare return
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-[#2CA01C] text-[#2CA01C] hover:bg-[#2CA01C]/10">
                Record payment
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/treasury/tax-payments">Record payment</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/treasury/tax-payments">Record refund</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onViewSummary(row)}>View summary</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewDetail(row)}>View GST/HST detail</DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/tax/exceptions">View exception details</Link>
              </DropdownMenuItem>
              {!isReadOnly && !row.isSynthetic && onUndoFiling && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onUndoFiling(row)}>Undo filing</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

export function SalesTaxFilings({
  rows,
  formatCurrency,
  isReadOnly,
  onPrepareReturn,
  onViewSummary,
  onViewDetail,
  onUndoFiling,
}: SalesTaxFilingsProps) {
  const toFile = rows.filter((row) => row.status === 'draft');
  const filed = rows.filter((row) => row.status !== 'draft');

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-1">To file</h3>
        {toFile.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">No returns waiting to be filed for this period.</p>
        ) : (
          <div className="divide-y rounded-lg border bg-card px-4">
            {toFile.map((row) => (
              <FilingRow
                key={row.id}
                row={row}
                section="toFile"
                formatCurrency={formatCurrency}
                isReadOnly={isReadOnly}
                onPrepareReturn={onPrepareReturn}
                onViewSummary={onViewSummary}
                onViewDetail={onViewDetail}
                onUndoFiling={onUndoFiling}
              />
            ))}
          </div>
        )}
      </section>
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground mb-1">Filed</h3>
        {filed.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">No filed GST/HST or PST returns yet.</p>
        ) : (
          <div className="divide-y rounded-lg border bg-card px-4">
            {filed.map((row) => (
              <FilingRow
                key={row.id}
                row={row}
                section="filed"
                formatCurrency={formatCurrency}
                isReadOnly={isReadOnly}
                onPrepareReturn={onPrepareReturn}
                onViewSummary={onViewSummary}
                onViewDetail={onViewDetail}
                onUndoFiling={onUndoFiling}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
