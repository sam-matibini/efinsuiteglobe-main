import { MoreVertical, FileSpreadsheet, FileText, Mail, MessageCircle, Copy } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { exportToFormattedExcel } from '@/lib/excelExport';

export interface CardActionRow {
  date: string;
  description: string;
  payee: string;
  category: string;
  reference: string;
  amount: number;
  status: string;
}

interface Props {
  title: string;
  /** Short snapshot text (KPI summary) for email/whatsapp/copy */
  snapshot: string;
  /** Rows for export. If undefined or empty, row exports are hidden. */
  rows?: CardActionRow[];
  organizationName?: string;
  /** Currency formatter (matches page's localized formatter) */
  formatCurrency: (n: number) => string;
}

const ROW_HEADERS = ['Date', 'Description', 'Payee/Payor', 'Category', 'Reference', 'Amount', 'Status'];

function rowsToMatrix(rows: CardActionRow[]): (string | number)[][] {
  return rows.map(r => [r.date, r.description, r.payee, r.category, r.reference, r.amount, r.status]);
}

function openPdfPrintWindow(title: string, snapshot: string, rows: CardActionRow[] | undefined, fmt: (n: number) => string) {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!w) {
    toast.error('Popup blocked — allow popups to export PDF');
    return;
  }
  const total = rows?.reduce((s, r) => s + Math.abs(Number(r.amount) || 0), 0) ?? 0;
  const rowsHtml = (rows ?? [])
    .map(
      r => `<tr>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.description)}</td>
        <td>${escapeHtml(r.payee)}</td>
        <td>${escapeHtml(r.category)}</td>
        <td>${escapeHtml(r.reference)}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${fmt(Number(r.amount) || 0)}</td>
        <td>${escapeHtml(r.status)}</td>
      </tr>`,
    )
    .join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;margin:24px;color:#111}
      h1{font-size:18px;margin:0 0 4px}
      .snapshot{color:#555;font-size:12px;margin-bottom:16px;white-space:pre-line}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border-bottom:1px solid #e5e7eb;padding:6px 8px;text-align:left;vertical-align:top}
      th{background:#f3f4f6;font-weight:600}
      tfoot td{font-weight:600;border-top:2px solid #111;border-bottom:none}
      @media print{button{display:none}}
    </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <div class="snapshot">${escapeHtml(snapshot)}</div>
    ${
      rows && rows.length
        ? `<table><thead><tr>${ROW_HEADERS.map(h => `<th${h === 'Amount' ? ' style="text-align:right"' : ''}>${h}</th>`).join('')}</tr></thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot><tr><td colspan="5">Total (absolute)</td><td style="text-align:right">${fmt(total)}</td><td></td></tr></tfoot>
            </table>`
        : ''
    }
    <p style="margin-top:24px;font-size:11px;color:#888">Generated ${new Date().toLocaleString()}</p>
    <script>setTimeout(()=>{window.print()},300);</script>
    </body></html>`);
  w.document.close();
}

function escapeHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function BankTxCardActions({ title, snapshot, rows, organizationName, formatCurrency }: Props) {
  const hasRows = !!rows && rows.length > 0;

  const onExcel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasRows) return;
    exportToFormattedExcel({
      title,
      subtitle: snapshot,
      organizationName,
      headers: ROW_HEADERS,
      rows: rowsToMatrix(rows!),
    });
    toast.success('Excel downloaded');
  };

  const onPdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    openPdfPrintWindow(title, snapshot, rows, formatCurrency);
  };

  const body = encodeURIComponent(`${title}\n\n${snapshot}`);

  const onEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${body}`;
  };

  const onWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://wa.me/?text=${body}`, '_blank', 'noopener,noreferrer');
  };

  const onCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${title}\n${snapshot}`);
      toast.success('Snapshot copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="absolute top-2 right-2" onClick={e => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label={`Share or download ${title}`}
            onClick={e => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs">{title}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExcel} disabled={!hasRows}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export rows · Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPdf}>
            <FileText className="h-4 w-4 mr-2" />
            Export {hasRows ? 'rows' : 'snapshot'} · PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onEmail}>
            <Mail className="h-4 w-4 mr-2" />
            Share via Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onWhatsApp}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Share via WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copy snapshot
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
