import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, MoreHorizontal, Check, AlertTriangle, Clock, DollarSign, Send, Paperclip, Sparkles, Eye, Pencil, Ban } from 'lucide-react';
import { AICategorizeAPDialog } from '@/components/purchases/AICategorizeAPDialog';
import { PurchaseAttachmentsDialog } from '@/components/purchases/PurchaseAttachmentsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, parseLocalDate } from '@/lib/utils';
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
import { useBills } from '@/hooks/useBills';
import { CreateBillDialog } from '@/components/bills/CreateBillDialog';
import { RecordVendorPaymentDialog } from '@/components/vendors/RecordVendorPaymentDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { DocumentShareDialog } from '@/components/shared/DocumentShareDialog';
import { ViewBillDialog } from '@/components/bills/ViewBillDialog';
import { EditBillDialog } from '@/components/bills/EditBillDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Bills() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<{ vendorId?: string; billId?: string }>({});
  const [shareBill, setShareBill] = useState<any | null>(null);
  const [docsBill, setDocsBill] = useState<any | null>(null);
  const [viewBill, setViewBill] = useState<any | null>(null);
  const [editBill, setEditBill] = useState<any | null>(null);
  const [billToVoid, setBillToVoid] = useState<any | null>(null);
  const [showAICategorize, setShowAICategorize] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // When navigated with ?vendor=<id> (e.g. "Pay bill" from the Provincial
  // Remittance Centre), auto-open the Create Bill dialog pre-filled with that
  // vendor.
  const prefillVendorId = searchParams.get('vendor');
  const [pendingPrefill, setPendingPrefill] = useState<string | null>(null);

  useState(() => {
    if (prefillVendorId) {
      setPendingPrefill(prefillVendorId);
      setShowBillDialog(true);
      searchParams.delete('vendor');
      setSearchParams(searchParams, { replace: true });
    }
  });

  const { bills, isLoading, totalOutstanding, overdueAmount, paidThisMonth, updateBillStatus, voidBill } = useBills();
  const { organization } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();
  
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
    }).format(parseLocalDate(date));
  };

  const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
    draft: { label: 'Draft', icon: Clock, color: 'bg-muted text-muted-foreground' },
    pending: { label: 'Pending', icon: Clock, color: 'bg-warning/10 text-warning' },
    approved: { label: 'Approved', icon: Check, color: 'bg-blue-500/10 text-blue-600' },
    paid: { label: 'Paid', icon: Check, color: 'bg-success/10 text-success' },
    overdue: { label: 'Overdue', icon: AlertTriangle, color: 'bg-destructive/10 text-destructive' },
    void: { label: 'Void', icon: Ban, color: 'bg-destructive/10 text-destructive line-through' },
  };

  const filteredBills = bills.filter(bill => {
    const matchesSearch = bill.bill_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bill.vendor?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || bill.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-24 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-20" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bills</h1>
          <p className="text-muted-foreground">Manage vendor bills and payments</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {!isReadOnly && (
            <Button variant="outline" size="sm" onClick={() => setShowAICategorize(true)}>
              <Sparkles className="w-4 h-4 mr-2" />
              AI Categorize Lines
            </Button>
          )}
          {!isReadOnly && (
            <Button 
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={() => setShowBillDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Bill
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Bills</p>
          <p className="text-2xl font-bold text-foreground">{bills.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-warning">{formatCurrency(totalOutstanding)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Overdue</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(overdueAmount)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Paid This Month</p>
          <p className="text-2xl font-bold text-success">{formatCurrency(paidThisMonth)}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by bill number or vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Bills Table */}
      <Card className="overflow-hidden">
        {filteredBills.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {searchQuery || statusFilter !== 'all' 
              ? 'No bills found matching your filters.'
              : 'No bills yet. Create your first bill to get started.'}
          </div>
        ) : (
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th>Bill #</th>
                <th>Vendor</th>
                <th>Date</th>
                <th>Due Date</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Balance</th>
                <th>Status</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((bill) => {
                const status = statusConfig[bill.status] || statusConfig.draft;
                const StatusIcon = status.icon;
                const isOverdue = parseLocalDate(bill.due_date) < new Date() && bill.status !== 'paid';
                
                return (
                  <tr key={bill.id} className="hover:bg-muted/20">
                    <td className="font-mono font-medium text-accent">{bill.bill_number}</td>
                    <td className="font-medium">{bill.vendor?.name || 'Unknown Vendor'}</td>
                    <td className="text-muted-foreground">{formatDate(bill.bill_date)}</td>
                    <td className={cn(
                      isOverdue && "text-destructive font-medium"
                    )}>
                      {formatDate(bill.due_date)}
                    </td>
                    <td className="text-right font-mono">{formatCurrency(bill.total)}</td>
                    <td className={cn(
                      "text-right font-mono",
                      bill.balance_due > 0 && "text-warning font-medium"
                    )}>
                      {formatCurrency(bill.balance_due)}
                    </td>
                    <td>
                      <Badge className={cn("gap-1", status.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewBill(bill)}>
                            <Eye className="w-4 h-4 mr-2" /> View Bill
                          </DropdownMenuItem>
                          {!isReadOnly && bill.status !== 'void' && bill.status !== 'paid' && (
                            <DropdownMenuItem onClick={() => setEditBill(bill)}>
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setShareBill(bill)}>
                            <Send className="w-4 h-4 mr-2" /> Share
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDocsBill(bill)}>
                            <Paperclip className="w-4 h-4 mr-2" /> Attach / Analyze Documents
                          </DropdownMenuItem>
                          {!isReadOnly && bill.status === 'pending' && (
                            <DropdownMenuItem onClick={() => updateBillStatus.mutate({ billId: bill.id, status: 'approved' })}>
                              Approve
                            </DropdownMenuItem>
                          )}
                          {!isReadOnly && (bill.status === 'approved' || bill.status === 'received' || bill.status === 'partial') && (
                            <DropdownMenuItem onClick={() => {
                              setSelectedBillForPayment({ vendorId: bill.vendor_id, billId: bill.id });
                              setShowPaymentDialog(true);
                            }}>
                              <DollarSign className="w-4 h-4 mr-2" />
                              Record Payment
                            </DropdownMenuItem>
                          )}
                          {!isReadOnly && bill.status !== 'void' && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setBillToVoid(bill)}
                            >
                              <Ban className="w-4 h-4 mr-2" /> Void Bill
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

      {/* Dialogs */}
      <CreateBillDialog open={showBillDialog} onOpenChange={setShowBillDialog} />
      <RecordVendorPaymentDialog 
        open={showPaymentDialog} 
        onOpenChange={(open) => {
          setShowPaymentDialog(open);
          if (!open) setSelectedBillForPayment({});
        }}
        preselectedVendorId={selectedBillForPayment.vendorId}
        preselectedBillId={selectedBillForPayment.billId}
      />
      <DocumentShareDialog
        open={shareBill !== null}
        onOpenChange={(o) => !o && setShareBill(null)}
        kind="bill"
        document={shareBill ? {
          id: shareBill.id,
          number: shareBill.bill_number,
          date: shareBill.bill_date,
          dueDate: shareBill.due_date,
          total: Number(shareBill.total),
          balanceDue: Number(shareBill.balance_due),
          notes: shareBill.notes,
        } : null}
        contact={shareBill?.vendor ? {
          name: shareBill.vendor.name,
          email: shareBill.vendor.email,
          phone: shareBill.vendor.phone,
        } : null}
      />
      <PurchaseAttachmentsDialog
        open={docsBill !== null}
        onOpenChange={(o) => !o && setDocsBill(null)}
        entityType="bill"
        entityId={docsBill?.id}
        organizationId={docsBill?.organization_id ?? organization?.id}
        title={docsBill ? `Bill ${docsBill.bill_number} — Documents` : undefined}
        currentNotes={docsBill?.notes}
        invalidateKeys={["bills"]}
      />
      <AICategorizeAPDialog
        open={showAICategorize}
        onOpenChange={setShowAICategorize}
        target="bill"
      />
      <ViewBillDialog
        open={viewBill !== null}
        onOpenChange={(o) => !o && setViewBill(null)}
        bill={viewBill}
      />
      <EditBillDialog
        open={editBill !== null}
        onOpenChange={(o) => !o && setEditBill(null)}
        bill={editBill}
      />
      <AlertDialog open={billToVoid !== null} onOpenChange={(o) => !o && setBillToVoid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void bill {billToVoid?.bill_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This reverses the bill's journal entry so it no longer affects the General Ledger,
              Trial Balance or financial statements. The bill and its reversal stay on record for
              audit purposes. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (billToVoid) voidBill.mutate(billToVoid.id);
                setBillToVoid(null);
              }}
            >
              Void Bill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
