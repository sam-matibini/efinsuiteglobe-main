import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  FileText, 
  Printer, 
  FileSpreadsheet, 
  Mail, 
  MessageCircle, 
  Share2,
  ArrowLeft,
  Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization, getLocaleForCountry } from '@/data/countryLocalizations';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import eFinSuiteGlobeLogo from '@/assets/efinsuite-globe-logo.png';
import { copyTextToClipboard, tryOpenInNewTab } from '@/lib/share';
import { useTwilioShare } from '@/hooks/useTwilioShare';
import { buildAddressLines } from '@/lib/generatePayStubPdf';

type Employee = Database['public']['Tables']['employees']['Row'];

interface EmployeePayHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

interface PayStubWithPayRun {
  id: string;
  gross_pay: number | null;
  total_deductions: number | null;
  net_pay: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  federal_tax: number | null;
  provincial_tax: number | null;
  cpp_contribution: number | null;
  ei_premium: number | null;
  regular_earnings: number | null;
  overtime_earnings: number | null;
  vacation_pay: number | null;
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
  created_at: string;
  pay_runs: {
    pay_period_start: string;
    pay_period_end: string;
    pay_date: string;
    status: string;
  };
}

export default function EmployeePayHistoryDialog({ open, onOpenChange, employee }: EmployeePayHistoryDialogProps) {
  const [selectedPayStub, setSelectedPayStub] = useState<PayStubWithPayRun | null>(null);
  const { organization } = useCurrentOrganization();
  const { shareWhatsAppNoRecipient, shareSMSNoRecipient } = useTwilioShare();

  const { data: payStubs, isLoading } = useQuery({
    queryKey: ['employee-pay-history', employee?.id],
    queryFn: async () => {
      if (!employee) return [];
      
      const { data: stubsData, error: stubsError } = await supabase
        .from('pay_stubs')
        .select('id, pay_run_id, gross_pay, total_deductions, net_pay, regular_hours, overtime_hours, federal_tax, provincial_tax, cpp_contribution, ei_premium, regular_earnings, overtime_earnings, vacation_pay, ytd_gross, ytd_cpp, ytd_ei, ytd_federal_tax, ytd_provincial_tax, employee_mailing_address_line1, employee_mailing_address_line2, employee_mailing_city, employee_mailing_region, employee_mailing_postal_code, employee_mailing_country, employer_mailing_address_line1, employer_mailing_address_line2, employer_mailing_city, employer_mailing_region, employer_mailing_postal_code, employer_mailing_country, created_at')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false });
      
      if (stubsError) throw stubsError;
      if (!stubsData || stubsData.length === 0) return [];
      
      const payRunIds = [...new Set(stubsData.map(s => s.pay_run_id))];
      
      const { data: payRunsData, error: payRunsError } = await supabase
        .from('pay_runs')
        .select('id, pay_period_start, pay_period_end, pay_date, status')
        .in('id', payRunIds)
        .in('status', ['approved', 'paid']);
      
      if (payRunsError) throw payRunsError;
      
      const payRunMap = new Map(payRunsData?.map(pr => [pr.id, pr]) || []);
      
      const result: PayStubWithPayRun[] = stubsData
        .filter(stub => payRunMap.has(stub.pay_run_id))
        .map(stub => ({
          ...stub,
          pay_runs: payRunMap.get(stub.pay_run_id)!,
        }));
      
      return result;
    },
    enabled: !!employee?.id && open,
  });

  // Get country-based currency formatting
  const countryCode = (organization as any)?.country?.code || 'CA';
  const localization = useMemo(() => getCountryLocalization(countryCode), [countryCode]);
  const locale = useMemo(() => getLocaleForCountry(countryCode), [countryCode]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(amount);
  };

  const companyName = organization?.legal_name || organization?.name || 'Company';
  const companyLogo = organization?.payroll_show_logo === false ? undefined : (organization?.payroll_logo_url || organization?.logo_url);

  const generatePayStubPdf = async (payStub: PayStubWithPayRun): Promise<jsPDF> => {
    if (!employee) throw new Error('No employee');
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const payRun = payStub.pay_runs;
    let y = 20;
    
    const leftMargin = 15;
    const rightMargin = pageWidth - 15;
    const org = organization as any;

    // Header: company name (left) + employer mailing address (right)
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, leftMargin, y);

    const employerAddrLines = [
      payStub.employer_mailing_address_line1 || org?.address_line1,
      payStub.employer_mailing_address_line2 || org?.address_line2,
      [
        payStub.employer_mailing_city || org?.city,
        payStub.employer_mailing_region || org?.province,
        payStub.employer_mailing_postal_code || org?.postal_code,
      ].filter(Boolean).join(', '),
      payStub.employer_mailing_country || (typeof org?.country === 'string' ? org.country : org?.country?.name),
    ].filter((v: any) => !!v && String(v).trim().length > 0) as string[];

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(companyName, rightMargin, y - 6, { align: 'right' });
    let addrY = y - 1;
    employerAddrLines.forEach((line) => {
      doc.text(line, rightMargin, addrY, { align: 'right' });
      addrY += 4.5;
    });
    doc.setTextColor(0, 0, 0);

    y = Math.max(y + 8, addrY + 2);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLOYEE PAY STUB', pageWidth / 2, y, { align: 'center' });
    y += 4;

    doc.setDrawColor(200, 200, 200);
    doc.line(leftMargin, y, pageWidth - leftMargin, y);
    y += 8;

    // Employee Info (left, stacked address) + Pay Period (right)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('EMPLOYEE', leftMargin, y);
    doc.text('PAY PERIOD', pageWidth / 2 + 10, y);

    const empAddrLines = [
      payStub.employee_mailing_address_line1 || employee.address_line1,
      payStub.employee_mailing_address_line2 || employee.address_line2,
      [
        payStub.employee_mailing_city || employee.city,
        payStub.employee_mailing_region || employee.mailing_province || employee.province,
        payStub.employee_mailing_postal_code || employee.postal_code,
      ].filter(Boolean).join(', '),
      payStub.employee_mailing_country || employee.country,
    ].filter((v: any) => !!v && String(v).trim().length > 0) as string[];

    const leftLines: Array<{ text: string; bold?: boolean }> = [
      { text: `${employee.first_name} ${employee.last_name}`, bold: true },
      ...empAddrLines.map((t) => ({ text: t })),
      { text: `Employee #: ${employee.employee_number}` },
      { text: `Province: ${payStub.employee_mailing_region || employee.mailing_province || employee.province}` },
    ];
    const rightLines = [
      `Period: ${format(parseLocalDate(payRun.pay_period_start), 'MMM d')} - ${format(parseLocalDate(payRun.pay_period_end), 'MMM d, yyyy')}`,
      `Pay Date: ${format(new Date(payRun.pay_date), 'MMM d, yyyy')}`,
    ];

    let leftY = y + 5;
    let rightY = y + 5;
    leftLines.forEach((l) => {
      doc.setFont('helvetica', l.bold ? 'bold' : 'normal');
      doc.text(l.text, leftMargin, leftY);
      leftY += 5;
    });
    doc.setFont('helvetica', 'normal');
    rightLines.forEach((l) => {
      doc.text(l, pageWidth / 2 + 10, rightY);
      rightY += 5;
    });
    y = Math.max(leftY, rightY) + 4;
    
    // Earnings Section
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 4, pageWidth - 30, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('EARNINGS', 17, y);
    doc.text('Hours', 90, y, { align: 'right' });
    doc.text('Current', 130, y, { align: 'right' });
    y += 8;
    
    doc.setFont('helvetica', 'normal');
    
    const regularHours = payStub.regular_hours ?? 0;
    const overtimeHours = payStub.overtime_hours ?? 0;
    const regularEarnings = payStub.regular_earnings ?? (payStub.gross_pay ?? 0) * 0.85;
    const overtimeEarnings = payStub.overtime_earnings ?? 0;
    const vacationPay = payStub.vacation_pay ?? 0;
    
    doc.text('Regular Earnings', 17, y);
    doc.text(regularHours.toFixed(2), 90, y, { align: 'right' });
    doc.text(formatCurrency(regularEarnings), 130, y, { align: 'right' });
    y += 5;
    
    if (overtimeHours > 0 || overtimeEarnings > 0) {
      doc.text('Overtime Earnings', 17, y);
      doc.text(overtimeHours.toFixed(2), 90, y, { align: 'right' });
      doc.text(formatCurrency(overtimeEarnings), 130, y, { align: 'right' });
      y += 5;
    }
    
    if (vacationPay > 0) {
      doc.text('Vacation Pay', 17, y);
      doc.text(formatCurrency(vacationPay), 130, y, { align: 'right' });
      y += 5;
    }
    
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('GROSS PAY', 17, y);
    doc.text(formatCurrency(payStub.gross_pay ?? 0), 130, y, { align: 'right' });
    y += 10;
    
    // Deductions Section
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 4, pageWidth - 30, 7, 'F');
    doc.text('DEDUCTIONS', 17, y);
    doc.text('Current', 130, y, { align: 'right' });
    doc.text('YTD', pageWidth - 20, y, { align: 'right' });
    y += 8;
    
    doc.setFont('helvetica', 'normal');
    
    doc.text('CPP Contribution', 17, y);
    doc.text(formatCurrency(payStub.cpp_contribution ?? 0), 130, y, { align: 'right' });
    doc.text(formatCurrency(payStub.ytd_cpp ?? 0), pageWidth - 20, y, { align: 'right' });
    y += 5;
    
    doc.text('EI Premium', 17, y);
    doc.text(formatCurrency(payStub.ei_premium ?? 0), 130, y, { align: 'right' });
    doc.text(formatCurrency(payStub.ytd_ei ?? 0), pageWidth - 20, y, { align: 'right' });
    y += 5;
    
    doc.text('Federal Tax', 17, y);
    doc.text(formatCurrency(payStub.federal_tax ?? 0), 130, y, { align: 'right' });
    doc.text(formatCurrency(payStub.ytd_federal_tax ?? 0), pageWidth - 20, y, { align: 'right' });
    y += 5;
    
    doc.text('Provincial Tax', 17, y);
    doc.text(formatCurrency(payStub.provincial_tax ?? 0), 130, y, { align: 'right' });
    doc.text(formatCurrency(payStub.ytd_provincial_tax ?? 0), pageWidth - 20, y, { align: 'right' });
    y += 5;
    
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL DEDUCTIONS', 17, y);
    doc.text(formatCurrency(payStub.total_deductions ?? 0), 130, y, { align: 'right' });
    y += 10;
    
    // Net Pay
    doc.setFillColor(220, 240, 220);
    doc.rect(15, y - 4, pageWidth - 30, 10, 'F');
    doc.setFontSize(11);
    doc.text('NET PAY', 17, y + 2);
    doc.text(formatCurrency(payStub.net_pay ?? 0), pageWidth - 20, y + 2, { align: 'right' });
    y += 15;
    
    // YTD Summary
    doc.setFontSize(9);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y - 4, pageWidth - 30, 7, 'F');
    doc.text('YEAR-TO-DATE SUMMARY', 17, y);
    y += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`YTD Gross: ${formatCurrency(payStub.ytd_gross ?? 0)}`, 17, y);
    doc.text(`YTD CPP: ${formatCurrency(payStub.ytd_cpp ?? 0)}`, pageWidth / 2 - 10, y);
    doc.text(`YTD EI: ${formatCurrency(payStub.ytd_ei ?? 0)}`, pageWidth - 50, y);
    y += 5;
    doc.text(`YTD Fed Tax: ${formatCurrency(payStub.ytd_federal_tax ?? 0)}`, 17, y);
    doc.text(`YTD Prov Tax: ${formatCurrency(payStub.ytd_provincial_tax ?? 0)}`, pageWidth / 2 - 10, y);
    
    // Footer with branding
    const footerY = doc.internal.pageSize.getHeight() - 35;
    y = footerY;
    
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Powered By:', pageWidth / 2, y, { align: 'center' });
    y += 4;
    
    // Add logo
    try {
      const logoResponse = await fetch(eFinSuiteGlobeLogo);
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
      
      const logoWidth = 10;
      const logoHeight = 10;
      const logoX = (pageWidth - logoWidth) / 2;
      doc.addImage(logoBase64, 'PNG', logoX, y, logoWidth, logoHeight);
      y += logoHeight + 2;
    } catch (e) {
      y += 2;
    }
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('eFinsuite Globe', pageWidth / 2, y, { align: 'center' });
    y += 4;
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('For more information or clarification email: info@efintax.biz', pageWidth / 2, y, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    return doc;
  };

  const handleDownloadPDF = async (payStub: PayStubWithPayRun) => {
    try {
      const doc = await generatePayStubPdf(payStub);
      const payRun = payStub.pay_runs;
      const filename = `PayStub_${employee?.first_name}_${employee?.last_name}_${format(new Date(payRun.pay_date), 'yyyy-MM-dd')}.pdf`;
      doc.save(filename);
      toast.success('Pay stub downloaded');
    } catch (error) {
      toast.error('Failed to generate PDF');
    }
  };

  const handlePrint = async (payStub: PayStubWithPayRun) => {
    try {
      const doc = await generatePayStubPdf(payStub);
      doc.autoPrint();
      const pdfDataUri = doc.output('datauristring');

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.setAttribute('aria-hidden', 'true');

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          toast.error('Printing failed. Try downloading the PDF instead.');
        } finally {
          setTimeout(() => iframe.remove(), 1000);
        }
      };

      document.body.appendChild(iframe);
      iframe.src = pdfDataUri;
    } catch (error) {
      toast.error('Failed to print');
    }
  };

  const handleExportExcel = (payStub: PayStubWithPayRun) => {
    if (!employee) return;
    
    const payRun = payStub.pay_runs;
    const data = [
      ['Pay Stub - ' + employee.first_name + ' ' + employee.last_name],
      [],
      ['Pay Period', `${format(parseLocalDate(payRun.pay_period_start), 'MMM d, yyyy')} - ${format(parseLocalDate(payRun.pay_period_end), 'MMM d, yyyy')}`],
      ['Pay Date', format(parseLocalDate(payRun.pay_date), 'MMM d, yyyy')],
      [],
      ['EARNINGS', 'Amount'],
      ['Gross Pay', payStub.gross_pay ?? 0],
      [],
      ['DEDUCTIONS', 'Current', 'YTD'],
      ['CPP Contribution', payStub.cpp_contribution ?? 0, payStub.ytd_cpp ?? 0],
      ['EI Premium', payStub.ei_premium ?? 0, payStub.ytd_ei ?? 0],
      ['Federal Tax', payStub.federal_tax ?? 0, payStub.ytd_federal_tax ?? 0],
      ['Provincial Tax', payStub.provincial_tax ?? 0, payStub.ytd_provincial_tax ?? 0],
      ['Total Deductions', payStub.total_deductions ?? 0],
      [],
      ['NET PAY', payStub.net_pay ?? 0],
      [],
      ['YTD GROSS', payStub.ytd_gross ?? 0],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pay Stub');
    XLSX.writeFile(wb, `PayStub_${employee.first_name}_${employee.last_name}_${format(new Date(payRun.pay_date), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Exported to Excel');
  };

  const handleShareEmail = (payStub: PayStubWithPayRun) => {
    if (!employee) return;
    const payRun = payStub.pay_runs;
    const subject = encodeURIComponent(`Pay Stub - ${format(parseLocalDate(payRun.pay_date), 'MMM d, yyyy')}`);
    const body = encodeURIComponent(
      `Pay Stub for ${employee.first_name} ${employee.last_name}\n\n` +
        `Pay Period: ${format(parseLocalDate(payRun.pay_period_start), 'MMM d')} - ${format(parseLocalDate(payRun.pay_period_end), 'MMM d, yyyy')}\n` +
        `Pay Date: ${format(parseLocalDate(payRun.pay_date), 'MMM d, yyyy')}\n` +
        `Gross Pay: ${formatCurrency(payStub.gross_pay ?? 0)}\n` +
        `Total Deductions: ${formatCurrency(payStub.total_deductions ?? 0)}\n` +
        `Net Pay: ${formatCurrency(payStub.net_pay ?? 0)}\n\n` +
        `Powered by eFinsuite Globe`
    );

    // mailto works best via location.href (avoids popup blockers)
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    toast.success('Opening email client...');
  };

  const handleShareWhatsApp = async (payStub: PayStubWithPayRun) => {
    if (!employee) return;
    const payRun = payStub.pay_runs;
    const rawMessage =
      `*Pay Stub - ${employee.first_name} ${employee.last_name}*\n\n` +
      `📅 Pay Period: ${format(parseLocalDate(payRun.pay_period_start), 'MMM d')} - ${format(parseLocalDate(payRun.pay_period_end), 'MMM d, yyyy')}\n` +
      `💵 Net Pay: ${formatCurrency(payStub.net_pay ?? 0)}\n\n` +
      `_Powered by eFinsuite Globe_`;

    // Use Twilio hook (tries backend, falls back to wa.me)
    await shareWhatsAppNoRecipient(rawMessage);
  };

  const handleShareGoogleChat = async (payStub: PayStubWithPayRun) => {
    if (!employee) return;
    const payRun = payStub.pay_runs;
    const text =
      `Pay Stub - ${employee.first_name} ${employee.last_name}\n` +
      `Pay Period: ${format(parseLocalDate(payRun.pay_period_start), 'MMM d')} - ${format(parseLocalDate(payRun.pay_period_end), 'MMM d, yyyy')}\n` +
      `Net Pay: ${formatCurrency(payStub.net_pay ?? 0)}\n` +
      `Powered by eFinsuite Globe`;

    const copied = await copyTextToClipboard(text);
    toast[copied ? 'success' : 'error'](
      copied ? 'Copied to clipboard for Google Chat' : 'Failed to copy to clipboard'
    );
  };

  const handleShareSMS = async (payStub: PayStubWithPayRun) => {
    if (!employee) return;
    const payRun = payStub.pay_runs;
    const rawMessage =
      `Pay Stub - ${employee.first_name} ${employee.last_name}. ` +
      `Pay Date: ${format(new Date(payRun.pay_date), 'MMM d')}. ` +
      `Net Pay: ${formatCurrency(payStub.net_pay ?? 0)}`;

    // Use Twilio hook (tries backend, falls back to sms: app)
    await shareSMSNoRecipient(rawMessage);
  };


  if (!employee) return null;

  // View individual paystub
  if (selectedPayStub) {
    const payRun = selectedPayStub.pay_runs;
    const org = organization as any;
    const employerAddressLines = buildAddressLines({
      line1: selectedPayStub.employer_mailing_address_line1 || org?.address_line1 || undefined,
      line2: selectedPayStub.employer_mailing_address_line2 || org?.address_line2 || undefined,
      city: selectedPayStub.employer_mailing_city || org?.city || undefined,
      region: selectedPayStub.employer_mailing_region || org?.province || undefined,
      postalCode: selectedPayStub.employer_mailing_postal_code || org?.postal_code || undefined,
      country: selectedPayStub.employer_mailing_country || (typeof org?.country === 'string' ? org.country : org?.country?.name) || undefined,
    });
    const employeeAddressLines = buildAddressLines({
      line1: selectedPayStub.employee_mailing_address_line1 || employee.address_line1 || undefined,
      line2: selectedPayStub.employee_mailing_address_line2 || employee.address_line2 || undefined,
      city: selectedPayStub.employee_mailing_city || employee.city || undefined,
      region: selectedPayStub.employee_mailing_region || employee.mailing_province || employee.province || undefined,
      postalCode: selectedPayStub.employee_mailing_postal_code || employee.postal_code || undefined,
      country: selectedPayStub.employee_mailing_country || employee.country || undefined,
    });
    return (
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen) setSelectedPayStub(null);
        onOpenChange(isOpen);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSelectedPayStub(null)}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <DialogTitle>
                Pay Stub - {employee.first_name} {employee.last_name}
              </DialogTitle>
            </div>
          </DialogHeader>
          
          <Card className="p-6">
            {/* Company Header */}
            <div className="flex items-start justify-between gap-6 mb-6">
              <div>
                <h2 className="text-xl font-bold">{companyName}</h2>
                <p className="text-sm text-muted-foreground">EMPLOYEE PAY STUB</p>
              </div>
              <div className="text-right text-sm text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground">{companyName}</p>
                {employerAddressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
            
            <Separator className="my-4" />
            
            {/* Employee & Pay Period */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="font-semibold mb-2">Employee Information</h3>
                <p className="text-sm">Name: {employee.first_name} {employee.last_name}</p>
                {employeeAddressLines.map((line) => (
                  <p key={line} className="text-sm text-muted-foreground">{line}</p>
                ))}
                <p className="text-sm">Employee #: {employee.employee_number}</p>
                <p className="text-sm">Province: {selectedPayStub.employee_mailing_region || employee.mailing_province || employee.province}</p>
                <p className="text-sm">Department: {employee.department || '-'}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Pay Period</h3>
                <p className="text-sm">Period: {format(parseLocalDate(payRun.pay_period_start), 'MMM d')} - {format(parseLocalDate(payRun.pay_period_end), 'MMM d, yyyy')}</p>
                <p className="text-sm">Pay Date: {format(parseLocalDate(payRun.pay_date), 'MMM d, yyyy')}</p>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            {/* Earnings */}
            <div className="mb-6">
              <h3 className="font-semibold bg-muted px-3 py-2 rounded-t">EARNINGS</h3>
              <div className="border border-t-0 rounded-b p-3 space-y-2">
                <div className="flex justify-between">
                  <span>Regular Earnings</span>
                  <span className="font-mono">{formatCurrency(selectedPayStub.regular_earnings ?? 0)}</span>
                </div>
                {(selectedPayStub.overtime_earnings ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Overtime Earnings</span>
                    <span className="font-mono">{formatCurrency(selectedPayStub.overtime_earnings ?? 0)}</span>
                  </div>
                )}
                {(selectedPayStub.vacation_pay ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Vacation Pay</span>
                    <span className="font-mono">{formatCurrency(selectedPayStub.vacation_pay ?? 0)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>GROSS PAY</span>
                  <span className="font-mono">{formatCurrency(selectedPayStub.gross_pay ?? 0)}</span>
                </div>
              </div>
            </div>
            
            {/* Deductions */}
            <div className="mb-6">
              <h3 className="font-semibold bg-muted px-3 py-2 rounded-t">DEDUCTIONS</h3>
              <div className="border border-t-0 rounded-b p-3 space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground border-b pb-1">
                  <span></span>
                  <div className="flex gap-8">
                    <span className="w-20 text-right">Current</span>
                    <span className="w-20 text-right">YTD</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>CPP Contribution</span>
                  <div className="flex gap-8">
                    <span className="font-mono w-20 text-right">{formatCurrency(selectedPayStub.cpp_contribution ?? 0)}</span>
                    <span className="font-mono w-20 text-right">{formatCurrency(selectedPayStub.ytd_cpp ?? 0)}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>EI Premium</span>
                  <div className="flex gap-8">
                    <span className="font-mono w-20 text-right">{formatCurrency(selectedPayStub.ei_premium ?? 0)}</span>
                    <span className="font-mono w-20 text-right">{formatCurrency(selectedPayStub.ytd_ei ?? 0)}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Federal Tax</span>
                  <div className="flex gap-8">
                    <span className="font-mono w-20 text-right">{formatCurrency(selectedPayStub.federal_tax ?? 0)}</span>
                    <span className="font-mono w-20 text-right">{formatCurrency(selectedPayStub.ytd_federal_tax ?? 0)}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Provincial Tax</span>
                  <div className="flex gap-8">
                    <span className="font-mono w-20 text-right">{formatCurrency(selectedPayStub.provincial_tax ?? 0)}</span>
                    <span className="font-mono w-20 text-right">{formatCurrency(selectedPayStub.ytd_provincial_tax ?? 0)}</span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>TOTAL DEDUCTIONS</span>
                  <span className="font-mono">{formatCurrency(selectedPayStub.total_deductions ?? 0)}</span>
                </div>
              </div>
            </div>
            
            {/* Net Pay */}
            <div className="bg-success/10 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">NET PAY</span>
                <span className="text-2xl font-bold text-success">{formatCurrency(selectedPayStub.net_pay ?? 0)}</span>
              </div>
            </div>
            
            {/* YTD Summary */}
            <div className="mb-6">
              <h3 className="font-semibold bg-muted px-3 py-2 rounded-t">YEAR-TO-DATE SUMMARY</h3>
              <div className="border border-t-0 rounded-b p-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">YTD Gross:</span>
                    <span className="font-mono ml-2">{formatCurrency(selectedPayStub.ytd_gross ?? 0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">YTD CPP:</span>
                    <span className="font-mono ml-2">{formatCurrency(selectedPayStub.ytd_cpp ?? 0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">YTD EI:</span>
                    <span className="font-mono ml-2">{formatCurrency(selectedPayStub.ytd_ei ?? 0)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={() => handlePrint(selectedPayStub)}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleDownloadPDF(selectedPayStub)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Export PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportExcel(selectedPayStub)}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleShareEmail(selectedPayStub)}>
                    <Mail className="w-4 h-4 mr-2" />
                    Share via Email
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleShareWhatsApp(selectedPayStub)}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Share via WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleShareSMS(selectedPayStub)}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Share via SMS
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleShareGoogleChat(selectedPayStub)}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Copy for Google Chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Branding Footer */}
            <Separator className="my-4" />
            <div className="text-center text-xs text-muted-foreground space-y-2">
              <p className="text-[10px]">Powered By:</p>
              <img 
                src={eFinSuiteGlobeLogo} 
                alt="eFinsuite Globe" 
                className="h-10 w-10 mx-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <p className="font-semibold text-primary">eFinsuite Globe</p>
              <p>For more information or clarification email: <a href="mailto:info@efintax.biz" className="text-primary hover:underline">info@efintax.biz</a></p>
            </div>
          </Card>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Pay History - {employee.first_name} {employee.last_name}
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !payStubs || payStubs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No pay history found for this employee.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Pay Period</TableHead>
                <TableHead>Pay Date</TableHead>
                <TableHead className="text-right">Gross Pay</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payStubs.map((payStub) => {
                const payRun = payStub.pay_runs;
                return (
                  <TableRow key={payStub.id}>
                    <TableCell>
                      {format(parseLocalDate(payRun.pay_period_start), 'MMM d')} - {format(parseLocalDate(payRun.pay_period_end), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      {format(parseLocalDate(payRun.pay_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(payStub.gross_pay ?? 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatCurrency(payStub.total_deductions ?? 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(payStub.net_pay ?? 0)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={payRun.status === 'paid' ? 'default' : 'secondary'}>
                        {payRun.status === 'paid' ? 'Paid' : 'Approved'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPayStub(payStub)}
                          title="View Paystub"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPDF(payStub)}
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrint(payStub)}
                          title="Print"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
