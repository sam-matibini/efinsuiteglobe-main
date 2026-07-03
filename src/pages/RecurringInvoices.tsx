import { useState } from 'react';
import { Plus, Search, MoreHorizontal, Play, Pause, Check, Calendar, Building2 } from 'lucide-react';
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
import { useRecurringInvoices } from '@/hooks/useRecurringInvoices';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreateRecurringInvoiceDialog } from '@/components/sales/CreateRecurringInvoiceDialog';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  active: { label: 'Active', icon: Play, color: 'bg-success/10 text-success' },
  paused: { label: 'Paused', icon: Pause, color: 'bg-warning/10 text-warning' },
  completed: { label: 'Completed', icon: Check, color: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelled', icon: Pause, color: 'bg-destructive/10 text-destructive' },
};

const frequencyLabels: Record<string, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

export default function RecurringInvoices() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();
  const { 
    recurringInvoices, 
    isLoading, 
    activeTemplates, 
    monthlyRevenue,
    updateRecurringInvoiceStatus,
    generateInvoice,
  } = useRecurringInvoices();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);

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

  const filteredTemplates = recurringInvoices.filter(ri => {
    const matchesSearch = 
      ri.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ri.customer?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ri.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start setting up recurring invoices.
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
          <h1 className="text-2xl font-bold text-foreground">Recurring Invoices</h1>
          <p className="text-muted-foreground">Automate invoice generation on a schedule</p>
        </div>
        {!isReadOnly && (
          <Button 
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Active Templates</p>
          <p className="text-2xl font-bold text-foreground">{activeTemplates}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Est. Monthly Revenue</p>
          <p className="text-2xl font-bold text-success">{formatCurrency(monthlyRevenue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Templates</p>
          <p className="text-2xl font-bold text-foreground">{recurringInvoices.length}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {filteredTemplates.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {recurringInvoices.length === 0 ? 'No recurring invoice templates yet.' : 'No templates match your search.'}
          </div>
        ) : (
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th>Template Name</th>
                <th>Customer</th>
                <th>Frequency</th>
                <th>Next Invoice</th>
                <th>Status</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Generated</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((ri) => {
                const status = statusConfig[ri.status] || statusConfig.active;
                const StatusIcon = status.icon;
                return (
                  <tr key={ri.id} className="hover:bg-muted/20">
                    <td className="font-medium">{ri.template_name}</td>
                    <td>{ri.customer?.name || 'Unknown'}</td>
                    <td className="text-muted-foreground">{frequencyLabels[ri.frequency] || ri.frequency}</td>
                    <td>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {formatDate(ri.next_invoice_date)}
                      </div>
                    </td>
                    <td>
                      <Badge className={cn('gap-1', status.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    </td>
                    <td className="text-right font-mono font-medium">{formatCurrency(Number(ri.total))}</td>
                    <td className="text-center text-muted-foreground">{ri.invoices_generated}</td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit Template</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {ri.status === 'active' && (
                            <>
                              <DropdownMenuItem onClick={() => generateInvoice.mutate(ri.id)}>
                                Generate Invoice Now
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateRecurringInvoiceStatus.mutate({ id: ri.id, status: 'paused' })}>
                                <Pause className="w-4 h-4 mr-2" />
                                Pause
                              </DropdownMenuItem>
                            </>
                          )}
                          {ri.status === 'paused' && (
                            <DropdownMenuItem onClick={() => updateRecurringInvoiceStatus.mutate({ id: ri.id, status: 'active' })}>
                              <Play className="w-4 h-4 mr-2" />
                              Resume
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => updateRecurringInvoiceStatus.mutate({ id: ri.id, status: 'cancelled' })}
                          >
                            Cancel Template
                          </DropdownMenuItem>
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

      <CreateRecurringInvoiceDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
    </div>
  );
}
