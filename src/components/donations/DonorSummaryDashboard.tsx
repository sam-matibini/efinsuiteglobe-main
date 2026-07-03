import { useMemo, useState, useCallback } from 'react';
import { Users, Heart, Receipt, HandCoins, TrendingUp, Search, ChevronDown, ChevronRight, Download, Share2, Printer, X, Filter, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDonations, useDonationPledges, useDonationReceipts } from '@/hooks/useDonations';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { ReportActions, type ReportData } from '@/components/reports/ReportActions';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { downloadDonationReceiptWithLogo, printDonationReceiptWithLogo } from '@/lib/print/donationReceiptGenerator';
import { ShareReceiptDialog } from './ShareReceiptDialog';
import { SearchableCustomerSelect } from '@/components/banking/SearchableCustomerSelect';
import type { Donation, DonationPledge, DonationReceipt } from '@/types/donations';

interface DonorSummary {
  donorId: string;
  donorName: string;
  donorEmail: string | null;
  totalDonations: number;
  donationCount: number;
  totalEligible: number;
  receiptsIssued: number;
  receiptsPending: number;
  lastDonationDate: string;
  pledgeTotal: number;
  pledgeFulfilled: number;
  pledgeRemaining: number;
  pledgeCount: number;
  donations: Donation[];
  pledges: DonationPledge[];
}

export function DonorSummaryDashboard() {
  const { data: donations = [] } = useDonations();
  const { data: pledges = [] } = useDonationPledges();
  const { data: allReceipts = [] } = useDonationReceipts();
  const { organization } = useCurrentOrganization();
  const { formatWithSymbol } = useCurrencyFormatter();
  const formatCurrency = formatWithSymbol;
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDonor, setExpandedDonor] = useState<string | null>(null);
  const [shareReceipt, setShareReceipt] = useState<DonationReceipt | null>(null);

  // Filter state
  const [donorFilter, setDonorFilter] = useState('');
  const [receiptStatusFilter, setReceiptStatusFilter] = useState('all');
  const [pledgeStatusFilter, setPledgeStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');

  // Sort state
  type DonorSortColumn = 'donorName' | 'totalDonations' | 'totalEligible' | 'donationCount' | 'receiptsIssued' | 'lastDonationDate';
  const [sortColumn, setSortColumn] = useState<DonorSortColumn>('totalDonations');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = useCallback((col: DonorSortColumn) => {
    if (sortColumn === col) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const donorSummaries = useMemo(() => {
    const map = new Map<string, DonorSummary>();

    for (const d of donations) {
      const id = d.donor_id;
      if (!map.has(id)) {
        map.set(id, {
          donorId: id,
          donorName: d.donor?.name || 'Unknown',
          donorEmail: d.donor?.email || null,
          totalDonations: 0,
          donationCount: 0,
          totalEligible: 0,
          receiptsIssued: 0,
          receiptsPending: 0,
          lastDonationDate: d.date_received,
          pledgeTotal: 0,
          pledgeFulfilled: 0,
          pledgeRemaining: 0,
          pledgeCount: 0,
          donations: [],
          pledges: [],
        });
      }
      const s = map.get(id)!;
      s.totalDonations += d.amount;
      s.donationCount += 1;
      s.totalEligible += d.eligible_amount;
      if (d.receipt_issued) s.receiptsIssued += 1;
      else if (d.status === 'confirmed') s.receiptsPending += 1;
      if (d.date_received > s.lastDonationDate) s.lastDonationDate = d.date_received;
      s.donations.push(d);
    }

    for (const p of pledges) {
      const id = p.donor_id;
      if (!map.has(id)) {
        map.set(id, {
          donorId: id,
          donorName: p.donor?.name || 'Unknown',
          donorEmail: null,
          totalDonations: 0,
          donationCount: 0,
          totalEligible: 0,
          receiptsIssued: 0,
          receiptsPending: 0,
          lastDonationDate: '',
          pledgeTotal: 0,
          pledgeFulfilled: 0,
          pledgeRemaining: 0,
          pledgeCount: 0,
          donations: [],
          pledges: [],
        });
      }
      const s = map.get(id)!;
      s.pledgeTotal += p.total_amount;
      s.pledgeFulfilled += p.fulfilled_amount;
      s.pledgeRemaining += p.remaining_amount;
      s.pledgeCount += 1;
      s.pledges.push(p);
    }

    return Array.from(map.values()).sort((a, b) => b.totalDonations - a.totalDonations);
  }, [donations, pledges]);

  const hasActiveFilters = donorFilter || receiptStatusFilter !== 'all' || pledgeStatusFilter !== 'all' || dateFrom || dateTo || minAmount || searchQuery;

  const clearAllFilters = () => {
    setDonorFilter('');
    setReceiptStatusFilter('all');
    setPledgeStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setMinAmount('');
    setSearchQuery('');
  };

  const filtered = useMemo(() => {
    let result = donorSummaries;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) => s.donorName.toLowerCase().includes(q) || s.donorEmail?.toLowerCase().includes(q)
      );
    }

    if (donorFilter) {
      result = result.filter((s) => s.donorId === donorFilter);
    }

    if (receiptStatusFilter !== 'all') {
      result = result.filter((s) => {
        if (receiptStatusFilter === 'issued') return s.receiptsIssued > 0;
        if (receiptStatusFilter === 'pending') return s.receiptsPending > 0;
        if (receiptStatusFilter === 'none') return s.receiptsIssued === 0 && s.receiptsPending === 0;
        return true;
      });
    }

    if (pledgeStatusFilter !== 'all') {
      result = result.filter((s) => {
        if (pledgeStatusFilter === 'active') return s.pledgeCount > 0 && s.pledgeRemaining > 0;
        if (pledgeStatusFilter === 'fulfilled') return s.pledgeCount > 0 && s.pledgeRemaining === 0;
        if (pledgeStatusFilter === 'none') return s.pledgeCount === 0;
        return true;
      });
    }

    if (dateFrom) {
      result = result.filter((s) => s.lastDonationDate >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((s) => s.lastDonationDate <= dateTo);
    }

    if (minAmount) {
      const min = parseFloat(minAmount);
      if (!isNaN(min)) {
        result = result.filter((s) => s.totalDonations >= min);
      }
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'donorName': cmp = a.donorName.localeCompare(b.donorName); break;
        case 'totalDonations': cmp = a.totalDonations - b.totalDonations; break;
        case 'totalEligible': cmp = a.totalEligible - b.totalEligible; break;
        case 'donationCount': cmp = a.donationCount - b.donationCount; break;
        case 'receiptsIssued': cmp = a.receiptsIssued - b.receiptsIssued; break;
        case 'lastDonationDate': cmp = a.lastDonationDate.localeCompare(b.lastDonationDate); break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [donorSummaries, searchQuery, donorFilter, receiptStatusFilter, pledgeStatusFilter, dateFrom, dateTo, minAmount, sortColumn, sortDirection]);

  const totals = useMemo(() => ({
    donors: donorSummaries.length,
    totalDonated: donorSummaries.reduce((s, d) => s + d.totalDonations, 0),
    totalReceipts: donorSummaries.reduce((s, d) => s + d.receiptsIssued, 0),
    totalPending: donorSummaries.reduce((s, d) => s + d.receiptsPending, 0),
    totalPledgeRemaining: donorSummaries.reduce((s, d) => s + d.pledgeRemaining, 0),
  }), [donorSummaries]);

  // Build report data for export
  const donorReportData: ReportData = useMemo(() => ({
    title: 'Donor Summary Report',
    subtitle: `${donorSummaries.length} donor(s)`,
    organizationName: organization?.name || '',
    headers: ['Donor', 'Email', 'Total Donated', 'Eligible (CRA)', 'Donations', 'Receipts Issued', 'Receipts Pending', 'Pledge Total', 'Pledge Fulfilled', 'Pledge Remaining', 'Last Donation'],
    rows: donorSummaries.map(s => [
      s.donorName,
      s.donorEmail || '',
      formatCurrency(s.totalDonations),
      formatCurrency(s.totalEligible),
      String(s.donationCount),
      String(s.receiptsIssued),
      String(s.receiptsPending),
      formatCurrency(s.pledgeTotal),
      formatCurrency(s.pledgeFulfilled),
      formatCurrency(s.pledgeRemaining),
      s.lastDonationDate ? new Date(s.lastDonationDate).toLocaleDateString() : '—',
    ]),
    totals: [
      { label: 'Total Donated', value: formatCurrency(totals.totalDonated) },
      { label: 'Outstanding Pledges', value: formatCurrency(totals.totalPledgeRemaining) },
    ],
  }), [donorSummaries, totals, formatCurrency, organization?.name]);

  return (
    <div className="space-y-4">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <div />
        <ReportActions reportData={donorReportData} variant="compact" />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Users className="w-3.5 h-3.5" /> Total Donors
          </div>
          <p className="text-xl font-bold">{totals.donors}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Heart className="w-3.5 h-3.5" /> Total Donated
          </div>
          <p className="text-xl font-bold">{formatCurrency(totals.totalDonated)}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Receipt className="w-3.5 h-3.5" /> Receipts Issued
          </div>
          <p className="text-xl font-bold text-success">{totals.totalReceipts}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Receipt className="w-3.5 h-3.5" /> Receipts Pending
          </div>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{totals.totalPending}</p>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <HandCoins className="w-3.5 h-3.5" /> Outstanding Pledges
          </div>
          <p className="text-xl font-bold">{formatCurrency(totals.totalPledgeRemaining)}</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={clearAllFilters}>
              <X className="w-3 h-3 mr-1" /> Clear All
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Donor dropdown */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Donor</label>
            <SearchableCustomerSelect
              value={donorFilter}
              onValueChange={(id) => setDonorFilter(id)}
              placeholder="All donors"
              className="h-9 text-sm"
            />
          </div>

          {/* Receipt Status */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Receipt Status</label>
            <Select value={receiptStatusFilter} onValueChange={setReceiptStatusFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="issued">Has Issued</SelectItem>
                <SelectItem value="pending">Has Pending</SelectItem>
                <SelectItem value="none">No Receipts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pledge Status */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Pledge Status</label>
            <Select value={pledgeStatusFilter} onValueChange={setPledgeStatusFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active Pledges</SelectItem>
                <SelectItem value="fulfilled">Fully Fulfilled</SelectItem>
                <SelectItem value="none">No Pledges</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Min Amount */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Min Total Donated</label>
            <Input
              type="number"
              placeholder="0.00"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Date From */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Last Donation From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Last Donation To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Text Search */}
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Result count */}
        {hasActiveFilters && (
          <p className="text-xs text-muted-foreground mt-2">
            Showing {filtered.length} of {donorSummaries.length} donors
          </p>
        )}
      </Card>

      {/* Donor Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('donorName')}>
                <span className="inline-flex items-center gap-1">Donor {sortColumn === 'donorName' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}</span>
              </TableHead>
              <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('totalDonations')}>
                <span className="inline-flex items-center gap-1 justify-end">Total Donated {sortColumn === 'totalDonations' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}</span>
              </TableHead>
              <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('totalEligible')}>
                <span className="inline-flex items-center gap-1 justify-end">Eligible (CRA) {sortColumn === 'totalEligible' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}</span>
              </TableHead>
              <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort('donationCount')}>
                <span className="inline-flex items-center gap-1">Donations {sortColumn === 'donationCount' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}</span>
              </TableHead>
              <TableHead className="text-center cursor-pointer select-none" onClick={() => handleSort('receiptsIssued')}>
                <span className="inline-flex items-center gap-1">Receipts {sortColumn === 'receiptsIssued' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}</span>
              </TableHead>
              <TableHead>Pledges</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('lastDonationDate')}>
                <span className="inline-flex items-center gap-1">Last Donation {sortColumn === 'lastDonationDate' ? (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 text-muted-foreground/50" />}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
                {filtered.map((donor) => {
                  const isExpanded = expandedDonor === donor.donorId;
                  return (
                    <DonorRow
                      key={donor.donorId}
                      donor={donor}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedDonor(isExpanded ? null : donor.donorId)}
                      formatCurrency={formatCurrency}
                      receipts={allReceipts}
                      onShareReceipt={setShareReceipt}
                      logoUrl={organization?.receipt_show_logo === false ? undefined : (organization?.receipt_logo_url || organization?.logo_url)}
                    />
                  );
                })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {hasActiveFilters ? 'No donors match your filters' : 'No donor data yet. Donations will appear here once recorded.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {shareReceipt && (
        <ShareReceiptDialog
          open={!!shareReceipt}
          onOpenChange={(open) => { if (!open) setShareReceipt(null); }}
          receipt={shareReceipt}
        />
      )}
    </div>
  );
}

function DonorRow({
  donor,
  isExpanded,
  onToggle,
  formatCurrency,
  receipts,
  onShareReceipt,
  logoUrl,
}: {
  donor: DonorSummary;
  isExpanded: boolean;
  onToggle: () => void;
  formatCurrency: (v: number) => string;
  receipts: DonationReceipt[];
  onShareReceipt: (r: DonationReceipt) => void;
  logoUrl?: string | null;
}) {
  const pledgeProgress = donor.pledgeTotal > 0 ? (donor.pledgeFulfilled / donor.pledgeTotal) * 100 : 0;

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="w-8">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{donor.donorName}</p>
            {donor.donorEmail && <p className="text-xs text-muted-foreground">{donor.donorEmail}</p>}
          </div>
        </TableCell>
        <TableCell className="text-right font-mono font-medium">{formatCurrency(donor.totalDonations)}</TableCell>
        <TableCell className="text-right font-mono text-success">{formatCurrency(donor.totalEligible)}</TableCell>
        <TableCell className="text-center">{donor.donationCount}</TableCell>
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Badge variant="default" className="text-xs">{donor.receiptsIssued}</Badge>
            {donor.receiptsPending > 0 && (
              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                {donor.receiptsPending} pending
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          {donor.pledgeCount > 0 ? (
            <div className="space-y-1 min-w-[120px]">
              <div className="flex justify-between text-xs">
                <span>{formatCurrency(donor.pledgeFulfilled)}</span>
                <span className="text-muted-foreground">/ {formatCurrency(donor.pledgeTotal)}</span>
              </div>
              <Progress value={pledgeProgress} className="h-1.5" />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-sm">
          {donor.lastDonationDate ? new Date(donor.lastDonationDate).toLocaleDateString() : '—'}
        </TableCell>
      </TableRow>

      {/* Expanded detail rows */}
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 p-0">
            <div className="p-4 space-y-4">
              {/* Donation History */}
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Heart className="w-3.5 h-3.5" /> Donation History
                </h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Number</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs text-right">Eligible</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {donor.donations.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-xs font-mono">{d.donation_number}</TableCell>
                          <TableCell className="text-xs">{new Date(d.date_received).toLocaleDateString()}</TableCell>
                          <TableCell className="text-xs capitalize">{d.donation_type.replace('_', ' ')}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{formatCurrency(d.amount)}</TableCell>
                          <TableCell className="text-xs text-right font-mono text-success">{formatCurrency(d.eligible_amount)}</TableCell>
                          <TableCell>
                            <Badge variant={d.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                              {d.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {d.receipt_issued ? (
                              <Badge variant="outline" className="text-xs text-success border-success/30">Issued</Badge>
                            ) : d.status === 'confirmed' ? (
                              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">Pending</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pledge Status */}
              {donor.pledges.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <HandCoins className="w-3.5 h-3.5" /> Pledge Status
                  </h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Pledge #</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                          <TableHead className="text-xs text-right">Fulfilled</TableHead>
                          <TableHead className="text-xs text-right">Remaining</TableHead>
                          <TableHead className="text-xs">Progress</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {donor.pledges.map((p) => {
                          const pct = p.total_amount > 0 ? (p.fulfilled_amount / p.total_amount) * 100 : 0;
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="text-xs font-mono">{p.pledge_number}</TableCell>
                              <TableCell className="text-xs">{new Date(p.pledge_date).toLocaleDateString()}</TableCell>
                              <TableCell className="text-xs text-right font-mono">{formatCurrency(p.total_amount)}</TableCell>
                              <TableCell className="text-xs text-right font-mono">{formatCurrency(p.fulfilled_amount)}</TableCell>
                              <TableCell className="text-xs text-right font-mono">{formatCurrency(p.remaining_amount)}</TableCell>
                              <TableCell className="min-w-[80px]">
                                <Progress value={pct} className="h-1.5" />
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-xs capitalize ${
                                    p.status === 'fulfilled' ? 'text-success border-success/30' :
                                    p.status === 'cancelled' ? 'text-destructive border-destructive/30' : ''
                                  }`}
                                >
                                  {p.status.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* CRA Summary Line + Receipt Actions */}
              <div className="flex items-center justify-between gap-4 text-xs border-t pt-3">
                <div className="flex items-center gap-4">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">CRA Summary:</span>
                  <span><strong>{donor.donationCount}</strong> donation(s)</span>
                  <span>Total eligible: <strong className="text-success">{formatCurrency(donor.totalEligible)}</strong></span>
                  <span>Receipts issued: <strong>{donor.receiptsIssued}</strong></span>
                  {donor.receiptsPending > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {donor.receiptsPending} receipt(s) pending issuance
                    </span>
                  )}
                </div>
                {(() => {
                  // Find receipts linked to this donor's donations
                  const donorDonationIds = new Set(donor.donations.map(d => d.id));
                  const donorReceiptIds = new Set(donor.donations.filter(d => d.receipt_id).map(d => d.receipt_id));
                  const donorReceipts = receipts.filter(r =>
                    (donorReceiptIds.has(r.id) || (r.donation_id && donorDonationIds.has(r.donation_id))) && r.status === 'issued'
                  );
                  const consolidated = donorReceipts.find(r => r.is_consolidated);
                  const bestReceipt = consolidated || donorReceipts[0];
                  if (!bestReceipt) return null;
                  return (
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); downloadDonationReceiptWithLogo(bestReceipt, logoUrl); }}>
                        <Download className="w-3 h-3 mr-1" />Download
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); printDonationReceiptWithLogo(bestReceipt, logoUrl); }}>
                        <Printer className="w-3 h-3 mr-1" />Print
                      </Button>
                      <Button size="sm" variant="default" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onShareReceipt(bestReceipt); }}>
                        <Share2 className="w-3 h-3 mr-1" />Share
                      </Button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
