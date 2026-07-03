import { useState, useMemo } from 'react';
import { Calendar, Download, Check, Clock, AlertTriangle, Plus, MoreHorizontal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRemittances, type Remittance } from '@/hooks/useRemittances';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getPayrollLocalization } from '@/data/payrollLocalization';
import { COUNTRY_LOCALIZATIONS } from '@/data/countryLocalizations';
import { downloadRemittancePD7APdf, downloadRemittanceCsv, type RemittancePD7AData } from '@/lib/generateRemittancePD7APdf';
import { toast } from 'sonner';

export default function Remittances() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedRemittance, setSelectedRemittance] = useState<string | null>(null);
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRemittance, setDetailsRemittance] = useState<Remittance | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { organization } = useCurrentOrganization();

  // Determine country from organization
  const countryCode = useMemo(() => {
    if (organization?.country) {
      const upperCountry = organization.country.toUpperCase();
      if (COUNTRY_LOCALIZATIONS[upperCountry]) return upperCountry;
      const countryEntry = Object.entries(COUNTRY_LOCALIZATIONS).find(
        ([_, loc]) => loc.name.toLowerCase() === organization.country?.toLowerCase()
      );
      if (countryEntry) return countryEntry[0];
    }
    return 'CA';
  }, [organization?.country]);

  const payrollConfig = useMemo(() => getPayrollLocalization(countryCode), [countryCode]);
  const { remittances: remitConfig } = payrollConfig;

  const {
    remittances,
    isLoading,
    pendingRemittances,
    overdueRemittances,
    totalPending,
    ytdPaid,
    generateRemittanceFromPayRuns,
    markRemittancePaid,
    buildRemittanceReport,
  } = useRemittances(parseInt(year));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(payrollConfig.currencyLocale, {
      style: 'currency',
      currency: payrollConfig.currencyCode,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(payrollConfig.currencyLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPeriod = (period: string) => {
    const [y, m] = period.split('-');
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString(payrollConfig.currencyLocale, {
      year: 'numeric',
      month: 'long',
    });
  };

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = status === 'pending' && new Date(dueDate) < new Date();
    
    if (isOverdue) {
      return <Badge className="bg-destructive/10 text-destructive gap-1"><AlertTriangle className="w-3 h-3" /> Overdue</Badge>;
    }
    if (status === 'paid') {
      return <Badge className="bg-success/10 text-success gap-1"><Check className="w-3 h-3" /> Paid</Badge>;
    }
    return <Badge className="bg-warning/10 text-warning gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
  };

  const handleGenerateRemittance = async () => {
    if (!selectedMonth) {
      toast.error('Please select a month');
      return;
    }
    try {
      await generateRemittanceFromPayRuns.mutateAsync(selectedMonth);
      setGenerateDialogOpen(false);
      setSelectedMonth('');
    } catch (error: any) {
      // Error handled by hook
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedRemittance) return;
    try {
      await markRemittancePaid.mutateAsync({
        id: selectedRemittance,
        confirmationNumber: confirmationNumber || undefined,
      });
      setPayDialogOpen(false);
      setSelectedRemittance(null);
      setConfirmationNumber('');
    } catch (error: any) {
      // Error handled by hook
    }
  };

  const buildPdfData = async (remittance: Remittance): Promise<RemittancePD7AData> => {
    const period = remittance.remittance_period.substring(0, 7);
    const detail = await buildRemittanceReport(period);
    const employerAddressParts = [
      organization?.address_line1,
      [organization?.city, organization?.province, (organization as any)?.postal_code]
        .filter(Boolean)
        .join(' '),
    ].filter(Boolean) as string[];

    return {
      formCode: (remitConfig as any).formCode || 'PD7A',
      authorityName: remitConfig.authority,
      employerName: organization?.name || 'Employer',
      employerAddress: employerAddressParts.join(', ') || undefined,
      payrollAccountNumber:
        (organization as any)?.payroll_account_number || (organization as any)?.business_number,
      businessNumber: (organization as any)?.business_number,
      periodLabel: formatPeriod(period),
      periodStart: detail.startDate,
      periodEnd: detail.endDate,
      dueDate: remittance.due_date,
      numberOfEmployees: detail.numberOfEmployees,
      grossPayroll: detail.grossPayroll,
      // Always trust the live re-aggregation from pay_stubs so the summary
      // and the employee detail table always reconcile. Stored remittance
      // totals can become stale when additional pay runs are posted after
      // the remittance row was first created.
      federalTax: detail.federalTax,
      provincialTax: detail.provincialTax,
      cppEmployee: detail.cppEmployee,
      cppEmployer: detail.cppEmployer,
      eiEmployee: detail.eiEmployee,
      eiEmployer: detail.eiEmployer,
      employees: detail.employees,
      currencyCode: payrollConfig.currencyCode,
      currencyLocale: payrollConfig.currencyLocale,
    };
  };

  const handleDownloadPdf = async (remittance: Remittance) => {
    try {
      setDownloadingId(remittance.id);
      const data = await buildPdfData(remittance);
      downloadRemittancePD7APdf(data);
      toast.success('Remittance PDF downloaded');
    } catch (e: any) {
      toast.error('Failed to generate report: ' + (e?.message || 'Unknown error'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadCsv = async (remittance: Remittance) => {
    try {
      setDownloadingId(remittance.id);
      const data = await buildPdfData(remittance);
      downloadRemittanceCsv(data);
      toast.success('Remittance CSV downloaded');
    } catch (e: any) {
      toast.error('Failed to generate CSV: ' + (e?.message || 'Unknown error'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewDetails = (remittance: Remittance) => {
    setDetailsRemittance(remittance);
    setDetailsOpen(true);
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
  
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const month = (i + 1).toString().padStart(2, '0');
    return { value: `${year}-${month}`, label: formatPeriod(`${year}-${month}`) };
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{remitConfig.title}</h1>
          <p className="text-muted-foreground">{remitConfig.description}</p>
        </div>
        <Button 
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={() => setGenerateDialogOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate Remittance
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Pending Amount</p>
          <p className="text-2xl font-bold text-warning">{formatCurrency(totalPending)}</p>
          <p className="text-xs text-muted-foreground mt-1">{pendingRemittances.length} pending</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Overdue</p>
          <p className="text-2xl font-bold text-destructive">{overdueRemittances.length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {overdueRemittances.length > 0 ? 'Requires immediate attention' : 'All current'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">YTD Remitted</p>
          <p className="text-2xl font-bold text-success">{formatCurrency(ytdPaid)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Remittances</p>
          <p className="text-2xl font-bold text-foreground">{remittances.length}</p>
        </Card>
      </div>

      {/* Overdue Alert */}
      {overdueRemittances.length > 0 && (
        <Card className="p-4 border-l-4 border-l-destructive bg-destructive/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <div>
              <p className="font-semibold text-foreground">Overdue Remittances</p>
              <p className="text-sm text-muted-foreground">
                You have {overdueRemittances.length} overdue remittance(s) totaling{' '}
                {formatCurrency(overdueRemittances.reduce((s, r) => s + r.total_amount, 0))}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Year:</span>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Remittances Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : remittances.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Calendar className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground">No remittances found for {year}</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setGenerateDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Generate First Remittance
            </Button>
          </div>
        ) : (
          <table className="data-table">
            <thead className="bg-muted/50">
              <tr>
                <th>Period</th>
                <th>Due Date</th>
                <th className="text-right">{remitConfig.columns.pension}</th>
                <th className="text-right">{remitConfig.columns.socialInsurance}</th>
                <th className="text-right">{remitConfig.columns.tax}</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {remittances.map((remittance) => (
                <tr key={remittance.id} className="hover:bg-muted/20">
                  <td className="font-medium">{formatPeriod(remittance.remittance_period)}</td>
                  <td className="text-muted-foreground">{formatDate(remittance.due_date)}</td>
                  <td className="text-right font-mono">
                    {formatCurrency((remittance.total_cpp_employee || 0) + (remittance.total_cpp_employer || 0))}
                  </td>
                  <td className="text-right font-mono">
                    {formatCurrency((remittance.total_ei_employee || 0) + (remittance.total_ei_employer || 0))}
                  </td>
                  <td className="text-right font-mono">
                    {formatCurrency((remittance.total_federal_tax || 0) + (remittance.total_provincial_tax || 0))}
                  </td>
                  <td className="text-right font-mono font-semibold">{formatCurrency(remittance.total_amount)}</td>
                  <td>{getStatusBadge(remittance.status, remittance.due_date)}</td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(remittance)}>
                          View Details
                        </DropdownMenuItem>
                        {remittance.status === 'pending' && (
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRemittance(remittance.id);
                              setPayDialogOpen(true);
                            }}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Mark as Paid
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDownloadPdf(remittance)}
                          disabled={downloadingId === remittance.id}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download {remitConfig.formCode} PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDownloadCsv(remittance)}
                          disabled={downloadingId === remittance.id}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download CSV
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Generate Remittance Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Remittance</DialogTitle>
            <DialogDescription>
              {remitConfig.generateDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleGenerateRemittance}
              disabled={generateRemittanceFromPayRuns.isPending}
            >
              {generateRemittanceFromPayRuns.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Remittance as Paid</DialogTitle>
            <DialogDescription>
              Record the payment confirmation from {remitConfig.authority}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirmation Number (Optional)</label>
              <Input
                value={confirmationNumber}
                onChange={(e) => setConfirmationNumber(e.target.value)}
                placeholder={`${remitConfig.authority} confirmation number`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleMarkPaid}
              disabled={markRemittancePaid.isPending}
            >
              {markRemittancePaid.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailsRemittance ? formatPeriod(detailsRemittance.remittance_period) : ''} — {remitConfig.formCode}
            </DialogTitle>
            <DialogDescription>
              Source deductions breakdown to be remitted to {remitConfig.authority}.
            </DialogDescription>
          </DialogHeader>
          {detailsRemittance && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Due Date</span><span className="font-medium">{formatDate(detailsRemittance.due_date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span>{getStatusBadge(detailsRemittance.status, detailsRemittance.due_date)}</div>
              <div className="border-t pt-2" />
              <div className="flex justify-between"><span>{remitConfig.columns.tax} (Federal)</span><span className="font-mono">{formatCurrency(detailsRemittance.total_federal_tax || 0)}</span></div>
              <div className="flex justify-between"><span>{remitConfig.columns.tax} (Provincial)</span><span className="font-mono">{formatCurrency(detailsRemittance.total_provincial_tax || 0)}</span></div>
              <div className="flex justify-between"><span>{remitConfig.columns.pension} — Employee</span><span className="font-mono">{formatCurrency(detailsRemittance.total_cpp_employee || 0)}</span></div>
              <div className="flex justify-between"><span>{remitConfig.columns.pension} — Employer</span><span className="font-mono">{formatCurrency(detailsRemittance.total_cpp_employer || 0)}</span></div>
              <div className="flex justify-between"><span>{remitConfig.columns.socialInsurance} — Employee</span><span className="font-mono">{formatCurrency(detailsRemittance.total_ei_employee || 0)}</span></div>
              <div className="flex justify-between"><span>{remitConfig.columns.socialInsurance} — Employer</span><span className="font-mono">{formatCurrency(detailsRemittance.total_ei_employer || 0)}</span></div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total Remittance Due</span>
                <span className="font-mono">{formatCurrency(detailsRemittance.total_amount)}</span>
              </div>
              {detailsRemittance.confirmation_number && (
                <div className="flex justify-between"><span className="text-muted-foreground">Confirmation #</span><span className="font-mono">{detailsRemittance.confirmation_number}</span></div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            {detailsRemittance && (
              <>
                <Button variant="outline" onClick={() => handleDownloadCsv(detailsRemittance)}>
                  <Download className="w-4 h-4 mr-2" />CSV
                </Button>
                <Button onClick={() => handleDownloadPdf(detailsRemittance)}>
                  <Download className="w-4 h-4 mr-2" />Download {remitConfig.formCode}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
