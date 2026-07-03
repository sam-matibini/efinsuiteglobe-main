import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ZohoEquityRow } from '@/hooks/useZohoEquityData';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

interface ZohoEquityTableProps {
  rows: ZohoEquityRow[];
  years: number[];
  isNpo?: boolean;
}

// ASNPO label substitutions for the Statement of Changes in Net Assets
const npoLabel = (label: string): string => {
  if (!label) return label;
  if (/^Balance at January 1,/i.test(label)) return label.replace(/^Balance at January 1,/, 'Balance, beginning of year ―');
  if (/^Balance at December 31,/i.test(label)) return label.replace(/^Balance at December 31,/, 'Balance, end of year ―');
  if (/^Profit\/Loss for the year/i.test(label)) return label.replace(/^Profit\/Loss for the year/, 'Excess (deficiency) of revenue over expenses ―');
  if (/Owner.s Investment\/Contribution/i.test(label)) return 'Contributions received';
  if (/Drawings\/Dividends Paid/i.test(label)) return 'Interfund transfers / distributions';
  return label;
};

export function ZohoEquityTable({ rows, years, isNpo = false }: ZohoEquityTableProps) {
  const { formatWithSymbol, formatDeduction } = useCurrencyFormatter();

  const formatValue = (value: number, isDistribution = false) => {
    if (value === 0) return '-';
    if (isDistribution || value < 0) {
      return formatDeduction(Math.abs(value));
    }
    return formatWithSymbol(value);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50 hover:bg-muted/50">
          <TableHead className="font-semibold text-foreground w-[40%]">Description</TableHead>
          {!isNpo && (
            <TableHead className="font-semibold text-foreground text-right w-[20%]">
              Owner's Capital / Share Capital ($)
            </TableHead>
          )}
          <TableHead className="font-semibold text-foreground text-right w-[20%]">
            {isNpo ? 'Unrestricted Net Assets ($)' : 'Retained Earnings ($)'}
          </TableHead>
          <TableHead className="font-semibold text-foreground text-right w-[20%]">
            {isNpo ? 'Total Net Assets ($)' : 'Total Equity ($)'}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          // Spacer row
          if (!row.label) {
            return (
              <TableRow key={row.id} className="h-4 hover:bg-transparent">
                <TableCell colSpan={isNpo ? 3 : 4} className="p-0" />
              </TableRow>
            );
          }

          const isDistributionRow = row.id.includes('distributions');
          const isProfitRow = row.id.includes('profit-loss');
          const isOpeningRow = row.id.includes('opening');
          const isClosingRow = row.id.includes('closing');

          return (
            <TableRow
              key={row.id}
              className={cn(
                row.isSubtotal && 'font-bold bg-muted/30 border-t border-border',
                isOpeningRow && 'bg-muted/20',
                'hover:bg-muted/10'
              )}
            >
              <TableCell 
                className={cn(
                  'py-3',
                  row.indent && 'pl-8',
                  row.isSubtotal && 'font-bold'
                )}
              >
                {isNpo ? npoLabel(row.label) : row.label}
              </TableCell>
              {!isNpo && (
                <TableCell 
                  className={cn(
                    'text-right font-mono py-3',
                    row.isSubtotal && 'font-bold'
                  )}
                >
                  {formatValue(row.shareCapital)}
                </TableCell>
              )}
              <TableCell 
                className={cn(
                  'text-right font-mono py-3',
                  row.isSubtotal && 'font-bold',
                  isDistributionRow && row.retainedEarnings !== 0 && 'text-destructive',
                  isProfitRow && row.retainedEarnings > 0 && 'text-success',
                  isProfitRow && row.retainedEarnings < 0 && 'text-destructive'
                )}
              >
                {formatValue(row.retainedEarnings, isDistributionRow)}
              </TableCell>
              <TableCell 
                className={cn(
                  'text-right font-mono py-3',
                  row.isSubtotal && 'font-bold',
                  isDistributionRow && row.totalEquity !== 0 && 'text-destructive',
                  isProfitRow && row.totalEquity > 0 && 'text-success',
                  isProfitRow && row.totalEquity < 0 && 'text-destructive'
                )}
              >
                {formatValue(row.totalEquity, isDistributionRow)}
              </TableCell>
            </TableRow>
          );
        })}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={isNpo ? 3 : 4} className="text-center py-8 text-muted-foreground">
              No equity data found. Click "Populate Equity Movements" to generate data from journal entries.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
