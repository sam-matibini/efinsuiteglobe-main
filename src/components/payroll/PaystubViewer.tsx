import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Printer, 
  FileText, 
  FileSpreadsheet, 
  Mail, 
  MessageCircle,
  Share2,
  Download
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import eFinSuiteGlobeLogo from '@/assets/efinsuite-globe-logo.png';
import { copyTextToClipboard, tryOpenInNewTab } from '@/lib/share';
import { useTwilioShare } from '@/hooks/useTwilioShare';
import { buildAddressLines, generatePayStubPdf } from '@/lib/generatePayStubPdf';

interface PayStubData {
  id: string;
  employeeName: string;
  employeeNumber: string;
  department?: string;
  province?: string;
  employeeAddressLine1?: string;
  employeeAddressLine2?: string;
  employeeCity?: string;
  employeeProvince?: string;
  employeePostalCode?: string;
  employeeCountry?: string;
  companyAddressLine1?: string;
  companyAddressLine2?: string;
  companyCity?: string;
  companyProvince?: string;
  companyPostalCode?: string;
  companyCountry?: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  regularHours: number;
  regularEarnings: number;
  overtimeHours: number;
  overtimeEarnings: number;
  vacationPay: number;
  grossPay: number;
  cppContribution: number;
  eiPremium: number;
  federalTax: number;
  provincialTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  ytdGross: number;
  ytdCpp: number;
  ytdEi: number;
  ytdFederalTax: number;
  ytdProvincialTax: number;
  ytdTax?: number; // Combined Federal + Provincial Tax YTD
  ytdNetPay?: number; // Net Pay YTD
}

interface PaystubViewerProps {
  payStub: PayStubData;
  companyName: string;
  companyLogo?: string | null;
  currencyCode?: string;
  locale?: string;
}

export function PaystubViewer({ payStub, companyName, companyLogo, currencyCode = 'CAD', locale = 'en-CA' }: PaystubViewerProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const { shareWhatsAppNoRecipient, shareSMSNoRecipient } = useTwilioShare();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(year, month - 1, day));
  };

  const generatePdf = async (): Promise<jsPDF> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;
    const leftMargin = 15;
    const rightMargin = pageWidth - 15;

    // Logo placeholder - if logo exists, add it
    if (companyLogo) {
      try {
        doc.addImage(companyLogo, 'PNG', pageWidth / 2 - 20, y, 40, 15);
        y += 20;
      } catch (e) {
        // Logo loading failed, continue without it
      }
    }

    // Company name header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(31, 78, 121);
    doc.text(companyName, pageWidth / 2, y, { align: 'center' });
    
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Pay Statement', pageWidth / 2, y, { align: 'center' });
    
    // Divider
    y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(leftMargin, y, rightMargin, y);
    
    // Employee & Pay Period Info - two columns
    y += 10;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(payStub.employeeName, leftMargin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Pay Period: ${formatDate(payStub.payPeriodStart)} - ${formatDate(payStub.payPeriodEnd)}`, rightMargin, y, { align: 'right' });
    
    y += 6;
    doc.setTextColor(100, 100, 100);
    doc.text(payStub.employeeNumber, leftMargin, y);
    doc.text(`Pay Date: ${formatDate(payStub.payDate)}`, rightMargin, y, { align: 'right' });
    
    // Divider
    y += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(leftMargin, y, rightMargin, y);
    
    // Earnings Section
    y += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Earnings', leftMargin, y);
    
    y += 8;
    doc.setFont('helvetica', 'normal');
    
    // Regular earnings
    if (payStub.regularHours > 0) {
      doc.setTextColor(100, 100, 100);
      doc.text(`Regular (${payStub.regularHours}h)`, leftMargin, y);
      doc.setTextColor(0, 0, 0);
      doc.text(formatCurrency(payStub.regularEarnings), rightMargin, y, { align: 'right' });
      y += 6;
    }
    
    // Overtime
    if (payStub.overtimeHours > 0) {
      doc.setTextColor(100, 100, 100);
      doc.text(`Overtime (${payStub.overtimeHours}h)`, leftMargin, y);
      doc.setTextColor(0, 0, 0);
      doc.text(formatCurrency(payStub.overtimeEarnings), rightMargin, y, { align: 'right' });
      y += 6;
    }
    
    // Vacation
    if (payStub.vacationPay > 0) {
      doc.setTextColor(100, 100, 100);
      doc.text('Vacation Pay', leftMargin, y);
      doc.setTextColor(0, 0, 0);
      doc.text(formatCurrency(payStub.vacationPay), rightMargin, y, { align: 'right' });
      y += 6;
    }
    
    // Gross Pay
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Gross Pay', leftMargin, y);
    doc.text(formatCurrency(payStub.grossPay), rightMargin, y, { align: 'right' });
    
    // Deductions Section
    y += 12;
    doc.text('Deductions', leftMargin, y);
    
    y += 8;
    doc.setFont('helvetica', 'normal');
    
    if (payStub.cppContribution > 0) {
      doc.setTextColor(180, 100, 80);
      doc.text('CPP (Employee)', leftMargin, y);
      doc.text(`(${formatCurrency(payStub.cppContribution)})`, rightMargin, y, { align: 'right' });
      y += 6;
    }
    
    if (payStub.eiPremium > 0) {
      doc.text('EI (Employee)', leftMargin, y);
      doc.text(`(${formatCurrency(payStub.eiPremium)})`, rightMargin, y, { align: 'right' });
      y += 6;
    }
    
    if (payStub.federalTax > 0) {
      doc.text('Federal Tax', leftMargin, y);
      doc.text(`(${formatCurrency(payStub.federalTax)})`, rightMargin, y, { align: 'right' });
      y += 6;
    }
    
    if (payStub.provincialTax > 0) {
      doc.text('Provincial Tax', leftMargin, y);
      doc.text(`(${formatCurrency(payStub.provincialTax)})`, rightMargin, y, { align: 'right' });
      y += 6;
    }
    
    // Total Deductions
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Total Deductions', leftMargin, y);
    doc.text(`(${formatCurrency(payStub.totalDeductions)})`, rightMargin, y, { align: 'right' });
    
    // Net Pay Section
    y += 12;
    doc.setFillColor(240, 248, 255);
    doc.rect(leftMargin, y - 5, rightMargin - leftMargin, 14, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('Net Pay', leftMargin + 5, y + 3);
    doc.setTextColor(34, 139, 34);
    doc.text(formatCurrency(payStub.netPay), rightMargin - 5, y + 3, { align: 'right' });
    
    // Year-to-Date Section
    y += 20;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Year-to-Date', leftMargin, y);
    
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    
    // YTD in rows - compute derived values if not provided
    const ytdTax = payStub.ytdTax ?? (payStub.ytdFederalTax + payStub.ytdProvincialTax);
    const ytdNetPay = payStub.ytdNetPay ?? (payStub.ytdGross - payStub.ytdCpp - payStub.ytdEi - ytdTax);
    
    const ytdItems = [
      { label: 'Gross:', value: payStub.ytdGross },
      { label: 'CPP:', value: payStub.ytdCpp },
      { label: 'EI:', value: payStub.ytdEi },
      { label: 'Fed Tax:', value: payStub.ytdFederalTax },
      { label: 'Prov Tax:', value: payStub.ytdProvincialTax },
      { label: 'Total Tax:', value: ytdTax },
      { label: 'Net Pay:', value: ytdNetPay },
    ];
    
    const colWidth = (rightMargin - leftMargin) / 3;
    ytdItems.forEach((item, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const xPos = leftMargin + col * colWidth;
      const yPos = y + row * 8;
      
      doc.setTextColor(100, 100, 100);
      doc.text(item.label, xPos, yPos);
      doc.setTextColor(0, 0, 0);
      doc.text(formatCurrency(item.value), xPos + 25, yPos);
    });
    
    // Footer with branding
    const footerY = doc.internal.pageSize.getHeight() - 35;
    y = footerY;
    
    // Add logo
    if (companyLogo) {
      try {
        const logoImg = new Image();
        logoImg.src = companyLogo;
        // We'll use the brand logo instead for consistency
      } catch (e) {
        console.error('Logo error:', e);
      }
    }
    
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Powered By:', pageWidth / 2, y, { align: 'center' });
    y += 4;
    
    // Add eFinsuite Globe logo
    try {
      const logoModule = await import('@/assets/efinsuite-globe-logo.png');
      const logoResponse = await fetch(logoModule.default);
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
      console.error('Failed to add logo:', e);
      y += 2;
    }
    
    // Brand name
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('eFinsuite Globe', pageWidth / 2, y, { align: 'center' });
    y += 4;
    
    // Contact info
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('For more information or clarification email: info@efintax.biz', pageWidth / 2, y, { align: 'center' });
    y += 4;
    
    // Timestamp
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-CA')}`, pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    
    return doc;
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const doc = await generatePdf();
      doc.autoPrint();
      const pdfDataUri = doc.output('datauristring');
      
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head><title>Print Pay Stub - ${payStub.employeeName}</title></head>
            <body style="margin:0;padding:0;">
              <iframe
                src="${pdfDataUri}"
                style="width:100%;height:100%;border:none;"
                onload="this.contentWindow.print();">
              </iframe>
            </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        toast.error('Please allow pop-ups to print');
      }
    } catch (error) {
      toast.error('Failed to generate print document');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const doc = await generatePdf();
      const filename = `paystub_${payStub.employeeNumber}_${payStub.payDate}.pdf`;
      doc.save(filename);
      toast.success('PDF exported successfully');
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  const handleExportExcel = () => {
    // Compute derived values if not provided
    const ytdTax = payStub.ytdTax ?? (payStub.ytdFederalTax + payStub.ytdProvincialTax);
    const ytdNetPay = payStub.ytdNetPay ?? (payStub.ytdGross - payStub.ytdCpp - payStub.ytdEi - ytdTax);
    
    const data = [{
      'Employee Name': payStub.employeeName,
      'Employee #': payStub.employeeNumber,
      'Pay Period Start': payStub.payPeriodStart,
      'Pay Period End': payStub.payPeriodEnd,
      'Pay Date': payStub.payDate,
      'Regular Hours': payStub.regularHours,
      'Regular Earnings': payStub.regularEarnings,
      'Overtime Hours': payStub.overtimeHours,
      'Overtime Earnings': payStub.overtimeEarnings,
      'Vacation Pay': payStub.vacationPay,
      'Gross Pay': payStub.grossPay,
      'CPP': payStub.cppContribution,
      'EI': payStub.eiPremium,
      'Federal Tax': payStub.federalTax,
      'Provincial Tax': payStub.provincialTax,
      'Total Deductions': payStub.totalDeductions,
      'Net Pay': payStub.netPay,
      'YTD Gross': payStub.ytdGross,
      'YTD CPP': payStub.ytdCpp,
      'YTD EI': payStub.ytdEi,
      'YTD Federal Tax': payStub.ytdFederalTax,
      'YTD Provincial Tax': payStub.ytdProvincialTax,
      'YTD Tax': ytdTax,
      'YTD Net Pay': ytdNetPay,
    }];

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pay Stub');
    
    const filename = `paystub_${payStub.employeeNumber}_${payStub.payDate}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success('Excel exported successfully');
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Pay Stub - ${payStub.employeeName} - ${formatDate(payStub.payDate)}`);
    const body = encodeURIComponent(
      `Pay Statement\n\n` +
        `Employee: ${payStub.employeeName}\n` +
        `Pay Period: ${formatDate(payStub.payPeriodStart)} - ${formatDate(payStub.payPeriodEnd)}\n` +
        `Pay Date: ${formatDate(payStub.payDate)}\n\n` +
        `Gross Pay: ${formatCurrency(payStub.grossPay)}\n` +
        `Deductions: ${formatCurrency(payStub.totalDeductions)}\n` +
        `Net Pay: ${formatCurrency(payStub.netPay)}\n`
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    toast.success('Opening email client...');
  };

  const handleShareWhatsApp = async () => {
    const rawText =
      `*Pay Statement*\n\n` +
      `Employee: ${payStub.employeeName}\n` +
      `Pay Period: ${formatDate(payStub.payPeriodStart)} - ${formatDate(payStub.payPeriodEnd)}\n` +
      `Pay Date: ${formatDate(payStub.payDate)}\n\n` +
      `Gross Pay: ${formatCurrency(payStub.grossPay)}\n` +
      `Deductions: ${formatCurrency(payStub.totalDeductions)}\n` +
      `*Net Pay: ${formatCurrency(payStub.netPay)}*`;

    // Uses Twilio hook with fallback
    await shareWhatsAppNoRecipient(rawText);
  };

  const handleShareSMS = async () => {
    const rawText =
      `Pay Stub - ${payStub.employeeName}. ` +
      `Pay Date: ${formatDate(payStub.payDate)}. ` +
      `Net Pay: ${formatCurrency(payStub.netPay)}`;

    // Uses Twilio hook with fallback
    await shareSMSNoRecipient(rawText);
  };

  const handleShareGoogleChat = async () => {
    const rawText =
      `Pay Statement\n\n` +
      `Employee: ${payStub.employeeName}\n` +
      `Pay Period: ${formatDate(payStub.payPeriodStart)} - ${formatDate(payStub.payPeriodEnd)}\n` +
      `Pay Date: ${formatDate(payStub.payDate)}\n\n` +
      `Gross Pay: ${formatCurrency(payStub.grossPay)}\n` +
      `Deductions: ${formatCurrency(payStub.totalDeductions)}\n` +
      `Net Pay: ${formatCurrency(payStub.netPay)}`;

    const copied = await copyTextToClipboard(rawText);
    toast[copied ? 'success' : 'error'](
      copied ? 'Copied to clipboard for Google Chat' : 'Failed to copy to clipboard'
    );
  };

  return (
    <Card className="p-6 border rounded-lg">
      {/* Header with logo */}
      <div className="text-center mb-4">
        {companyLogo && (
          <div className="flex justify-center mb-2">
            <img src={companyLogo} alt="Company Logo" className="h-12 object-contain" />
          </div>
        )}
        <h2 className="text-xl font-bold text-primary">{companyName}</h2>
        <p className="text-muted-foreground text-sm">Pay Statement</p>
      </div>
      
      <Separator className="my-4" />
      
      {/* Employee & Pay Period Info */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="font-semibold">{payStub.employeeName}</p>
          <p className="text-sm text-muted-foreground">{payStub.employeeNumber}</p>
        </div>
        <div className="text-right">
          <p className="text-sm">Pay Period: {formatDate(payStub.payPeriodStart)} - {formatDate(payStub.payPeriodEnd)}</p>
          <p className="text-sm">Pay Date: {formatDate(payStub.payDate)}</p>
        </div>
      </div>
      
      {/* Earnings */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">Earnings</h3>
        <Separator className="mb-2" />
        
        {payStub.regularHours > 0 && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Regular ({payStub.regularHours}h)</span>
            <span>{formatCurrency(payStub.regularEarnings)}</span>
          </div>
        )}
        
        {payStub.overtimeHours > 0 && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Overtime ({payStub.overtimeHours}h)</span>
            <span>{formatCurrency(payStub.overtimeEarnings)}</span>
          </div>
        )}
        
        {payStub.vacationPay > 0 && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Vacation Pay</span>
            <span>{formatCurrency(payStub.vacationPay)}</span>
          </div>
        )}
        
        <div className="flex justify-between font-semibold pt-2">
          <span>Gross Pay</span>
          <span>{formatCurrency(payStub.grossPay)}</span>
        </div>
      </div>
      
      {/* Deductions */}
      <div className="mb-4">
        <h3 className="font-semibold mb-2">Deductions</h3>
        <Separator className="mb-2" />
        
        {payStub.cppContribution > 0 && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-amber-700">CPP (Employee)</span>
            <span className="text-amber-700">({formatCurrency(payStub.cppContribution)})</span>
          </div>
        )}
        
        {payStub.eiPremium > 0 && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-amber-700">EI (Employee)</span>
            <span className="text-amber-700">({formatCurrency(payStub.eiPremium)})</span>
          </div>
        )}
        
        {payStub.federalTax > 0 && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Federal Tax</span>
            <span className="text-muted-foreground">({formatCurrency(payStub.federalTax)})</span>
          </div>
        )}
        
        {payStub.provincialTax > 0 && (
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Provincial Tax</span>
            <span className="text-muted-foreground">({formatCurrency(payStub.provincialTax)})</span>
          </div>
        )}
        
        <div className="flex justify-between font-semibold pt-2">
          <span>Total Deductions</span>
          <span className="text-destructive">({formatCurrency(payStub.totalDeductions)})</span>
        </div>
      </div>
      
      {/* Net Pay */}
      <div className="bg-muted/50 p-4 rounded-lg mb-4">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Net Pay</span>
          <span className="text-2xl font-bold text-success">{formatCurrency(payStub.netPay)}</span>
        </div>
      </div>
      
      {/* Year-to-Date */}
      <div className="mb-6">
        <h3 className="font-semibold mb-2">Year-to-Date</h3>
        {(() => {
          const ytdTax = payStub.ytdTax ?? (payStub.ytdFederalTax + payStub.ytdProvincialTax);
          const ytdNetPay = payStub.ytdNetPay ?? (payStub.ytdGross - payStub.ytdCpp - payStub.ytdEi - ytdTax);
          return (
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-amber-700">Gross:</span>
                <span className="ml-2">{formatCurrency(payStub.ytdGross)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">CPP:</span>
                <span className="ml-2">{formatCurrency(payStub.ytdCpp)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">EI:</span>
                <span className="ml-2">{formatCurrency(payStub.ytdEi)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Fed Tax:</span>
                <span className="ml-2">{formatCurrency(payStub.ytdFederalTax)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Prov Tax:</span>
                <span className="ml-2">{formatCurrency(payStub.ytdProvincialTax)}</span>
              </div>
              <div>
                <span className="text-destructive font-medium">Total Tax:</span>
                <span className="ml-2">{formatCurrency(ytdTax)}</span>
              </div>
              <div className="col-span-3 pt-2 border-t mt-2">
                <span className="text-success font-semibold">YTD Net Pay:</span>
                <span className="ml-2 font-semibold text-success">{formatCurrency(ytdNetPay)}</span>
              </div>
            </div>
          );
        })()}
      </div>
      
      {/* Action Buttons */}
      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
          <Printer className="w-4 h-4 mr-2" />
          Print
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              View & Share
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem onClick={handleExportPDF}>
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShareEmail}>
              <Mail className="w-4 h-4 mr-2" />
              Share via Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShareWhatsApp}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Share via WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShareSMS}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Share via SMS
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShareGoogleChat}>
              <MessageCircle className="w-4 h-4 mr-2" />
              Copy for Google Chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Footer */}
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
  );
}
