import { useState, useMemo, useCallback } from 'react';
import { Plus, Heart, Receipt, Target, Wallet, HandCoins, MoreHorizontal, CheckCircle, XCircle, Users, Pencil, Trash2, Ban, FileText, Scale, Download, Printer, FileCheck, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDonations, useDonationStats, useConfirmDonation, useCancelDonation, useDeleteDonation, useDonationPrograms, useDonationFunds, useDonationCampaigns, useDonationPledges, useUpdateProgram, useDeleteProgram, useUpdatePledge, useDeletePledge, useCancelPledge } from '@/hooks/useDonations';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { RecordDonationDialog } from '@/components/donations/RecordDonationDialog';
import { EditDonationDialog } from '@/components/donations/EditDonationDialog';
import { IssueReceiptDialog } from '@/components/donations/IssueReceiptDialog';
import { BulkIssueReceiptsDialog } from '@/components/donations/BulkIssueReceiptsDialog';
import { AddProgramDialog } from '@/components/donations/AddProgramDialog';
import { EditProgramDialog } from '@/components/donations/EditProgramDialog';
import { AddFundDialog } from '@/components/donations/AddFundDialog';
import { AddCampaignDialog } from '@/components/donations/AddCampaignDialog';
import { AddPledgeDialog } from '@/components/donations/AddPledgeDialog';
import { EditPledgeDialog } from '@/components/donations/EditPledgeDialog';
import type { Donation, DonationProgram, DonationPledge } from '@/types/donations';
import { useIsReadOnly } from '@/hooks/useIsReadOnly';
import { SearchableCustomerSelect } from '@/components/banking/SearchableCustomerSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DonorSummaryDashboard } from '@/components/donations/DonorSummaryDashboard';
import { T3010Report } from '@/components/donations/T3010Report';
import { DonationReconciliation } from '@/components/donations/DonationReconciliation';
import { DonationReceiptsTab } from '@/components/donations/DonationReceiptsTab';
import { ReportActions, type ReportData } from '@/components/reports/ReportActions';
import { PostUnlinkedDonationsButton } from '@/components/donations/PostUnlinkedDonationsButton';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { useNpoTerminology } from '@/hooks/useNpoTerminology';
import { downloadDonationReceiptWithLogo, printDonationReceiptWithLogo } from '@/lib/print/donationReceiptGenerator';
import { useDonationReceipts } from '@/hooks/useDonations';

export default function Donations() {
  const { organization, isLoading: orgLoading } = useCurrentOrganization();
  const isReadOnly = useIsReadOnly();
  const { data: donations = [], isLoading } = useDonations();
  const { data: stats } = useDonationStats();
  const { data: programs = [] } = useDonationPrograms();
  const { data: funds = [] } = useDonationFunds();
  const { data: campaigns = [] } = useDonationCampaigns();
  const { data: pledges = [] } = useDonationPledges();
  const { data: allReceipts = [] } = useDonationReceipts();
  const confirmDonation = useConfirmDonation();
  const cancelDonation = useCancelDonation();
  const deleteDonation = useDeleteDonation();
  const deleteProgram = useDeleteProgram();
  const updateProgram = useUpdateProgram();
  const deletePledgeMutation = useDeletePledge();
  const cancelPledgeMutation = useCancelPledge();

  const [addDonationOpen, setAddDonationOpen] = useState(false);
  const [addProgramOpen, setAddProgramOpen] = useState(false);
  const [addFundOpen, setAddFundOpen] = useState(false);
  const [addCampaignOpen, setAddCampaignOpen] = useState(false);
  const [addPledgeOpen, setAddPledgeOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [bulkReceiptOpen, setBulkReceiptOpen] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  
  // Edit/Delete/Cancel state for donations
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingDonation, setDeletingDonation] = useState<Donation | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingDonation, setCancellingDonation] = useState<Donation | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Edit/Delete state for programs
  const [editProgramOpen, setEditProgramOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<DonationProgram | null>(null);
  const [deleteProgramConfirmOpen, setDeleteProgramConfirmOpen] = useState(false);
  const [deletingProgram, setDeletingProgram] = useState<DonationProgram | null>(null);

  // Edit/Delete state for pledges
  const [editPledgeOpen, setEditPledgeOpen] = useState(false);
  const [editingPledge, setEditingPledge] = useState<DonationPledge | null>(null);
  const [deletePledgeConfirmOpen, setDeletePledgeConfirmOpen] = useState(false);
  const [deletingPledge, setDeletingPledge] = useState<DonationPledge | null>(null);

  const { formatWithSymbol } = useCurrencyFormatter();
  const formatCurrency = formatWithSymbol;
  const { isNpo } = useNpoTerminology();

  // Filter state for Donations tab
  const [donorFilter, setDonorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [receiptFilter, setReceiptFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sort state for Donations tab
  type DonationSortColumn = 'donation_number' | 'donor' | 'date_received' | 'amount' | 'eligible_amount' | 'status';
  const [sortColumn, setSortColumn] = useState<DonationSortColumn>('date_received');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = useCallback((col: DonationSortColumn) => {
    if (sortColumn === col) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const filteredDonations = useMemo(() => {
    let result = donations.filter(d => {
      if (donorFilter && d.donor_id !== donorFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (typeFilter !== 'all' && d.donation_type !== typeFilter) return false;
      if (receiptFilter === 'issued' && !d.receipt_issued) return false;
      if (receiptFilter === 'not_issued' && d.receipt_issued) return false;
      if (dateFrom && d.date_received < dateFrom) return false;
      if (dateTo && d.date_received > dateTo) return false;
      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'donation_number': cmp = a.donation_number.localeCompare(b.donation_number); break;
        case 'donor': cmp = (a.donor?.name || '').localeCompare(b.donor?.name || ''); break;
        case 'date_received': cmp = a.date_received.localeCompare(b.date_received); break;
        case 'amount': cmp = a.amount - b.amount; break;
        case 'eligible_amount': cmp = a.eligible_amount - b.eligible_amount; break;
        case 'status': cmp = a.status.localeCompare(b.status); break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [donations, donorFilter, statusFilter, typeFilter, receiptFilter, dateFrom, dateTo, sortColumn, sortDirection]);

  const hasActiveFilters = donorFilter || statusFilter !== 'all' || typeFilter !== 'all' || receiptFilter !== 'all' || dateFrom || dateTo;

  const clearAllFilters = () => {
    setDonorFilter('');
    setStatusFilter('all');
    setTypeFilter('all');
    setReceiptFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  // Build report data for Donations tab export
  const donationsReportData: ReportData = useMemo(() => {
    const totalAmount = donations.reduce((s, d) => s + d.amount, 0);
    const totalEligible = donations.reduce((s, d) => s + d.eligible_amount, 0);
    return {
      title: 'Donations Report',
      subtitle: `${donations.length} donation(s)`,
      organizationName: organization?.name || '',
      headers: ['Number', 'Donor', 'Date', 'Type', 'Source', 'Amount', 'Eligible', 'Status', 'Receipt'],
      rows: donations.map(d => [
        d.donation_number,
        d.donor?.name || 'Unknown',
        new Date(d.date_received).toLocaleDateString(),
        d.donation_type.replace('_', ' '),
        d.bank_transaction_id ? 'Bank' : 'Manual',
        formatCurrency(d.amount),
        formatCurrency(d.eligible_amount),
        d.status,
        d.receipt_issued ? 'Issued' : 'No',
      ]),
      totals: [
        { label: 'Total Amount', value: formatCurrency(totalAmount) },
        { label: 'Total Eligible', value: formatCurrency(totalEligible) },
      ],
    };
  }, [donations, formatCurrency, organization?.name]);

  const handleDelete = async () => {
    if (!deletingDonation) return;
    await deleteDonation.mutateAsync(deletingDonation.id);
    setDeleteConfirmOpen(false);
    setDeletingDonation(null);
  };

  const handleCancel = async () => {
    if (!cancellingDonation || !cancelReason.trim()) return;
    await cancelDonation.mutateAsync({ donationId: cancellingDonation.id, reason: cancelReason });
    setCancelDialogOpen(false);
    setCancellingDonation(null);
    setCancelReason('');
  };

  const handleDeleteProgram = async () => {
    if (!deletingProgram) return;
    await deleteProgram.mutateAsync(deletingProgram.id);
    setDeleteProgramConfirmOpen(false);
    setDeletingProgram(null);
  };

  const handleDeletePledge = async () => {
    if (!deletingPledge) return;
    await deletePledgeMutation.mutateAsync(deletingPledge.id);
    setDeletePledgeConfirmOpen(false);
    setDeletingPledge(null);
  };

  if (isLoading || orgLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Donation Management</h1>
          <p className="text-muted-foreground">CRA & NPO compliant donation tracking</p>
        </div>
        <div className="flex gap-2">
          <PostUnlinkedDonationsButton />
          <ReportActions reportData={donationsReportData} variant="compact" />
          {!isReadOnly && (
            <>
              <Button variant="outline" onClick={() => setBulkReceiptOpen(true)}>
                <Receipt className="w-4 h-4 mr-2" />Issue Year-End Receipts
              </Button>
              <Button onClick={() => setAddDonationOpen(true)}><Plus className="w-4 h-4 mr-2" />Record Donation</Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4"><p className="text-sm text-muted-foreground">Total Donations</p><p className="text-2xl font-bold">{formatCurrency(stats?.totalDonations || 0)}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Eligible Amount</p><p className="text-2xl font-bold text-success">{formatCurrency(stats?.totalEligible || 0)}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Donations</p><p className="text-2xl font-bold">{stats?.donationCount || 0}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Receipts Issued</p><p className="text-2xl font-bold">{stats?.receiptsIssued || 0}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Pending Pledges</p><p className="text-2xl font-bold">{formatCurrency(stats?.pendingPledges || 0)}</p></Card>
      </div>

      <Tabs defaultValue="donations">
        <TabsList>
          <TabsTrigger value="donations"><Heart className="w-4 h-4 mr-1" />Donations</TabsTrigger>
          <TabsTrigger value="donors"><Users className="w-4 h-4 mr-1" />Donor Summary</TabsTrigger>
          <TabsTrigger value="pledges"><HandCoins className="w-4 h-4 mr-1" />Pledges</TabsTrigger>
          <TabsTrigger value="programs"><Target className="w-4 h-4 mr-1" />Programs</TabsTrigger>
          <TabsTrigger value="funds"><Wallet className="w-4 h-4 mr-1" />Funds</TabsTrigger>
          <TabsTrigger value="campaigns"><Receipt className="w-4 h-4 mr-1" />Campaigns</TabsTrigger>
          <TabsTrigger value="receipts"><FileCheck className="w-4 h-4 mr-1" />Receipts</TabsTrigger>
          <TabsTrigger value="reconciliation"><Scale className="w-4 h-4 mr-1" />Reconciliation</TabsTrigger>
          {isNpo && <TabsTrigger value="t3010"><FileText className="w-4 h-4 mr-1" />T3010 Return</TabsTrigger>}
        </TabsList>

        <TabsContent value="donations" className="mt-4 space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Donor</label>
              <SearchableCustomerSelect
                value={donorFilter}
                onValueChange={(id) => setDonorFilter(id)}
                placeholder="All donors"
                className="h-9 text-sm"
              />
            </div>
            <div className="w-[140px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[160px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="e_transfer">E-Transfer</SelectItem>
                  <SelectItem value="securities">Securities</SelectItem>
                  <SelectItem value="in_kind">In-Kind</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[140px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Receipt</label>
              <Select value={receiptFilter} onValueChange={setReceiptFilter}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="not_issued">Not Issued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[130px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="w-[130px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm" />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-xs">
                <X className="w-3 h-3 mr-1" />Clear
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredDonations.length} of {donations.length} donation(s)
            </p>
          )}

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('donation_number')}>
                    <span className="inline-flex items-center gap-1">Number {sortColumn === 'donation_number' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('donor')}>
                    <span className="inline-flex items-center gap-1">Donor {sortColumn === 'donor' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('date_received')}>
                    <span className="inline-flex items-center gap-1">Date {sortColumn === 'date_received' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}</span>
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('amount')}>
                    <span className="inline-flex items-center gap-1 justify-end">Amount {sortColumn === 'amount' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}</span>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('eligible_amount')}>
                    <span className="inline-flex items-center gap-1 justify-end">Eligible {sortColumn === 'eligible_amount' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                    <span className="inline-flex items-center gap-1">Status {sortColumn === 'status' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}</span>
                  </TableHead>
                  <TableHead>Receipt</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDonations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.donation_number}</TableCell>
                    <TableCell>{d.donor?.name || 'Unknown'}</TableCell>
                    <TableCell>{new Date(d.date_received).toLocaleDateString()}</TableCell>
                    <TableCell className="capitalize">{d.donation_type.replace('_', ' ')}</TableCell>
                    <TableCell>
                      {d.bank_transaction_id ? (
                        <Badge variant="outline" className="text-xs"><Wallet className="w-3 h-3 mr-1" />Bank</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Manual</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(d.amount)}</TableCell>
                    <TableCell className="text-right text-success">{formatCurrency(d.eligible_amount)}</TableCell>
                    <TableCell><Badge variant={d.status === 'confirmed' ? 'default' : d.status === 'draft' ? 'secondary' : 'destructive'}>{d.status}</Badge></TableCell>
                    <TableCell>{d.receipt_issued ? <CheckCircle className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {d.status === 'draft' && !isReadOnly && (
                            <DropdownMenuItem onClick={() => { setEditingDonation(d); setEditDialogOpen(true); }}>
                              <Pencil className="w-4 h-4 mr-2" />Edit
                            </DropdownMenuItem>
                          )}
                          {d.status === 'draft' && !isReadOnly && (
                            <DropdownMenuItem onClick={() => confirmDonation.mutate(d.id)}>
                              <CheckCircle className="w-4 h-4 mr-2" />Confirm
                            </DropdownMenuItem>
                          )}
                          {d.status === 'confirmed' && !d.receipt_issued && !isReadOnly && (
                            <DropdownMenuItem onClick={() => { setSelectedDonation(d); setReceiptDialogOpen(true); }}>
                              <Receipt className="w-4 h-4 mr-2" />Issue CRA Receipt
                            </DropdownMenuItem>
                          )}
                          {d.status === 'confirmed' && !isReadOnly && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setCancellingDonation(d); setCancelDialogOpen(true); }} className="text-destructive">
                                <Ban className="w-4 h-4 mr-2" />Cancel Donation
                              </DropdownMenuItem>
                            </>
                          )}
                          {d.status === 'draft' && !d.receipt_issued && !isReadOnly && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setDeletingDonation(d); setDeleteConfirmOpen(true); }} className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" />Delete
                              </DropdownMenuItem>
                            </>
                          )}
                          {d.receipt_issued && (
                            <>
                              <DropdownMenuItem onClick={() => {
                                const receipt = allReceipts.find(r => r.id === d.receipt_id);
                                if (receipt) downloadDonationReceiptWithLogo(receipt, organization?.receipt_show_logo === false ? undefined : (organization?.receipt_logo_url || organization?.logo_url));
                              }}>
                                <Download className="w-4 h-4 mr-2" />Download Receipt PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                const receipt = allReceipts.find(r => r.id === d.receipt_id);
                                if (receipt) printDonationReceiptWithLogo(receipt, organization?.receipt_show_logo === false ? undefined : (organization?.receipt_logo_url || organization?.logo_url));
                              }}>
                                <Printer className="w-4 h-4 mr-2" />Print Receipt
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem disabled className="text-success">
                                <CheckCircle className="w-4 h-4 mr-2" />Receipt Issued
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredDonations.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{hasActiveFilters ? 'No donations match your filters' : 'No donations recorded yet. Donations are automatically created when you post NPO deposit transactions with a linked donor.'}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="donors" className="mt-4">
          <DonorSummaryDashboard />
        </TabsContent>

        <TabsContent value="pledges" className="mt-4">
          <div className="flex justify-end mb-4">{!isReadOnly && <Button onClick={() => setAddPledgeOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Pledge</Button>}</div>
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Donor</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Fulfilled</TableHead><TableHead className="text-right">Remaining</TableHead><TableHead>Status</TableHead>{!isReadOnly && <TableHead></TableHead>}</TableRow></TableHeader>
              <TableBody>
                {pledges.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.pledge_number}</TableCell>
                    <TableCell>{p.donor?.name}</TableCell>
                    <TableCell>{new Date(p.pledge_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.total_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.fulfilled_amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(p.remaining_amount)}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    {!isReadOnly && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(p.status === 'pending' || p.status === 'partially_fulfilled') && (
                              <DropdownMenuItem onClick={() => { setEditingPledge(p); setEditPledgeOpen(true); }}>
                                <Pencil className="w-4 h-4 mr-2" />Edit
                              </DropdownMenuItem>
                            )}
                            {p.status === 'partially_fulfilled' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => cancelPledgeMutation.mutate(p.id)} className="text-destructive">
                                  <Ban className="w-4 h-4 mr-2" />Cancel Pledge
                                </DropdownMenuItem>
                              </>
                            )}
                            {p.status === 'pending' && p.fulfilled_amount === 0 && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setDeletingPledge(p); setDeletePledgeConfirmOpen(true); }} className="text-destructive">
                                  <Trash2 className="w-4 h-4 mr-2" />Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {pledges.length === 0 && <TableRow><TableCell colSpan={!isReadOnly ? 8 : 7} className="text-center py-8 text-muted-foreground">No pledges recorded</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="programs" className="mt-4">
          <div className="flex justify-end mb-4">{!isReadOnly && <Button onClick={() => setAddProgramOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Program</Button>}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {programs.map((p) => (
              <Card key={p.id} className={`p-4 ${!p.is_active ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-sm text-muted-foreground">{p.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isReadOnly && (
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={(checked) => updateProgram.mutate({ programId: p.id, updates: { is_active: checked } })}
                        aria-label={`Toggle ${p.name} active`}
                      />
                    )}
                    {!isReadOnly && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingProgram(p); setEditProgramOpen(true); }}>
                            <Pencil className="w-4 h-4 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setDeletingProgram(p); setDeleteProgramConfirmOpen(true); }} className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
                {p.budget > 0 && <p className="mt-2">Budget: {formatCurrency(p.budget)}</p>}
                {!p.is_active && <Badge variant="secondary" className="mt-2">Inactive</Badge>}
              </Card>
            ))}
            {programs.length === 0 && <Card className="p-8 col-span-3 text-center text-muted-foreground">No programs created</Card>}
          </div>
        </TabsContent>

        <TabsContent value="funds" className="mt-4">
          <div className="flex justify-end mb-4"><Button onClick={() => setAddFundOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Fund</Button></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {funds.map((f) => (<Card key={f.id} className="p-4"><div className="flex justify-between"><h3 className="font-semibold">{f.name}</h3><Badge variant="outline" className="capitalize">{f.fund_type}</Badge></div><p className="text-sm text-muted-foreground">{f.code}</p><p className="mt-2 text-lg font-bold">{formatCurrency(f.current_balance)}</p></Card>))}
            {funds.length === 0 && <Card className="p-8 col-span-3 text-center text-muted-foreground">No funds created</Card>}
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <div className="flex justify-end mb-4"><Button onClick={() => setAddCampaignOpen(true)}><Plus className="w-4 h-4 mr-2" />Add Campaign</Button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((c) => (<Card key={c.id} className="p-4"><h3 className="font-semibold">{c.name}</h3><p className="text-sm text-muted-foreground">{c.code}</p>{c.goal_amount && <div className="mt-2"><div className="flex justify-between text-sm"><span>Raised: {formatCurrency(c.raised_amount)}</span><span>Goal: {formatCurrency(c.goal_amount)}</span></div><div className="h-2 bg-muted rounded mt-1"><div className="h-full bg-primary rounded" style={{ width: `${Math.min((c.raised_amount / c.goal_amount) * 100, 100)}%` }} /></div></div>}</Card>))}
            {campaigns.length === 0 && <Card className="p-8 col-span-2 text-center text-muted-foreground">No campaigns created</Card>}
          </div>
        </TabsContent>

        <TabsContent value="receipts" className="mt-4">
          <DonationReceiptsTab />
        </TabsContent>

        <TabsContent value="reconciliation" className="mt-4">
          <DonationReconciliation />
        </TabsContent>

        {isNpo && (
          <TabsContent value="t3010" className="mt-4">
            <T3010Report />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      <RecordDonationDialog open={addDonationOpen} onOpenChange={setAddDonationOpen} />
      <EditDonationDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} donation={editingDonation} />
      <AddProgramDialog open={addProgramOpen} onOpenChange={setAddProgramOpen} />
      <EditProgramDialog open={editProgramOpen} onOpenChange={setEditProgramOpen} program={editingProgram} />
      <AddFundDialog open={addFundOpen} onOpenChange={setAddFundOpen} />
      <AddCampaignDialog open={addCampaignOpen} onOpenChange={setAddCampaignOpen} />
      <AddPledgeDialog open={addPledgeOpen} onOpenChange={setAddPledgeOpen} />
      <EditPledgeDialog open={editPledgeOpen} onOpenChange={setEditPledgeOpen} pledge={editingPledge} />
      <IssueReceiptDialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen} donation={selectedDonation} />
      <BulkIssueReceiptsDialog open={bulkReceiptOpen} onOpenChange={setBulkReceiptOpen} />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Donation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete donation {deletingDonation?.donation_number}? This action cannot be undone.
              Only draft donations without receipts can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Donation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Donation {cancellingDonation?.donation_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cancelled donations are retained for CRA audit trail purposes. This action cannot be undone.
            </p>
            <div className="space-y-2">
              <Label>Cancellation Reason *</Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Donor requested refund, duplicate entry"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Back</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={!cancelReason.trim() || cancelDonation.isPending}>
              {cancelDonation.isPending ? 'Cancelling...' : 'Cancel Donation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Program Confirmation */}
      <AlertDialog open={deleteProgramConfirmOpen} onOpenChange={setDeleteProgramConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Program</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate "{deletingProgram?.name}"? Existing donations referencing this program are unaffected. The program will no longer appear for new donations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProgram} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Pledge Confirmation */}
      <AlertDialog open={deletePledgeConfirmOpen} onOpenChange={setDeletePledgeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pledge</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete pledge {deletingPledge?.pledge_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePledge} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
