import { useState } from 'react';
import { Plus, Search, Download, MoreHorizontal, Check, Clock, ArrowDownLeft, Building2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCustomerPayments } from '@/hooks/useCustomerPayments';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { RecordPaymentDialog } from '@/components/payments/RecordPaymentDialog';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { DocumentShareDialog } from '@/components/shared/DocumentShareDialog';

export default function Payments() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();
  const { payments, isLoading, totalReceived } = useCustomerPayments();
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [sharePayment, setSharePayment] = useState<any | null>(null);

  const countryCode = organization?.country || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = 
      (p.customer?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (p.reference?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start recording payments.
        </p>
        <Button onClick={() => setShowOrgDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Organization
        </Button>
        <CreateOrganizationDialog open={showOrgDialog} onOpenChange={setShowOrgDialog} />
      </div>
    );
  }

  if (isLoading || orgLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground">Track payments received from customers</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {!isReadOnly && (
            <Button 
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setShowPaymentDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Payments</p>
          <p className="text-2xl font-bold text-foreground">{payments.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Received</p>
          <p className="text-2xl font-bold text-success">{formatCurrency(totalReceived)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">This Month</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(totalReceived)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search payments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {filteredPayments.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {payments.length === 0 ? 'No payments yet. Record your first payment to get started.' : 'No payments match your search.'}
          </div>
        ) : (
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-12"></th>
                <th>Date</th>
                <th>Customer</th>
                <th>Invoice</th>
                <th>Method</th>
                <th className="text-right">Amount</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-muted/20">
                  <td>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-success/10">
                      <ArrowDownLeft className="w-4 h-4 text-success" />
                    </div>
                  </td>
                  <td className="text-muted-foreground">{formatDate(payment.payment_date)}</td>
                  <td className="font-medium">{payment.customer?.name || 'Unknown'}</td>
                  <td className="text-accent">{payment.invoice?.invoice_number || '-'}</td>
                  <td className="text-muted-foreground">{payment.payment_method || '-'}</td>
                  <td className="text-right font-mono font-medium text-success">
                    +{formatCurrency(Number(payment.amount))}
                  </td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSharePayment(payment)}>
                          <Send className="w-4 h-4 mr-2" /> Share
                        </DropdownMenuItem>
                        <DropdownMenuItem>Download Receipt</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <RecordPaymentDialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog} />
      <DocumentShareDialog
        open={sharePayment !== null}
        onOpenChange={(o) => !o && setSharePayment(null)}
        kind="customer_payment"
        document={sharePayment ? {
          id: sharePayment.id,
          number: sharePayment.payment_number ?? sharePayment.reference ?? sharePayment.id?.slice(0, 8),
          date: sharePayment.payment_date,
          total: Number(sharePayment.amount),
          notes: sharePayment.notes,
        } : null}
        contact={sharePayment?.customer ? {
          name: sharePayment.customer.name,
          email: sharePayment.customer.email,
          phone: sharePayment.customer.phone,
        } : null}
      />
    </div>
  );
}
