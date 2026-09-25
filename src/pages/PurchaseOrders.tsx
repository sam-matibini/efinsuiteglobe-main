import { useState } from 'react';
import { Plus, Search, Download, MoreHorizontal, FileText, Send, Check, Package, ArrowRight, Building2, Paperclip } from 'lucide-react';
import { PurchaseAttachmentsDialog } from '@/components/purchases/PurchaseAttachmentsDialog';
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
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { CreatePurchaseOrderDialog } from '@/components/purchases/CreatePurchaseOrderDialog';
import { CreateOrganizationDialog } from '@/components/accounts/CreateOrganizationDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { DocumentShareDialog } from '@/components/shared/DocumentShareDialog';

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft: { label: 'Draft', icon: FileText, color: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', icon: Send, color: 'bg-blue-500/10 text-blue-600' },
  acknowledged: { label: 'Acknowledged', icon: Check, color: 'bg-primary/10 text-primary' },
  partial: { label: 'Partial', icon: Package, color: 'bg-warning/10 text-warning' },
  received: { label: 'Received', icon: Check, color: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', icon: FileText, color: 'bg-destructive/10 text-destructive' },
  closed: { label: 'Closed', icon: Check, color: 'bg-muted text-muted-foreground' },
};

export default function PurchaseOrders() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();
  const { purchaseOrders, isLoading, totalPOs, openPOs, openValue, updatePurchaseOrderStatus, convertToBill } = usePurchaseOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [sharePo, setSharePo] = useState<any | null>(null);
  const [docsPo, setDocsPo] = useState<any | null>(null);


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

  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = 
      po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (po.vendor?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!orgLoading && !organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Found</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Create an organization to start creating purchase orders.
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
          <h1 className="text-2xl font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage vendor purchase orders</p>
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
              New Purchase Order
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total POs</p>
          <p className="text-2xl font-bold text-foreground">{totalPOs}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Open POs</p>
          <p className="text-2xl font-bold text-primary">{openPOs}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Open Value</p>
          <p className="text-2xl font-bold text-warning">{formatCurrency(openValue)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search purchase orders..."
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
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {filteredPOs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {purchaseOrders.length === 0 ? 'No purchase orders yet.' : 'No purchase orders match your search.'}
          </div>
        ) : (
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th>PO #</th>
                <th>Vendor</th>
                <th>Date</th>
                <th>Expected</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map((po) => {
                const status = statusConfig[po.status] || statusConfig.draft;
                const StatusIcon = status.icon;
                return (
                  <tr key={po.id} className="hover:bg-muted/20">
                    <td className="font-medium text-accent">{po.po_number}</td>
                    <td>{po.vendor?.name || 'Unknown'}</td>
                    <td className="text-muted-foreground">{formatDate(po.po_date)}</td>
                    <td className="text-muted-foreground">{po.expected_date ? formatDate(po.expected_date) : '-'}</td>
                    <td>
                      <Badge className={cn('gap-1', status.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    </td>
                    <td className="text-right font-mono font-medium">{formatCurrency(Number(po.total))}</td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Edit PO</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSharePo(po)}>
                            <Send className="w-4 h-4 mr-2" /> Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDocsPo(po)}>
                            <Paperclip className="w-4 h-4 mr-2" /> Attach / Analyze Documents
                          </DropdownMenuItem>
                          <DropdownMenuItem>Download PDF</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {po.status === 'draft' && (
                            <DropdownMenuItem onClick={() => updatePurchaseOrderStatus.mutate({ id: po.id, status: 'sent' })}>
                              Mark as Sent
                            </DropdownMenuItem>
                          )}
                          {po.status === 'sent' && (
                            <DropdownMenuItem onClick={() => updatePurchaseOrderStatus.mutate({ id: po.id, status: 'acknowledged' })}>
                              Mark as Acknowledged
                            </DropdownMenuItem>
                          )}
                          {['acknowledged', 'partial'].includes(po.status) && (
                            <DropdownMenuItem onClick={() => updatePurchaseOrderStatus.mutate({ id: po.id, status: 'received' })}>
                              Mark as Received
                            </DropdownMenuItem>
                          )}
                          {po.status === 'received' && (
                            <DropdownMenuItem onClick={() => convertToBill.mutate(po.id)}>
                              <ArrowRight className="w-4 h-4 mr-2" />
                              Convert to Bill
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

      <CreatePurchaseOrderDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
      <DocumentShareDialog
        open={sharePo !== null}
        onOpenChange={(o) => !o && setSharePo(null)}
        kind="purchase_order"
        document={sharePo ? {
          id: sharePo.id,
          number: sharePo.po_number,
          date: sharePo.po_date,
          dueDate: sharePo.expected_date,
          total: Number(sharePo.total),
          notes: sharePo.notes,
        } : null}
        contact={sharePo?.vendor ? {
          name: sharePo.vendor.name,
          email: sharePo.vendor.email,
          phone: sharePo.vendor.phone,
        } : null}
      />
      <PurchaseAttachmentsDialog
        open={docsPo !== null}
        onOpenChange={(o) => !o && setDocsPo(null)}
        entityType="purchase_order"
        entityId={docsPo?.id}
        organizationId={docsPo?.organization_id ?? organization?.id}
        title={docsPo ? `PO ${docsPo.po_number} — Documents` : undefined}
        currentNotes={docsPo?.notes}
        invalidateKeys={["purchase_orders"]}
      />
    </div>
  );
}
