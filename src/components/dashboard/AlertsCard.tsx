import { AlertTriangle, Clock, FileText, CreditCard, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { useBills } from '@/hooks/useBills';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO } from 'date-fns';

interface Alert {
  id: string;
  type: 'overdue_invoice' | 'overdue_bill' | 'due_soon';
  title: string;
  description: string;
  amount: number;
  daysOverdue?: number;
  path: string;
  severity: 'high' | 'medium' | 'low';
}

export function AlertsCard() {
  const { organization } = useCurrentOrganization();
  const { invoices, isLoading: invoicesLoading } = useInvoices();
  const { bills, isLoading: billsLoading } = useBills();
  const navigate = useNavigate();

  const isLoading = invoicesLoading || billsLoading;

  const formatCurrency = (value: number) => {
    const countryCode = organization?.country?.toUpperCase() || 'CA';
    const currencyMap: Record<string, string> = {
      'CA': 'CAD', 'US': 'USD', 'GB': 'GBP', 'AU': 'AUD', 'IN': 'INR',
      'ZA': 'ZAR', 'NG': 'NGN', 'GH': 'GHS', 'KE': 'KES', 'ZM': 'ZMW',
      'AE': 'AED', 'SA': 'SAR', 'DE': 'EUR', 'FR': 'EUR', 'BI': 'BIF',
    };
    const currency = currencyMap[countryCode] || 'CAD';
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="stat-card animate-slide-in">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </div>
    );
  }

  const today = new Date();
  const alerts: Alert[] = [];

  // Check for overdue invoices
  invoices
    ?.filter(inv => inv.status !== 'paid' && inv.status !== 'void')
    ?.forEach(inv => {
      const dueDate = parseISO(inv.due_date);
      const daysOverdue = differenceInDays(today, dueDate);
      
      if (daysOverdue > 0) {
        alerts.push({
          id: `inv-${inv.id}`,
          type: 'overdue_invoice',
          title: `Invoice ${inv.invoice_number} overdue`,
          description: `${daysOverdue} days past due`,
          amount: inv.balance_due || 0,
          daysOverdue,
          path: '/sales/invoices',
          severity: daysOverdue > 30 ? 'high' : daysOverdue > 14 ? 'medium' : 'low',
        });
      } else if (daysOverdue > -7) {
        alerts.push({
          id: `inv-soon-${inv.id}`,
          type: 'due_soon',
          title: `Invoice ${inv.invoice_number} due soon`,
          description: `Due in ${Math.abs(daysOverdue)} days`,
          amount: inv.balance_due || 0,
          path: '/sales/invoices',
          severity: 'low',
        });
      }
    });

  // Check for overdue bills
  bills
    ?.filter(bill => bill.status !== 'paid' && bill.status !== 'voided')
    ?.forEach(bill => {
      const dueDate = parseISO(bill.due_date);
      const daysOverdue = differenceInDays(today, dueDate);
      
      if (daysOverdue > 0) {
        alerts.push({
          id: `bill-${bill.id}`,
          type: 'overdue_bill',
          title: `Bill ${bill.bill_number} overdue`,
          description: `${daysOverdue} days past due`,
          amount: bill.balance_due || 0,
          daysOverdue,
          path: '/purchases/bills',
          severity: daysOverdue > 30 ? 'high' : daysOverdue > 14 ? 'medium' : 'low',
        });
      }
    });

  // Sort by severity and days overdue
  const sortedAlerts = alerts
    .sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return (b.daysOverdue || 0) - (a.daysOverdue || 0);
    })
    .slice(0, 5);

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'overdue_invoice':
        return FileText;
      case 'overdue_bill':
        return CreditCard;
      case 'due_soon':
        return Clock;
      default:
        return AlertTriangle;
    }
  };

  const getSeverityStyles = (severity: Alert['severity']) => {
    switch (severity) {
      case 'high':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'medium':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'low':
        return 'bg-muted text-muted-foreground border-border';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="stat-card animate-slide-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h3 className="text-lg font-semibold text-foreground">Action Required</h3>
        </div>
        {sortedAlerts.length > 0 && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-warning/10 text-warning">
            {sortedAlerts.length} items
          </span>
        )}
      </div>

      <div className="space-y-3">
        {sortedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <p className="text-sm font-medium text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground">No overdue items</p>
          </div>
        ) : (
          sortedAlerts.map((alert) => {
            const Icon = getAlertIcon(alert.type);
            return (
              <button
                key={alert.id}
                onClick={() => navigate(alert.path)}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-sm",
                  getSeverityStyles(alert.severity)
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <div className="text-left">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs opacity-80">{alert.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{formatCurrency(alert.amount)}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
