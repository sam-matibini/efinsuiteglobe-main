import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FileText, Download, Printer, FileSpreadsheet, Filter, 
  Calendar, Building2, TrendingDown, Calculator, DollarSign 
} from 'lucide-react';
import { format, startOfYear, endOfYear, parseISO, differenceInMonths, subYears } from 'date-fns';
import { FixedAsset, generateDepreciationSchedule } from '@/hooks/useFixedAssets';
import { useAssetDisposals } from '@/hooks/useFixedAssetsRegister';
import { exportToFormattedExcel } from '@/lib/excelExport';
import jsPDF from 'jspdf';

interface FixedAssetsReportsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: FixedAsset[];
  organizationId?: string;
  organizationName?: string;
  formatCurrency: (value: number) => string;
  countryCode: string;
}

type ReportType = 'register' | 'depreciation' | 'additions' | 'disposals' | 'aging' | 'cca';
type PeriodType = 'current-year' | 'previous-year' | 'custom';

export function FixedAssetsReports({
  open,
  onOpenChange,
  assets,
  organizationId,
  organizationName,
  formatCurrency,
  countryCode,
}: FixedAssetsReportsProps) {
  const [reportType, setReportType] = useState<ReportType>('register');
  const [periodType, setPeriodType] = useState<PeriodType>('current-year');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: disposals = [] } = useAssetDisposals(organizationId);

  // Date range calculation
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (periodType) {
      case 'current-year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'previous-year':
        return { start: startOfYear(subYears(now, 1)), end: endOfYear(subYears(now, 1)) };
      case 'custom':
        return {
          start: customStart ? parseISO(customStart) : startOfYear(now),
          end: customEnd ? parseISO(customEnd) : endOfYear(now),
        };
      default:
        return { start: startOfYear(now), end: endOfYear(now) };
    }
  }, [periodType, customStart, customEnd]);

  const dateRangeLabel = `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`;

  // Filtered assets
  const filteredAssets = useMemo(() => {
    return assets.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && a.category_id !== categoryFilter) return false;
      return true;
    });
  }, [assets, statusFilter, categoryFilter]);

  // Additions in period
  const additionsInPeriod = useMemo(() => {
    return assets.filter(a => {
      const acqDate = parseISO(a.acquisition_date);
      return acqDate >= dateRange.start && acqDate <= dateRange.end;
    });
  }, [assets, dateRange]);

  // Disposals in period
  const disposalsInPeriod = useMemo(() => {
    return disposals.filter(d => {
      const dispDate = parseISO(d.disposal_date);
      return dispDate >= dateRange.start && dispDate <= dateRange.end;
    });
  }, [disposals, dateRange]);

  // Asset aging calculation
  const assetAging = useMemo(() => {
    const now = new Date();
    const aging = {
      '0-1 years': { count: 0, cost: 0, nbv: 0 },
      '1-3 years': { count: 0, cost: 0, nbv: 0 },
      '3-5 years': { count: 0, cost: 0, nbv: 0 },
      '5-10 years': { count: 0, cost: 0, nbv: 0 },
      '10+ years': { count: 0, cost: 0, nbv: 0 },
    };

    filteredAssets.filter(a => a.status === 'active').forEach(a => {
      const months = differenceInMonths(now, parseISO(a.acquisition_date));
      const years = months / 12;
      
      let bucket: keyof typeof aging;
      if (years < 1) bucket = '0-1 years';
      else if (years < 3) bucket = '1-3 years';
      else if (years < 5) bucket = '3-5 years';
      else if (years < 10) bucket = '5-10 years';
      else bucket = '10+ years';

      aging[bucket].count += 1;
      aging[bucket].cost += a.acquisition_cost;
      aging[bucket].nbv += a.book_value;
    });

    return aging;
  }, [filteredAssets]);

  // CCA Classes summary (for Canada)
  const ccaSummary = useMemo(() => {
    const summary: Record<string, { count: number; ucc: number; cca: number }> = {};
    
    filteredAssets.filter(a => a.status === 'active').forEach(a => {
      const ccaClass = (a as any).cca_class || 'Unclassified';
      if (!summary[ccaClass]) {
        summary[ccaClass] = { count: 0, ucc: 0, cca: 0 };
      }
      summary[ccaClass].count += 1;
      summary[ccaClass].ucc += (a as any).tax_book_value || a.book_value;
      // Estimate CCA - would be actual from tax depreciation calc
      const ccaRate = (a as any).cca_rate || 20;
      summary[ccaClass].cca += ((a as any).tax_book_value || a.book_value) * (ccaRate / 100);
    });

    return summary;
  }, [filteredAssets]);

  // Generate PDF
  const generatePDF = () => {
    const doc = new jsPDF('landscape');
    const title = getReportTitle();
    
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    
    doc.setFontSize(10);
    doc.text(organizationName || 'Organization', 14, 28);
    doc.text(`Period: ${dateRangeLabel}`, 14, 34);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 40);

    let yPos = 50;

    if (reportType === 'register') {
      // FAR Register
      const headers = ['Asset #', 'Name', 'Acquired', 'Cost', 'Accum Dep', 'NBV', 'Status'];
      const colWidths = [30, 50, 25, 30, 30, 30, 20];
      
      headers.forEach((h, i) => {
        doc.text(h, 14 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), yPos);
      });
      
      yPos += 6;
      doc.line(14, yPos, 280, yPos);
      yPos += 4;

      filteredAssets.forEach(a => {
        if (yPos > 180) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(a.asset_number, 14, yPos);
        doc.text(a.name.substring(0, 25), 44, yPos);
        doc.text(format(parseISO(a.acquisition_date), 'MM/dd/yy'), 94, yPos);
        doc.text(formatCurrency(a.acquisition_cost), 119, yPos);
        doc.text(formatCurrency(a.accumulated_depreciation), 149, yPos);
        doc.text(formatCurrency(a.book_value), 179, yPos);
        doc.text(a.status, 209, yPos);
        yPos += 6;
      });

      // Totals
      yPos += 4;
      doc.line(14, yPos, 280, yPos);
      yPos += 6;
      const totals = filteredAssets.reduce((acc, a) => ({
        cost: acc.cost + a.acquisition_cost,
        dep: acc.dep + a.accumulated_depreciation,
        nbv: acc.nbv + a.book_value,
      }), { cost: 0, dep: 0, nbv: 0 });
      
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL', 14, yPos);
      doc.text(formatCurrency(totals.cost), 119, yPos);
      doc.text(formatCurrency(totals.dep), 149, yPos);
      doc.text(formatCurrency(totals.nbv), 179, yPos);
    }

    doc.save(`${title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // Export to Excel
  const exportExcel = () => {
    const title = getReportTitle();
    
    if (reportType === 'register') {
      exportToFormattedExcel({
        title,
        organizationName,
        dateRange: dateRangeLabel,
        headers: ['Asset #', 'Name', 'Category', 'Acquired', 'Cost', 'Accum Dep', 'Net Book Value', 'Status'],
        rows: filteredAssets.map(a => [
          a.asset_number,
          a.name,
          a.category?.name || '-',
          format(parseISO(a.acquisition_date), 'yyyy-MM-dd'),
          a.acquisition_cost,
          a.accumulated_depreciation,
          a.book_value,
          a.status,
        ]),
        totals: [
          { label: 'Total Cost', value: filteredAssets.reduce((s, a) => s + a.acquisition_cost, 0) },
          { label: 'Total Accumulated Depreciation', value: filteredAssets.reduce((s, a) => s + a.accumulated_depreciation, 0) },
          { label: 'Total Net Book Value', value: filteredAssets.reduce((s, a) => s + a.book_value, 0) },
        ],
      });
    } else if (reportType === 'depreciation') {
      // Generate consolidated depreciation schedule
      const allSchedules: any[] = [];
      filteredAssets.filter(a => a.status === 'active').forEach(a => {
        const schedule = generateDepreciationSchedule(a);
        schedule.forEach((entry, idx) => {
          allSchedules.push([
            a.asset_number,
            a.name,
            entry.period_start,
            entry.depreciation_amount,
            entry.accumulated_depreciation,
            entry.book_value,
          ]);
        });
      });

      exportToFormattedExcel({
        title: 'Depreciation Schedule',
        organizationName,
        dateRange: dateRangeLabel,
        headers: ['Asset #', 'Name', 'Period', 'Depreciation', 'Accumulated', 'Book Value'],
        rows: allSchedules.slice(0, 500), // Limit for performance
      });
    } else if (reportType === 'additions') {
      exportToFormattedExcel({
        title: 'Asset Additions Report',
        organizationName,
        dateRange: dateRangeLabel,
        headers: ['Asset #', 'Name', 'Acquired', 'Cost', 'Method', 'Useful Life'],
        rows: additionsInPeriod.map(a => [
          a.asset_number,
          a.name,
          format(parseISO(a.acquisition_date), 'yyyy-MM-dd'),
          a.acquisition_cost,
          a.acquisition_method || 'purchase',
          `${a.useful_life_months} months`,
        ]),
        totals: [
          { label: 'Total Additions', value: additionsInPeriod.length },
          { label: 'Total Cost', value: additionsInPeriod.reduce((s, a) => s + a.acquisition_cost, 0) },
        ],
      });
    } else if (reportType === 'disposals') {
      exportToFormattedExcel({
        title: 'Asset Disposals Report',
        organizationName,
        dateRange: dateRangeLabel,
        headers: ['Asset #', 'Name', 'Disposed', 'Type', 'Proceeds', 'Book Value', 'Gain/Loss'],
        rows: disposalsInPeriod.map(d => [
          d.fixed_assets?.asset_number || '-',
          d.fixed_assets?.name || '-',
          format(parseISO(d.disposal_date), 'yyyy-MM-dd'),
          d.disposal_type,
          d.proceeds || 0,
          d.book_value_at_disposal,
          d.gain_loss,
        ]),
        totals: [
          { label: 'Total Disposals', value: disposalsInPeriod.length },
          { label: 'Total Proceeds', value: disposalsInPeriod.reduce((s, d) => s + (d.proceeds || 0), 0) },
          { label: 'Net Gain/Loss', value: disposalsInPeriod.reduce((s, d) => s + d.gain_loss, 0) },
        ],
      });
    } else if (reportType === 'aging') {
      exportToFormattedExcel({
        title: 'Asset Aging Report',
        organizationName,
        dateRange: dateRangeLabel,
        headers: ['Age Bucket', 'Asset Count', 'Total Cost', 'Net Book Value'],
        rows: Object.entries(assetAging).map(([bucket, data]) => [
          bucket,
          data.count,
          data.cost,
          data.nbv,
        ]),
        totals: [
          { label: 'Total Assets', value: Object.values(assetAging).reduce((s, d) => s + d.count, 0) },
          { label: 'Total Cost', value: Object.values(assetAging).reduce((s, d) => s + d.cost, 0) },
          { label: 'Total NBV', value: Object.values(assetAging).reduce((s, d) => s + d.nbv, 0) },
        ],
      });
    } else if (reportType === 'cca') {
      exportToFormattedExcel({
        title: 'CCA Tax Depreciation Report',
        organizationName,
        dateRange: dateRangeLabel,
        headers: ['CCA Class', 'Asset Count', 'UCC (Undepreciated Capital Cost)', 'Estimated CCA'],
        rows: Object.entries(ccaSummary).map(([cls, data]) => [
          cls,
          data.count,
          data.ucc,
          data.cca,
        ]),
        totals: [
          { label: 'Total Assets', value: Object.values(ccaSummary).reduce((s, d) => s + d.count, 0) },
          { label: 'Total UCC', value: Object.values(ccaSummary).reduce((s, d) => s + d.ucc, 0) },
          { label: 'Total CCA', value: Object.values(ccaSummary).reduce((s, d) => s + d.cca, 0) },
        ],
      });
    }
  };

  const getReportTitle = () => {
    switch (reportType) {
      case 'register': return 'Fixed Assets Register';
      case 'depreciation': return 'Depreciation Schedule';
      case 'additions': return 'Asset Additions Report';
      case 'disposals': return 'Asset Disposals Report';
      case 'aging': return 'Asset Aging Report';
      case 'cca': return 'CCA Tax Depreciation Report';
      default: return 'Fixed Assets Report';
    }
  };

  const categories = useMemo(() => {
    const cats = new Set<string>();
    assets.forEach(a => {
      if (a.category_id) cats.add(a.category_id);
    });
    return Array.from(cats);
  }, [assets]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Fixed Assets Reports
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Report Type Tabs */}
          <Tabs value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="register" className="text-xs">
                <Building2 className="h-3 w-3 mr-1" />Register
              </TabsTrigger>
              <TabsTrigger value="depreciation" className="text-xs">
                <TrendingDown className="h-3 w-3 mr-1" />Depreciation
              </TabsTrigger>
              <TabsTrigger value="additions" className="text-xs">
                <DollarSign className="h-3 w-3 mr-1" />Additions
              </TabsTrigger>
              <TabsTrigger value="disposals" className="text-xs">
                <DollarSign className="h-3 w-3 mr-1" />Disposals
              </TabsTrigger>
              <TabsTrigger value="aging" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />Aging
              </TabsTrigger>
              <TabsTrigger value="cca" className="text-xs">
                <Calculator className="h-3 w-3 mr-1" />CCA Tax
              </TabsTrigger>
            </TabsList>

            {/* Filters */}
            <Card className="mt-4">
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Period</Label>
                    <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current-year">Current Year</SelectItem>
                        <SelectItem value="previous-year">Previous Year</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {periodType === 'custom' && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">From</Label>
                        <Input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="w-36"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">To</Label>
                        <Input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="w-36"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="disposed">Disposed</SelectItem>
                        <SelectItem value="fully_depreciated">Fully Depreciated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1" />

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={generatePDF}>
                      <Printer className="h-4 w-4 mr-1" />PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Content */}
            <TabsContent value="register" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Fixed Assets Register</CardTitle>
                  <CardDescription>{dateRangeLabel} • {filteredAssets.length} assets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Asset #</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Acquired</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Accum. Dep</TableHead>
                          <TableHead className="text-right">NBV</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAssets.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-mono text-xs">{a.asset_number}</TableCell>
                            <TableCell>{a.name}</TableCell>
                            <TableCell>{format(parseISO(a.acquisition_date), 'MMM d, yyyy')}</TableCell>
                            <TableCell className="text-right">{formatCurrency(a.acquisition_cost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(a.accumulated_depreciation)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(a.book_value)}</TableCell>
                            <TableCell>
                              <Badge variant={a.status === 'active' ? 'default' : 'secondary'}>{a.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredAssets.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No assets match the selected filters
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {filteredAssets.length > 0 && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Cost</p>
                        <p className="text-xl font-bold">{formatCurrency(filteredAssets.reduce((s, a) => s + a.acquisition_cost, 0))}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Accumulated Depreciation</p>
                        <p className="text-xl font-bold">{formatCurrency(filteredAssets.reduce((s, a) => s + a.accumulated_depreciation, 0))}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Net Book Value</p>
                        <p className="text-xl font-bold">{formatCurrency(filteredAssets.reduce((s, a) => s + a.book_value, 0))}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="depreciation" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Depreciation Schedule</CardTitle>
                  <CardDescription>Monthly depreciation for all active assets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Asset</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead className="text-right">Monthly Dep.</TableHead>
                          <TableHead className="text-right">Annual Dep.</TableHead>
                          <TableHead className="text-right">Remaining Life</TableHead>
                          <TableHead className="text-right">Book Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAssets.filter(a => a.status === 'active').map((a) => {
                          const schedule = generateDepreciationSchedule(a);
                          const monthlyDep = schedule[0]?.depreciation_amount || 0;
                          const remainingMonths = schedule.length;
                          return (
                            <TableRow key={a.id}>
                              <TableCell>
                                <div className="font-medium">{a.name}</div>
                                <div className="text-xs text-muted-foreground">{a.asset_number}</div>
                              </TableCell>
                              <TableCell className="capitalize">{a.depreciation_method.replace('_', ' ')}</TableCell>
                              <TableCell className="text-right">{formatCurrency(monthlyDep)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(monthlyDep * 12)}</TableCell>
                              <TableCell className="text-right">{remainingMonths} months</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(a.book_value)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="additions" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Asset Additions</CardTitle>
                  <CardDescription>{dateRangeLabel} • {additionsInPeriod.length} assets added</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Asset #</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Acquired</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead>Useful Life</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {additionsInPeriod.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-mono text-xs">{a.asset_number}</TableCell>
                            <TableCell>{a.name}</TableCell>
                            <TableCell>{format(parseISO(a.acquisition_date), 'MMM d, yyyy')}</TableCell>
                            <TableCell className="capitalize">{a.acquisition_method || 'purchase'}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(a.acquisition_cost)}</TableCell>
                            <TableCell>{a.useful_life_months} months</TableCell>
                          </TableRow>
                        ))}
                        {additionsInPeriod.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No assets added in this period
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {additionsInPeriod.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">Total Additions</p>
                      <p className="text-xl font-bold">{formatCurrency(additionsInPeriod.reduce((s, a) => s + a.acquisition_cost, 0))}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="disposals" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Asset Disposals</CardTitle>
                  <CardDescription>{dateRangeLabel} • {disposalsInPeriod.length} assets disposed</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Asset</TableHead>
                          <TableHead>Disposed</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Proceeds</TableHead>
                          <TableHead className="text-right">Book Value</TableHead>
                          <TableHead className="text-right">Gain/Loss</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {disposalsInPeriod.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>
                              <div className="font-medium">{d.fixed_assets?.name}</div>
                              <div className="text-xs text-muted-foreground">{d.fixed_assets?.asset_number}</div>
                            </TableCell>
                            <TableCell>{format(parseISO(d.disposal_date), 'MMM d, yyyy')}</TableCell>
                            <TableCell className="capitalize">{d.disposal_type}</TableCell>
                            <TableCell className="text-right">{formatCurrency(d.proceeds || 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(d.book_value_at_disposal)}</TableCell>
                            <TableCell className={`text-right font-medium ${d.gain_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {d.gain_loss >= 0 ? '+' : ''}{formatCurrency(d.gain_loss)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {disposalsInPeriod.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No assets disposed in this period
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {disposalsInPeriod.length > 0 && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Proceeds</p>
                        <p className="text-xl font-bold">{formatCurrency(disposalsInPeriod.reduce((s, d) => s + (d.proceeds || 0), 0))}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Book Value</p>
                        <p className="text-xl font-bold">{formatCurrency(disposalsInPeriod.reduce((s, d) => s + d.book_value_at_disposal, 0))}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Net Gain/Loss</p>
                        <p className={`text-xl font-bold ${disposalsInPeriod.reduce((s, d) => s + d.gain_loss, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(disposalsInPeriod.reduce((s, d) => s + d.gain_loss, 0))}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="aging" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Asset Aging Analysis</CardTitle>
                  <CardDescription>Active assets grouped by age since acquisition</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Age Bucket</TableHead>
                        <TableHead className="text-right">Asset Count</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                        <TableHead className="text-right">Net Book Value</TableHead>
                        <TableHead className="text-right">% of Total NBV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(assetAging).map(([bucket, data]) => {
                        const totalNBV = Object.values(assetAging).reduce((s, d) => s + d.nbv, 0);
                        const pct = totalNBV > 0 ? (data.nbv / totalNBV) * 100 : 0;
                        return (
                          <TableRow key={bucket}>
                            <TableCell className="font-medium">{bucket}</TableCell>
                            <TableCell className="text-right">{data.count}</TableCell>
                            <TableCell className="text-right">{formatCurrency(data.cost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(data.nbv)}</TableCell>
                            <TableCell className="text-right">{pct.toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  
                  <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Assets</p>
                      <p className="text-xl font-bold">{Object.values(assetAging).reduce((s, d) => s + d.count, 0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Cost</p>
                      <p className="text-xl font-bold">{formatCurrency(Object.values(assetAging).reduce((s, d) => s + d.cost, 0))}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Net Book Value</p>
                      <p className="text-xl font-bold">{formatCurrency(Object.values(assetAging).reduce((s, d) => s + d.nbv, 0))}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cca" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">CCA Tax Depreciation Report</CardTitle>
                  <CardDescription>Capital Cost Allowance by class (Canada)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CCA Class</TableHead>
                        <TableHead className="text-right">Asset Count</TableHead>
                        <TableHead className="text-right">UCC (Opening)</TableHead>
                        <TableHead className="text-right">Estimated CCA</TableHead>
                        <TableHead className="text-right">UCC (Closing)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(ccaSummary).map(([cls, data]) => (
                        <TableRow key={cls}>
                          <TableCell className="font-medium">{cls}</TableCell>
                          <TableCell className="text-right">{data.count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(data.ucc)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(data.cca)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(data.ucc - data.cca)}</TableCell>
                        </TableRow>
                      ))}
                      {Object.keys(ccaSummary).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No assets with CCA classification
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  
                  {Object.keys(ccaSummary).length > 0 && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total UCC</p>
                        <p className="text-xl font-bold">{formatCurrency(Object.values(ccaSummary).reduce((s, d) => s + d.ucc, 0))}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total CCA Claim</p>
                        <p className="text-xl font-bold">{formatCurrency(Object.values(ccaSummary).reduce((s, d) => s + d.cca, 0))}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Closing UCC</p>
                        <p className="text-xl font-bold">{formatCurrency(Object.values(ccaSummary).reduce((s, d) => s + d.ucc - d.cca, 0))}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
