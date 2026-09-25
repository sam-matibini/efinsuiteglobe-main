import { useState } from 'react';
import { FileSpreadsheet, FileText, Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'transfer';
  status: string;
  is_cleared?: boolean | null;
  journal_entry_id?: string | null;
  category?: string;
  matchedTo?: string;
  payee_payor?: string;
  reference?: string;
}

interface TransactionExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  accountName?: string;
}

type LifecycleKey = 'pending' | 'unmatched' | 'matched' | 'reconciled';
const LIFECYCLE_OPTIONS: { key: LifecycleKey; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'unmatched', label: 'Unmatched' },
  { key: 'matched', label: 'Matched' },
  { key: 'reconciled', label: 'Reconciled' },
];

export default function TransactionExportDialog({
  open,
  onOpenChange,
  transactions,
  accountName = 'Bank Account',
}: TransactionExportDialogProps) {
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('excel');
  const [dateRange, setDateRange] = useState('all');
  const [lifecycle, setLifecycle] = useState<Record<LifecycleKey, boolean>>({
    pending: true,
    unmatched: true,
    matched: true,
    reconciled: true,
  });
  const [includeCategorized, setIncludeCategorized] = useState(true);
  const [includeUncategorized, setIncludeUncategorized] = useState(true);
  const [includeGlPosted, setIncludeGlPosted] = useState(true);
  const [includeGlNotPosted, setIncludeGlNotPosted] = useState(true);

  const allOn =
    Object.values(lifecycle).every(Boolean) &&
    includeCategorized && includeUncategorized &&
    includeGlPosted && includeGlNotPosted;

  const setAll = (v: boolean) => {
    setLifecycle({ pending: v, unmatched: v, matched: v, reconciled: v });
    setIncludeCategorized(v);
    setIncludeUncategorized(v);
    setIncludeGlPosted(v);
    setIncludeGlNotPosted(v);
  };

  const effectiveLifecycle = (t: Transaction): LifecycleKey => {
    if (t.is_cleared || t.status === 'reconciled') return 'reconciled';
    if (t.status === 'matched') return 'matched';
    if (t.status === 'pending') return 'pending';
    return 'unmatched';
  };

  const filteredTransactions = transactions.filter((t) => {
    if (!lifecycle[effectiveLifecycle(t)]) return false;
    const hasCategory = !!t.category;
    if (hasCategory && !includeCategorized) return false;
    if (!hasCategory && !includeUncategorized) return false;
    const posted = !!t.journal_entry_id;
    if (posted && !includeGlPosted) return false;
    if (!posted && !includeGlNotPosted) return false;
    return true;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
    }).format(Math.abs(value));
  };

  const exportToExcel = () => {
    // Generate CSV content (Excel-compatible)
    const headers = ['Date', 'Description', 'Payee/Payor', 'Reference', 'Amount', 'Type', 'Status', 'Category', 'Matched To'];
    const rows = filteredTransactions.map((t) => [
      format(t.date, 'yyyy-MM-dd'),
      `"${t.description.replace(/"/g, '""')}"`,
      `"${(t.payee_payor || '').replace(/"/g, '""')}"`,
      `"${(t.reference || '').replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      t.type,
      t.status,
      t.category || '',
      t.matchedTo || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bank_transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Exported to Excel (CSV) successfully');
  };

  const exportToPDF = () => {
    // Create a printable HTML document
    const totalDeposits = filteredTransactions
      .filter((t) => t.type === 'deposit')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalWithdrawals = filteredTransactions
      .filter((t) => t.type === 'withdrawal')
      .reduce((sum, t) => sum + t.amount, 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bank Transactions Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { color: #1a1a1a; margin-bottom: 5px; }
          .subtitle { color: #666; margin-bottom: 30px; }
          .summary { display: flex; gap: 40px; margin-bottom: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px; }
          .summary-item { }
          .summary-label { font-size: 12px; color: #666; text-transform: uppercase; }
          .summary-value { font-size: 24px; font-weight: bold; }
          .deposits { color: #16a34a; }
          .withdrawals { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f0f0f0; padding: 12px 8px; text-align: left; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #ddd; }
          td { padding: 10px 8px; border-bottom: 1px solid #eee; }
          .amount { text-align: right; font-family: monospace; }
          .deposit-amount { color: #16a34a; }
          .status { padding: 2px 8px; border-radius: 4px; font-size: 11px; }
          .status-unmatched { background: #fef3c7; color: #d97706; }
          .status-matched { background: #dbeafe; color: #2563eb; }
          .status-reconciled { background: #dcfce7; color: #16a34a; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <h1>Bank Transactions Report</h1>
        <p class="subtitle">${accountName} • Generated on ${format(new Date(), 'MMMM d, yyyy')}</p>
        
        <div class="summary">
          <div class="summary-item">
            <div class="summary-label">Total Transactions</div>
            <div class="summary-value">${filteredTransactions.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Deposits</div>
            <div class="summary-value deposits">+${formatCurrency(totalDeposits)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Withdrawals</div>
            <div class="summary-value withdrawals">-${formatCurrency(Math.abs(totalWithdrawals))}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Payee/Payor</th>
              <th>Reference</th>
              <th>Category</th>
              <th style="text-align: right;">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTransactions
              .map(
                (t) => `
              <tr>
                <td>${format(t.date, 'MMM d, yyyy')}</td>
                <td>${t.description}</td>
                <td>${t.payee_payor || '-'}</td>
                <td style="font-family: monospace; font-size: 11px;">${t.reference || '-'}</td>
                <td>${t.category || '-'}</td>
                <td class="amount ${t.type === 'deposit' ? 'deposit-amount' : ''}">${t.type === 'deposit' ? '+' : '-'}${formatCurrency(t.amount)}</td>
                <td><span class="status status-${t.status}">${t.status.charAt(0).toUpperCase() + t.status.slice(1)}</span></td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>This report was generated from the accounting system. For questions, contact your administrator.</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
      toast.success('PDF report opened for printing');
    } else {
      toast.error('Please allow popups to generate PDF');
    }
  };

  const handleExport = () => {
    if (exportFormat === 'excel') {
      exportToExcel();
    } else {
      exportToPDF();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Transactions</DialogTitle>
          <DialogDescription>Choose format and options for your export</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Format */}
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup
              value={exportFormat}
              onValueChange={(v) => setExportFormat(v as 'pdf' | 'excel')}
              className="grid grid-cols-2 gap-3"
            >
              <div
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  exportFormat === 'excel' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => setExportFormat('excel')}
              >
                <RadioGroupItem value="excel" id="excel" />
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <div>
                  <Label htmlFor="excel" className="cursor-pointer font-medium">
                    Excel
                  </Label>
                  <p className="text-xs text-muted-foreground">CSV format</p>
                </div>
              </div>
              <div
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                  exportFormat === 'pdf' ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onClick={() => setExportFormat('pdf')}
              >
                <RadioGroupItem value="pdf" id="pdf" />
                <FileText className="w-5 h-5 text-red-600" />
                <div>
                  <Label htmlFor="pdf" className="cursor-pointer font-medium">
                    PDF
                  </Label>
                  <p className="text-xs text-muted-foreground">Print-ready</p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="this-quarter">This Quarter</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Include Status</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setAll(!allOn)}
              >
                {allOn ? 'Clear all' : 'Select all'}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Lifecycle</p>
                <div className="grid grid-cols-2 gap-2">
                  {LIFECYCLE_OPTIONS.map((opt) => (
                    <div key={opt.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`lc-${opt.key}`}
                        checked={lifecycle[opt.key]}
                        onCheckedChange={(c) =>
                          setLifecycle((prev) => ({ ...prev, [opt.key]: !!c }))
                        }
                      />
                      <Label htmlFor={`lc-${opt.key}`} className="font-normal cursor-pointer">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Categorization</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="categorized"
                      checked={includeCategorized}
                      onCheckedChange={(c) => setIncludeCategorized(!!c)}
                    />
                    <Label htmlFor="categorized" className="font-normal cursor-pointer">
                      Categorized
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="uncategorized"
                      checked={includeUncategorized}
                      onCheckedChange={(c) => setIncludeUncategorized(!!c)}
                    />
                    <Label htmlFor="uncategorized" className="font-normal cursor-pointer">
                      Uncategorized
                    </Label>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">GL Posting</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="gl-posted"
                      checked={includeGlPosted}
                      onCheckedChange={(c) => setIncludeGlPosted(!!c)}
                    />
                    <Label htmlFor="gl-posted" className="font-normal cursor-pointer">
                      GL Posted
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="gl-not-posted"
                      checked={includeGlNotPosted}
                      onCheckedChange={(c) => setIncludeGlNotPosted(!!c)}
                    />
                    <Label htmlFor="gl-not-posted" className="font-normal cursor-pointer">
                      GL Not Posted
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {filteredTransactions.length} transactions selected
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={filteredTransactions.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
