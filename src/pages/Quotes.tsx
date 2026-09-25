import { useState } from 'react';
import { Plus, Search, Download, MoreHorizontal, FileText, Send, Check, X, ArrowRight, Building2 } from 'lucide-react';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuotes } from '@/hooks/useQuotes';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateQuoteDialog } from '@/components/quotes/CreateQuoteDialog';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { DocumentShareDialog } from '@/components/shared/DocumentShareDialog';

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft: { label: 'Draft', icon: FileText, color: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', icon: Send, color: 'bg-blue-500/10 text-blue-600' },
  accepted: { label: 'Accepted', icon: Check, color: 'bg-success/10 text-success' },
  declined: { label: 'Declined', icon: X, color: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Expired', icon: X, color: 'bg-muted text-muted-foreground' },
  converted: { label: 'Converted', icon: ArrowRight, color: 'bg-primary/10 text-primary' },
};

export default function Quotes() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();
  const { quotes, isLoading, totalQuotes, pendingValue, acceptedValue, updateQuoteStatus, convertToInvoice } = useQuotes();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [shareQuote, setShareQuote] = useState<any | null>(null);

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

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = 
      q.quote_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.customer?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start creating quotes.
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
          <h1 className="text-2xl font-bold text-foreground">Quotes & Estimates</h1>
          <p className="text-muted-foreground">Create and manage customer quotes</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {!isReadOnly && (
            <Button 
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Quote
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Quotes</p>
          <p className="text-2xl font-bold text-foreground">{totalQuotes}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Pending Value</p>
          <p className="text-2xl font-bold text-warning">{formatCurrency(pendingValue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Accepted Value</p>
          <p className="text-2xl font-bold text-success">{formatCurrency(acceptedValue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Conversion Rate</p>
          <p className="text-2xl font-bold text-foreground">
            {totalQuotes > 0 ? Math.round((quotes.filter(q => q.status === 'converted').length / totalQuotes) * 100) : 0}%
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search quotes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {filteredQuotes.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {quotes.length === 0 ? 'No quotes yet. Create your first quote to get started.' : 'No quotes match your search.'}
          </div>
        ) : (
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Expiry</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((quote) => {
                const status = statusConfig[quote.status] || statusConfig.draft;
                const StatusIcon = status.icon;
                return (
                  <tr key={quote.id} className="hover:bg-muted/20">
                    <td className="font-medium text-accent">{quote.quote_number}</td>
                    <td>{quote.customer?.name || 'Unknown'}</td>
                    <td className="text-muted-foreground">{formatDate(quote.quote_date)}</td>
                    <td className="text-muted-foreground">{formatDate(quote.expiry_date)}</td>
                    <td>
                      <Badge className={cn('gap-1', status.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    </td>
                    <td className="text-right font-mono font-medium">{formatCurrency(Number(quote.total))}</td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit Quote</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShareQuote(quote)}>
                            <Send className="w-4 h-4 mr-2" /> Share
                          </DropdownMenuItem>
                          <DropdownMenuItem>Download PDF</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {quote.status === 'draft' && (
                            <DropdownMenuItem onClick={() => updateQuoteStatus.mutate({ id: quote.id, status: 'sent' })}>
                              Mark as Sent
                            </DropdownMenuItem>
                          )}
                          {quote.status === 'sent' && (
                            <>
                              <DropdownMenuItem onClick={() => updateQuoteStatus.mutate({ id: quote.id, status: 'accepted' })}>
                                Mark as Accepted
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateQuoteStatus.mutate({ id: quote.id, status: 'declined' })}>
                                Mark as Declined
                              </DropdownMenuItem>
                            </>
                          )}
                          {quote.status === 'accepted' && (
                            <DropdownMenuItem onClick={() => convertToInvoice.mutate(quote.id)}>
                              <ArrowRight className="w-4 h-4 mr-2" />
                              Convert to Invoice
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <CreateQuoteDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      <DocumentShareDialog
        open={shareQuote !== null}
        onOpenChange={(o) => !o && setShareQuote(null)}
        kind="quote"
        document={shareQuote ? {
          id: shareQuote.id,
          number: shareQuote.quote_number,
          date: shareQuote.quote_date,
          dueDate: shareQuote.expiry_date,
          total: Number(shareQuote.total),
          notes: shareQuote.notes,
          terms: shareQuote.terms,
        } : null}
        contact={shareQuote?.customer ? {
          name: shareQuote.customer.name,
          email: shareQuote.customer.email,
          phone: shareQuote.customer.phone,
        } : null}
      />
    </div>
  );
}
