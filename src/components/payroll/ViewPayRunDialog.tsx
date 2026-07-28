import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileSpreadsheet, FileText, Loader2, Check, Clock, AlertCircle, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn, parseLocalDate } from '@/lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import type { PayRunStatus } from '@/types/payroll';
import { PaystubViewer } from './PaystubViewer';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization, getLocaleForCountry } from '@/data/countryLocalizations';

interface PayRun {
  id: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  status: PayRunStatus;
  total_gross: number | null;
  total_deductions: number | null;
  total_net: number | null;
  total_employer_contributions: number | null;
  employee_count: number | null;
  notes: string | null;
  created_at: string;
}

interface PayStub {
  id: string;
  employee_id: string;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  regular_hours: number | null;
  regular_earnings: number | null;
  overtime_hours: number | null;
  overtime_earnings: number | null;
  vacation_pay: number | null;
  cpp_contribution: number | null;
  ei_premium: number | null;
  federal_tax: number | null;
  provincial_tax: number | null;
  other_deductions: number | null;
  ytd_gross: number | null;
  ytd_cpp: number | null;
  ytd_ei: number | null;
  ytd_federal_tax: number | null;
  ytd_provincial_tax: number | null;
  employee_mailing_address_line1?: string | null;
  employee_mailing_address_line2?: string | null;
  employee_mailing_city?: string | null;
  employee_mailing_region?: string | null;
  employee_mailing_postal_code?: string | null;
  employee_mailing_country?: string | null;
  employer_mailing_address_line1?: string | null;
  employer_mailing_address_line2?: string | null;
  employer_mailing_city?: string | null;
  employer_mailing_region?: string | null;
  employer_mailing_postal_code?: string | null;
  employer_mailing_country?: string | null;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    employee_number: string | null;
    department: string | null;
    province?: string | null;
    mailing_province?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
}

interface ViewPayRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payRun: PayRun | null;
}

export function ViewPayRunDialog({ open, onOpenChange, payRun }: ViewPayRunDialogProps) {
  const [payStubs, setPayStubs] = useState<PayStub[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPayStub, setSelectedPayStub] = useState<PayStub | null>(null);
  const [activeTab, setActiveTab] = useState('entries');
  const { organization } = useCurrentOrganization();

  useEffect(() => {
    if (open && payRun) {
      fetchPayStubs();
      setActiveTab('entries');
      setSelectedPayStub(null);
    }
  }, [open, payRun?.id]);

  const fetchPayStubs = async () => {
    if (!payRun) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pay_stubs')
        .select(`
          *,
          employee:employees(id, first_name, last_name, employee_number, department, province, mailing_province, address_line1, address_line2, city, postal_code, country)
        `)
        .eq('pay_run_id', payRun.id)
        .order('created_at');

      if (error) throw error;
      setPayStubs(data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load pay stubs');
    } finally {
      setIsLoading(false);
    }
  };

  // Get country-based currency formatting
  const countryCode = (organization as any)?.country || 'CA';
  const localization = useMemo(() => getCountryLocalization(countryCode), [countryCode]);
  const locale = useMemo(() => getLocaleForCountry(countryCode), [countryCode]);

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
      minimumFractionDigits: 2,
    }).format(value || 0);
  };



  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(parseLocalDate(dateStr));
  };

  const statusConfig: Record<PayRunStatus, { label: string; icon: typeof Clock; color: string }> = {
    draft: { label: 'Draft', icon: Clock, color: 'bg-warning/10 text-warning' },
    processing: { label: 'Processing', icon: Loader2, color: 'bg-blue-500/10 text-blue-600' },
    approved: { label: 'Approved', icon: Check, color: 'bg-success/10 text-success' },
    paid: { label: 'Paid', icon: Check, color: 'bg-success/10 text-success' },
    cancelled: { label: 'Cancelled', icon: AlertCircle, color: 'bg-muted text-muted-foreground' },
  };

  const handleExportExcel = () => {
    if (!payRun || payStubs.length === 0) {
      toast.error('No data to export');
      return;
    }

    const data = payStubs.map(stub => ({
      'Employee Name': stub.employee ? `${stub.employee.first_name} ${stub.employee.last_name}` : 'Unknown',
      'Employee #': stub.employee?.employee_number || '',
      'Department': stub.employee?.department || '',
      'Regular Hours': stub.regular_hours || 0,
      'Regular Earnings': stub.regular_earnings || 0,
      'Overtime Hours': stub.overtime_hours || 0,
      'Overtime Earnings': stub.overtime_earnings || 0,
      'Vacation Pay': stub.vacation_pay || 0,
      'Gross Pay': stub.gross_pay,
      'CPP': stub.cpp_contribution || 0,
      'EI': stub.ei_premium || 0,
      'Federal Tax': stub.federal_tax || 0,
      'Provincial Tax': stub.provincial_tax || 0,
      'Total Deductions': stub.total_deductions,
      'Net Pay': stub.net_pay,
    }));

    // Add summary row
    data.push({
      'Employee Name': 'TOTALS',
      'Employee #': '',
      'Department': '',
      'Regular Hours': payStubs.reduce((s, p) => s + (p.regular_hours || 0), 0),
      'Regular Earnings': payStubs.reduce((s, p) => s + (p.regular_earnings || 0), 0),
      'Overtime Hours': payStubs.reduce((s, p) => s + (p.overtime_hours || 0), 0),
      'Overtime Earnings': payStubs.reduce((s, p) => s + (p.overtime_earnings || 0), 0),
      'Vacation Pay': payStubs.reduce((s, p) => s + (p.vacation_pay || 0), 0),
      'Gross Pay': payRun.total_gross || 0,
      'CPP': payStubs.reduce((s, p) => s + (p.cpp_contribution || 0), 0),
      'EI': payStubs.reduce((s, p) => s + (p.ei_premium || 0), 0),
      'Federal Tax': payStubs.reduce((s, p) => s + (p.federal_tax || 0), 0),
      'Provincial Tax': payStubs.reduce((s, p) => s + (p.provincial_tax || 0), 0),
      'Total Deductions': payRun.total_deductions || 0,
      'Net Pay': payRun.total_net || 0,
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pay Run');

    const filename = `PayRun_${payRun.pay_period_start}_to_${payRun.pay_period_end}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success('Exported to Excel');
  };

  const handleExportPDF = () => {
    if (!payRun) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Pay Run Summary', pageWidth / 2, 20, { align: 'center' });
    
    // Period info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${formatDate(payRun.pay_period_start)} - ${formatDate(payRun.pay_period_end)}`, 14, 35);
    doc.text(`Pay Date: ${formatDate(payRun.pay_date)}`, 14, 42);
    doc.text(`Status: ${statusConfig[payRun.status].label}`, 14, 49);
    doc.text(`Employees: ${payRun.employee_count || 0}`, 14, 56);

    // Summary totals
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 14, 70);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const summaryY = 78;
    doc.text(`Total Gross Pay:`, 14, summaryY);
    doc.text(formatCurrency(payRun.total_gross), 70, summaryY, { align: 'left' });
    doc.text(`Total Deductions:`, 14, summaryY + 7);
    doc.text(formatCurrency(payRun.total_deductions), 70, summaryY + 7, { align: 'left' });
    doc.text(`Total Net Pay:`, 14, summaryY + 14);
    doc.text(formatCurrency(payRun.total_net), 70, summaryY + 14, { align: 'left' });
    if (payRun.total_employer_contributions) {
      doc.text(`Employer Contributions:`, 14, summaryY + 21);
      doc.text(formatCurrency(payRun.total_employer_contributions), 70, summaryY + 21, { align: 'left' });
    }

    // Employee breakdown table
    if (payStubs.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Employee Breakdown', 14, 115);

      let yPos = 125;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Employee', 14, yPos);
      doc.text('Gross', 80, yPos, { align: 'right' });
      doc.text('Deductions', 120, yPos, { align: 'right' });
      doc.text('Net Pay', 160, yPos, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      yPos += 7;

      payStubs.forEach((stub) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        const name = stub.employee ? `${stub.employee.first_name} ${stub.employee.last_name}` : 'Unknown';
        doc.text(name.substring(0, 30), 14, yPos);
        doc.text(formatCurrency(stub.gross_pay), 80, yPos, { align: 'right' });
        doc.text(formatCurrency(stub.total_deductions), 120, yPos, { align: 'right' });
        doc.text(formatCurrency(stub.net_pay), 160, yPos, { align: 'right' });
        yPos += 6;
      });
    }

    // Footer with branding
    const footerY = doc.internal.pageSize.getHeight() - 30;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Powered By:', pageWidth / 2, footerY, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('eFinsuite Globe', pageWidth / 2, footerY + 4, { align: 'center' });
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('For more information or clarification email: info@efintax.biz', pageWidth / 2, footerY + 8, { align: 'center' });
    
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-CA')}`, pageWidth / 2, footerY + 12, { align: 'center' });

    const filename = `PayRun_${payRun.pay_period_start}_to_${payRun.pay_period_end}.pdf`;
    doc.save(filename);
    toast.success('Exported to PDF');
  };

  const handleViewPaystub = (stub: PayStub) => {
    setSelectedPayStub(stub);
    setActiveTab('paystubs');
  };

  const getPaystubData = (stub: PayStub) => ({
    id: stub.id,
    employeeName: stub.employee ? `${stub.employee.first_name} ${stub.employee.last_name}` : 'Unknown',
    employeeNumber: stub.employee?.employee_number || 'N/A',
    department: stub.employee?.department || undefined,
    province: stub.employee?.province || stub.employee_mailing_region || 'ON',
    employeeAddressLine1: stub.employee_mailing_address_line1 || stub.employee?.address_line1 || undefined,
    employeeAddressLine2: stub.employee_mailing_address_line2 || stub.employee?.address_line2 || undefined,
    employeeCity: stub.employee_mailing_city || stub.employee?.city || undefined,
    employeeProvince: stub.employee_mailing_region || stub.employee?.mailing_province || stub.employee?.province || undefined,
    employeePostalCode: stub.employee_mailing_postal_code || stub.employee?.postal_code || undefined,
    employeeCountry: stub.employee_mailing_country || stub.employee?.country || undefined,
    companyAddressLine1: stub.employer_mailing_address_line1 || organization?.address_line1 || undefined,
    companyAddressLine2: stub.employer_mailing_address_line2 || organization?.address_line2 || undefined,
    companyCity: stub.employer_mailing_city || organization?.city || undefined,
    companyProvince: stub.employer_mailing_region || organization?.province || undefined,
    companyPostalCode: stub.employer_mailing_postal_code || organization?.postal_code || undefined,
    companyCountry: stub.employer_mailing_country || organization?.country || undefined,
    payPeriodStart: payRun?.pay_period_start || '',
    payPeriodEnd: payRun?.pay_period_end || '',
    payDate: payRun?.pay_date || '',
    regularHours: stub.regular_hours || 0,
    regularEarnings: stub.regular_earnings || 0,
    overtimeHours: stub.overtime_hours || 0,
    overtimeEarnings: stub.overtime_earnings || 0,
    vacationPay: stub.vacation_pay || 0,
    grossPay: stub.gross_pay,
    cppContribution: stub.cpp_contribution || 0,
    eiPremium: stub.ei_premium || 0,
    federalTax: stub.federal_tax || 0,
    provincialTax: stub.provincial_tax || 0,
    otherDeductions: stub.other_deductions || 0,
    totalDeductions: stub.total_deductions,
    netPay: stub.net_pay,
    ytdGross: stub.ytd_gross || 0,
    ytdCpp: stub.ytd_cpp || 0,
    ytdEi: stub.ytd_ei || 0,
    ytdFederalTax: stub.ytd_federal_tax || 0,
    ytdProvincialTax: stub.ytd_provincial_tax || 0,
  });

  if (!payRun) return null;

  const status = statusConfig[payRun.status];
  const StatusIcon = status.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Payroll Run Details - PAY-{payRun.id.slice(0, 13).replace(/-/g, '')}
            <Badge className={cn("gap-1", status.color)}>
              <StatusIcon className={cn("w-3 h-3", payRun.status === 'processing' && 'animate-spin')} />
              {status.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Period Info */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Period Start</p>
              <p className="font-medium">{formatDate(payRun.pay_period_start)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Period End</p>
              <p className="font-medium">{formatDate(payRun.pay_period_end)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pay Date</p>
              <p className="font-medium">{formatDate(payRun.pay_date)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={cn("gap-1", status.color)}>
                {status.label}
              </Badge>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="p-4 bg-muted/30">
              <p className="text-xs text-muted-foreground">Total Gross</p>
              <p className="text-xl font-bold text-success">{formatCurrency(payRun.total_gross)}</p>
            </Card>
            <Card className="p-4 bg-muted/30">
              <p className="text-xs text-muted-foreground">Total Deductions</p>
              <p className="text-xl font-bold text-destructive">({formatCurrency(payRun.total_deductions)})</p>
            </Card>
            <Card className="p-4 bg-muted/30">
              <p className="text-xs text-muted-foreground">Total Net</p>
              <p className="text-xl font-bold text-success">{formatCurrency(payRun.total_net)}</p>
            </Card>
            <Card className="p-4 bg-muted/30">
              <p className="text-xs text-muted-foreground">Employees</p>
              <p className="text-xl font-bold">{payRun.employee_count || 0}</p>
            </Card>
          </div>

          <Separator />

          {/* Tabs for Payroll Entries and Paystubs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="entries">Payroll Entries</TabsTrigger>
              <TabsTrigger value="paystubs">Paystubs</TabsTrigger>
            </TabsList>

            <TabsContent value="entries" className="mt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Employee Breakdown</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportExcel}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPDF}>
                    <FileText className="w-4 h-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : payStubs.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  No pay stubs found for this pay run
                </div>
              ) : (
                <div className="space-y-3">
                  {payStubs.map((stub) => (
                    <Card key={stub.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">
                            {stub.employee ? `${stub.employee.first_name} ${stub.employee.last_name}` : 'Unknown'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {stub.employee?.employee_number || 'N/A'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Regular: {stub.regular_hours || 0}h @ {formatCurrency(stub.regular_earnings || 0)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Gross Pay</p>
                          <p className="text-lg font-bold text-success">{formatCurrency(stub.gross_pay)}</p>
                          <p className="text-xs text-muted-foreground">Deductions</p>
                          <p className="text-sm text-destructive">({formatCurrency(stub.total_deductions)})</p>
                          <p className="text-xs text-muted-foreground">Net Pay</p>
                          <p className="text-lg font-bold text-success">{formatCurrency(stub.net_pay)}</p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleViewPaystub(stub)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Paystub
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="paystubs" className="mt-4">
              {selectedPayStub ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedPayStub(null)}
                    >
                      ← Back to list
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Viewing paystub for: <span className="font-medium text-foreground">{selectedPayStub.employee?.first_name} {selectedPayStub.employee?.last_name}</span>
                    </p>
                  </div>
                  <PaystubViewer
                    payStub={getPaystubData(selectedPayStub)}
                    companyName={organization?.legal_name || organization?.name || 'Company'}
                    companyLogo={organization?.payroll_show_logo === false ? undefined : (organization?.payroll_logo_url || organization?.logo_url)}
                    currencyCode={localization.currency}
                    locale={locale}
                  />
                </div>
              ) : payStubs.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">Select an employee to view their paystub:</p>
                  {payStubs.map((stub) => (
                    <Card 
                      key={stub.id} 
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedPayStub(stub)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">
                            {stub.employee ? `${stub.employee.first_name} ${stub.employee.last_name}` : 'Unknown'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {stub.employee?.employee_number || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-success font-medium">Net Pay: {formatCurrency(stub.net_pay)}</p>
                        </div>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          View Paystub
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  No pay stubs available
                </div>
              )}
            </TabsContent>
          </Tabs>

          {payRun.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-muted-foreground">{payRun.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
