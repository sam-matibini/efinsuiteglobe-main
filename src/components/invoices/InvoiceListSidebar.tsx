import { Search, Plus, Clock, Send, Check, AlertTriangle, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Invoice } from '@/hooks/useInvoices';
import { differenceInDays } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InvoiceListSidebarProps {
  invoices: Invoice[];
  selectedInvoiceId: string | null;
  onSelectInvoice: (invoice: Invoice) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  formatCurrency: (value: number) => string;
  formatDate: (date: string) => string;
  onNewInvoice?: () => void;
  isReadOnly?: boolean;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  draft: { label: 'Draft', icon: Clock, color: 'bg-muted text-muted-foreground' },
  issued: { label: 'Issued', icon: FileText, color: 'bg-blue-500/10 text-blue-600' },
  final: { label: 'Final', icon: Check, color: 'bg-emerald-500/10 text-emerald-600' },
  sent: { label: 'Sent', icon: Send, color: 'bg-blue-500/10 text-blue-600' },
  paid: { label: 'Paid', icon: Check, color: 'bg-success/10 text-success' },
  partial: { label: 'Partial', icon: Clock, color: 'bg-warning/10 text-warning' },
  overdue: { label: 'Overdue', icon: AlertTriangle, color: 'bg-destructive/10 text-destructive' },
  void: { label: 'Void', icon: Clock, color: 'bg-muted text-muted-foreground' },
};

export function InvoiceListSidebar({
  invoices,
  selectedInvoiceId,
  onSelectInvoice,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  formatCurrency,
  formatDate,
  onNewInvoice,
  isReadOnly,
}: InvoiceListSidebarProps) {
  return (
    <div className="w-80 border-r bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-sm text-foreground">All Invoices</h3>
        {!isReadOnly && onNewInvoice && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewInvoice}>
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="p-3 border-b flex-shrink-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="final">Final</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoice List */}
      <ScrollArea className="flex-1">
        {invoices.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No invoices found.
          </div>
        ) : (
          <div className="divide-y">
            {invoices.map((invoice) => {
              const isSelected = invoice.id === selectedInvoiceId;
              const status = statusConfig[invoice.status] || statusConfig.draft;
              const StatusIcon = status.icon;
              const isOverdue = invoice.status === 'overdue';
              const overdueDays = isOverdue
                ? differenceInDays(new Date(), parseLocalDate(invoice.due_date))
                : 0;

              return (
                <button
                  key={invoice.id}
                  onClick={() => onSelectInvoice(invoice)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-muted/50 transition-colors",
                    isSelected && "bg-accent/10 border-l-2 border-l-primary"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {invoice.customer?.name || 'Unknown Customer'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {invoice.invoice_number} • {formatDate(invoice.invoice_date)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-foreground whitespace-nowrap">
                      {formatCurrency(Number(invoice.total))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge className={cn("text-[10px] px-1.5 py-0 h-5 gap-0.5", status.color)}>
                      <StatusIcon className="w-2.5 h-2.5" />
                      {status.label}
                    </Badge>
                    {isOverdue && overdueDays > 0 && (
                      <span className="text-[10px] text-destructive font-medium">
                        {overdueDays} day{overdueDays !== 1 ? 's' : ''} overdue
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
