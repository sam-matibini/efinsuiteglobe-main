import { useState } from 'react';
import { Plus, Search, Download, MoreHorizontal, FileText, Check, X, Building2, Send } from 'lucide-react';
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
import { useCreditNotes } from '@/hooks/useCreditNotes';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateCreditNoteDialog } from '@/components/sales/CreateCreditNoteDialog';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { DocumentShareDialog } from '@/components/shared/DocumentShareDialog';

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft: { label: 'Draft', icon: FileText, color: 'bg-muted text-muted-foreground' },
  issued: { label: 'Issued', icon: Check, color: 'bg-blue-500/10 text-blue-600' },
  applied: { label: 'Applied', icon: Check, color: 'bg-success/10 text-success' },
  voided: { label: 'Voided', icon: X, color: 'bg-destructive/10 text-destructive' },
};

export default function CreditNotes() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();
  const { creditNotes, isLoading, totalCreditNotes, totalCreditValue, pendingCredits, issueCreditNote } = useCreditNotes();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [shareCn, setShareCn] = useState<any | null>(null);

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
    const [year, month, day] = date.substring(0, 10).split('-').map(Number);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(year, month - 1, day));
  };

  const filteredCreditNotes = creditNotes.filter(cn => {
    const matchesSearch = 
      cn.credit_note_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cn.customer?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || cn.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start creating credit notes.
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
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Credit Notes</h1>
          <p className="text-muted-foreground">Issue and manage customer credit notes</p>
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
              New Credit Note
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Credit Notes</p>
          <p className="text-2xl font-bold text-foreground">{totalCreditNotes}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Credits Issued</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalCreditValue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Pending Credits</p>
          <p className="text-2xl font-bold text-warning">{formatCurrency(pendingCredits)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search credit notes..."
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
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="applied">Applied</SelectItem>
              <SelectItem value="voided">Voided</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {filteredCreditNotes.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {creditNotes.length === 0 ? 'No credit notes yet.' : 'No credit notes match your search.'}
          </div>
        ) : (
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th>Credit Note #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Invoice</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th className="text-right">Balance</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredCreditNotes.map((creditNote) => {
                const status = statusConfig[creditNote.status] || statusConfig.draft;
                const StatusIcon = status.icon;
                return (
                  <tr key={creditNote.id} className="hover:bg-muted/20">
                    <td className="font-medium text-accent">{creditNote.credit_note_number}</td>
                    <td>{creditNote.customer?.name || 'Unknown'}</td>
                    <td className="text-muted-foreground">{formatDate(creditNote.credit_note_date)}</td>
                    <td className="text-muted-foreground">{creditNote.invoice?.invoice_number || '-'}</td>
                    <td>
                      <Badge className={cn('gap-1', status.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    </td>
                    <td className="text-right font-mono font-medium text-destructive">
                      -{formatCurrency(Number(creditNote.total))}
                    </td>
                    <td className="text-right font-mono text-muted-foreground">
                      {formatCurrency(Number(creditNote.balance_remaining))}
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
                          <DropdownMenuItem onClick={() => setShareCn(creditNote)}>
                            <Send className="w-4 h-4 mr-2" /> Share
                          </DropdownMenuItem>
                          <DropdownMenuItem>Download PDF</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {creditNote.status === 'draft' && (
                            <DropdownMenuItem onClick={() => issueCreditNote.mutate(creditNote.id)}>
                              Issue Credit Note
                            </DropdownMenuItem>
                          )}
                          {creditNote.status === 'issued' && (
                            <DropdownMenuItem>Apply to Invoice</DropdownMenuItem>
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

      <CreateCreditNoteDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      <DocumentShareDialog
        open={shareCn !== null}
        onOpenChange={(o) => !o && setShareCn(null)}
        kind="credit_note"
        document={shareCn ? {
          id: shareCn.id,
          number: shareCn.credit_note_number,
          date: shareCn.credit_note_date,
          total: Number(shareCn.total),
          notes: shareCn.notes,
        } : null}
        contact={shareCn?.customer ? {
          name: shareCn.customer.name,
          email: shareCn.customer.email,
          phone: shareCn.customer.phone,
        } : null}
      />
    </div>
  );
}
