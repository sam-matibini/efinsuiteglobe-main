import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Maximize2,
  Minimize2,
  Link2,
  FileSpreadsheet,
  FileDown,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { ViewJournalEntryDialog } from '@/components/journal/ViewJournalEntryDialog';
import { exportToFormattedExcel } from '@/lib/excelExport';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import type { JournalEntryWithLines } from '@/hooks/useJournalEntries';
import { cn } from '@/lib/utils';

interface DrillLine {
  id: string;
  journal_entry_id: string;
  debit: number;
  credit: number;
  base_currency_debit: number | null;
  base_currency_credit: number | null;
  description: string | null;
  journal_entry: {
    id: string;
    reference: string;
    entry_date: string;
    description: string | null;
    status: string;
    journal_type: string;
    notes: string | null;
  } | null;
}

interface AmountDrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | undefined;
  accountId: string;
  accountName: string;
  accountCode?: string;
  periodStart?: Date | null;
  periodEnd: Date;
}

const sourceLabel = (reference: string): string => {
  const pfx = reference.split('-')[0]?.toUpperCase() ?? '';
  switch (pfx) {
    case 'BANK': return 'Bank Transaction';
    case 'CC': return 'Credit Card';
    case 'RULE': return 'Bank Rule';
    case 'INV': return 'Invoice';
    case 'BILL': return 'Bill';
    case 'PMT':
    case 'PAY': return 'Payment';
    case 'DON': return 'Donation';
    case 'DEP': return 'Depreciation';
    case 'LEASE': return 'Lease';
    case 'REV': return 'Reversal';
    case 'CORR': return 'Correction';
    case 'ADJ': return 'Adjustment';
    case 'OB': return 'Opening Balance';
    case 'JE': return 'Manual JE';
    default: return 'Journal';
  }
};

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function AmountDrilldownDialog({
  open,
  onOpenChange,
  organizationId,
  accountId,
  accountName,
  accountCode,
  periodStart,
  periodEnd,
}: AmountDrilldownDialogProps) {
  const { formatCurrency } = useCurrencyFormatter();
  const { organization } = useCurrentOrganization();
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<DrillLine[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [viewEntry, setViewEntry] = useState<JournalEntryWithLines | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!open || !organizationId || !accountId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const endStr = format(periodEnd, 'yyyy-MM-dd');
        const startStr = periodStart ? format(periodStart, 'yyyy-MM-dd') : null;

        const all: DrillLine[] = [];
        const pageSize = 1000;
        let from = 0;
        while (true) {
          let q = supabase
            .from('journal_entry_lines')
            .select(`
              id, journal_entry_id, debit, credit,
              base_currency_debit, base_currency_credit, description,
              journal_entry:journal_entries!inner(
                id, reference, entry_date, description, status,
                journal_type, notes, organization_id
              )
            `)
            .eq('account_id', accountId)
            .eq('journal_entry.organization_id', organizationId)
            .in('journal_entry.status', ['posted', 'reversed'])
            .lte('journal_entry.entry_date', endStr)
            .order('entry_date', { foreignTable: 'journal_entry', ascending: true })
            .range(from, from + pageSize - 1);
          if (startStr) q = q.gte('journal_entry.entry_date', startStr);
          const { data, error } = await q;
          if (error) throw error;
          const rows = (data ?? []) as unknown as DrillLine[];
          all.push(...rows);
          if (rows.length < pageSize) break;
          from += pageSize;
        }

        let opening = 0;
        if (startStr) {
          const { data: opData, error: opErr } = await supabase
            .from('journal_entry_lines')
            .select(`
              base_currency_debit, base_currency_credit, debit, credit,
              journal_entry:journal_entries!inner(entry_date, status, organization_id)
            `)
            .eq('account_id', accountId)
            .eq('journal_entry.organization_id', organizationId)
            .in('journal_entry.status', ['posted', 'reversed'])
            .lt('journal_entry.entry_date', startStr);
          if (opErr) throw opErr;
          for (const r of opData ?? []) {
            const d = Number((r as any).base_currency_debit ?? (r as any).debit ?? 0);
            const c = Number((r as any).base_currency_credit ?? (r as any).credit ?? 0);
            opening += d - c;
          }
        }

        if (!cancelled) {
          setOpeningBalance(opening);
          setLines(all);
        }
      } catch (e) {
        console.error('[AmountDrilldownDialog] fetch failed', e);
        if (!cancelled) setLines([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, organizationId, accountId, periodStart, periodEnd]);

  const sorted = [...lines].sort((a, b) => {
    const ad = a.journal_entry?.entry_date ?? '';
    const bd = b.journal_entry?.entry_date ?? '';
    if (ad !== bd) return ad.localeCompare(bd);
    return (a.journal_entry?.reference ?? '').localeCompare(b.journal_entry?.reference ?? '');
  });

  // Pre-compute running rows + totals once for reuse in render/exports
  const computed = (() => {
    let running = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;
    const rows = sorted.map((line) => {
      const d = Number(line.base_currency_debit ?? line.debit ?? 0);
      const c = Number(line.base_currency_credit ?? line.credit ?? 0);
      totalDebit += d;
      totalCredit += c;
      running += d - c;
      return { line, d, c, running };
    });
    return { rows, totalDebit, totalCredit, endRunning: running };
  })();

  const periodLabel = periodStart
    ? `${format(periodStart, 'PP')} → ${format(periodEnd, 'PP')}`
    : `As of ${format(periodEnd, 'PP')}`;

  const fileSlug = `drilldown_${(accountCode || 'acct').replace(/[^\w-]/g, '')}_${
    periodStart ? format(periodStart, 'yyyyMMdd') + '-' : ''
  }${format(periodEnd, 'yyyyMMdd')}`;

  const openSourceEntry = async (journalEntryId: string) => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        journal_entry_lines(
          *,
          account:accounts(id, code, name, account_type, normal_balance)
        )
      `)
      .eq('id', journalEntryId)
      .maybeSingle();
    if (error || !data) {
      console.error('Failed to load JE', error);
      return;
    }
    const entry: any = {
      ...data,
      lines: ((data as any).journal_entry_lines ?? []).sort(
        (a: any, b: any) => (a.line_order ?? 0) - (b.line_order ?? 0),
      ),
    };
    setViewEntry(entry as JournalEntryWithLines);
    setViewOpen(true);
  };

  const handleShare = async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('drill', '1');
      url.searchParams.set('acc', accountId);
      url.searchParams.set('end', format(periodEnd, 'yyyy-MM-dd'));
      if (periodStart) url.searchParams.set('start', format(periodStart, 'yyyy-MM-dd'));
      else url.searchParams.delete('start');
      url.searchParams.set('name', accountName);
      if (accountCode) url.searchParams.set('code', accountCode);
      await navigator.clipboard.writeText(url.toString());
      toast.success('Drilldown link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const handleExportExcel = () => {
    const dataRows: (string | number)[][] = [];
    if (periodStart) {
      dataRows.push(['Opening Balance', '', '', '', '', '', fmtNum(openingBalance)]);
    }
    computed.rows.forEach(({ line, d, c, running }) => {
      const je = line.journal_entry!;
      dataRows.push([
        format(parseLocalDate(je.entry_date), 'yyyy-MM-dd'),
        je.reference,
        sourceLabel(je.reference),
        line.description || je.description || '',
        d ? fmtNum(d) : '',
        c ? fmtNum(c) : '',
        fmtNum(running),
      ]);
    });
    dataRows.push([
      'Total', '', '', '',
      fmtNum(computed.totalDebit),
      fmtNum(computed.totalCredit),
      fmtNum(computed.endRunning),
    ]);

    exportToFormattedExcel({
      title: `Drilldown - ${accountCode ? accountCode + ' ' : ''}${accountName}`,
      subtitle: periodLabel,
      organizationName: organization?.name,
      headers: ['Date', 'Reference', 'Source', 'Description', 'Debit', 'Credit', 'Running'],
      rows: dataRows,
    });
    toast.success('Excel exported');
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const title = `Drilldown — ${accountCode ? accountCode + ' ' : ''}${accountName}`;
    doc.setFontSize(14);
    doc.text(title, 40, 40);
    doc.setFontSize(10);
    doc.setTextColor(100);
    if (organization?.name) doc.text(organization.name, 40, 56);
    doc.text(periodLabel, 40, 70);
    doc.setTextColor(0);

    const body: (string | number)[][] = [];
    if (periodStart) {
      body.push(['', '', '', 'Opening Balance', '', '', fmtNum(openingBalance)]);
    }
    computed.rows.forEach(({ line, d, c, running }) => {
      const je = line.journal_entry!;
      body.push([
        format(parseLocalDate(je.entry_date), 'yyyy-MM-dd'),
        je.reference,
        sourceLabel(je.reference),
        line.description || je.description || '',
        d ? fmtNum(d) : '',
        c ? fmtNum(c) : '',
        fmtNum(running),
      ]);
    });

    autoTable(doc, {
      startY: 85,
      head: [['Date', 'Reference', 'Source', 'Description', 'Debit', 'Credit', 'Running']],
      body,
      foot: [[
        'Total', '', '', '',
        fmtNum(computed.totalDebit),
        fmtNum(computed.totalCredit),
        fmtNum(computed.endRunning),
      ]],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
      didDrawPage: (data) => {
        const page = doc.getNumberOfPages();
        const str = `Generated ${format(new Date(), 'yyyy-MM-dd HH:mm')} · Page ${data.pageNumber} of ${page}`;
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(str, 40, doc.internal.pageSize.getHeight() - 20);
        doc.setTextColor(0);
      },
    });

    doc.save(`${fileSlug}.pdf`);
    toast.success('PDF exported');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            'flex flex-col p-0 gap-0 overflow-hidden',
            expanded
              ? 'w-screen h-screen max-w-none max-h-none rounded-none border-0'
              : 'max-w-5xl w-[95vw] h-[85vh] max-h-[85vh]',
          )}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate">
                  Drilldown — {accountCode ? `${accountCode} ` : ''}{accountName}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {periodLabel} · Double-click a row to open the source journal entry.
                </DialogDescription>
              </div>
              <TooltipProvider delayDuration={150}>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleShare} aria-label="Copy share link">
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy share link</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleExportExcel} aria-label="Export Excel">
                        <FileSpreadsheet className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export to Excel</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleExportPdf} aria-label="Export PDF">
                        <FileDown className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export to PDF</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setExpanded((v) => !v)}
                        aria-label={expanded ? 'Restore' : 'Expand'}
                      >
                        {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{expanded ? 'Restore' : 'Expand to full screen'}</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto">
            {loading ? (
              <div className="space-y-2 p-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                No transactions in this period.
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Running</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodStart && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={6} className="font-medium text-muted-foreground">
                        Opening Balance
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(openingBalance)}
                      </TableCell>
                    </TableRow>
                  )}
                  {computed.rows.map(({ line, d, c, running }) => {
                    const je = line.journal_entry!;
                    return (
                      <TableRow
                        key={line.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onDoubleClick={() => openSourceEntry(je.id)}
                        title="Double-click to open journal entry"
                      >
                        <TableCell className="whitespace-nowrap align-top">
                          {format(parseLocalDate(je.entry_date), 'yyyy-MM-dd')}
                        </TableCell>
                        <TableCell className="font-mono text-xs align-top break-all max-w-[140px]">
                          {je.reference}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {sourceLabel(je.reference)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground align-top">
                          <span className="block max-w-md truncate" title={line.description || je.description || ''}>
                            {line.description || je.description || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono align-top">
                          {d ? formatCurrency(d) : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono align-top">
                          {c ? formatCurrency(c) : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground align-top">
                          {formatCurrency(running)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <tfoot className="sticky bottom-0 bg-background">
                  <tr className="bg-muted/60 font-semibold border-t-2">
                    <td className="p-4" colSpan={4}>Totals</td>
                    <td className="p-4 text-right font-mono">{formatCurrency(computed.totalDebit)}</td>
                    <td className="p-4 text-right font-mono">{formatCurrency(computed.totalCredit)}</td>
                    <td className="p-4 text-right font-mono">{formatCurrency(computed.endRunning)}</td>
                  </tr>
                </tfoot>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ViewJournalEntryDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        entry={viewEntry}
      />
    </>
  );
}
