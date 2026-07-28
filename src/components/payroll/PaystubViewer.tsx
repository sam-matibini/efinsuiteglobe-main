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

export function PaystubViewer({ payStub, companyName, companyLogo, currencyCode, locale }: PaystubViewerProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const { shareWhatsAppNoRecipient, shareSMSNoRecipient } = useTwilioShare();
  const { currencyCode: orgCurrency, locale: orgLocale } = useCurrencyFormatter();
  const activeCurrency = currencyCode ?? orgCurrency ?? 'CAD';
  const activeLocale = locale ?? orgLocale ?? 'en-CA';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(activeLocale, {
      style: 'currency',
      currency: activeCurrency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Intl.DateTimeFormat(activeLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(year, month - 1, day));
  };

  const employeeAddressLines = buildAddressLines({
    line1: payStub.employeeAddressLine1,
    line2: payStub.employeeAddressLine2,
    city: payStub.employeeCity,
    region: payStub.employeeProvince,
    postalCode: payStub.employeePostalCode,
    country: payStub.employeeCountry,
  });

  const employerAddressLines = buildAddressLines({
    line1: payStub.companyAddressLine1,
    line2: payStub.companyAddressLine2,
    city: payStub.companyCity,
    region: payStub.companyProvince,
    postalCode: payStub.companyPostalCode,
    country: payStub.companyCountry,
  });

  const generatePdf = async (): Promise<jsPDF> => {
    return generatePayStubPdf({
      employeeName: payStub.employeeName,
      employeeNumber: payStub.employeeNumber,
      department: payStub.department,
      province: payStub.province || payStub.employeeProvince || 'ON',
      employeeAddressLine1: payStub.employeeAddressLine1,
      employeeAddressLine2: payStub.employeeAddressLine2,
      employeeCity: payStub.employeeCity,
      employeeProvince: payStub.employeeProvince,
      employeePostalCode: payStub.employeePostalCode,
      employeeCountry: payStub.employeeCountry,
      payPeriodStart: payStub.payPeriodStart,
      payPeriodEnd: payStub.payPeriodEnd,
      payDate: payStub.payDate,
      regularHours: payStub.regularHours,
      regularEarnings: payStub.regularEarnings,
      overtimeHours: payStub.overtimeHours,
      overtimeEarnings: payStub.overtimeEarnings,
      vacationHours: 0,
      vacationPay: payStub.vacationPay,
      sickHours: 0,
      bonus: 0,
      commission: 0,
      otherEarnings: 0,
      grossPay: payStub.grossPay,
      cppContribution: payStub.cppContribution,
      eiPremium: payStub.eiPremium,
      federalTax: payStub.federalTax,
      provincialTax: payStub.provincialTax,
      otherDeductions: payStub.otherDeductions,
      totalDeductions: payStub.totalDeductions,
      netPay: payStub.netPay,
      ytdGross: payStub.ytdGross,
      ytdCpp: payStub.ytdCpp,
      ytdEi: payStub.ytdEi,
      ytdFederalTax: payStub.ytdFederalTax,
      ytdProvincialTax: payStub.ytdProvincialTax,
      companyName,
      companyAddressLine1: payStub.companyAddressLine1,
      companyAddressLine2: payStub.companyAddressLine2,
      companyCity: payStub.companyCity,
      companyProvince: payStub.companyProvince,
      companyPostalCode: payStub.companyPostalCode,
      companyCountry: payStub.companyCountry,
      countryCode: (payStub.companyCountry || payStub.employeeCountry || 'CA').toUpperCase().slice(0, 2),
    });
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
      {/* Header with employer mailing address */}
      <div className="flex items-start justify-between gap-6 mb-4">
        <div>
          {companyLogo && (
            <img src={companyLogo} alt="Company Logo" className="h-12 object-contain mb-2" />
          )}
          <h2 className="text-xl font-bold text-primary">{companyName}</h2>
          <p className="text-muted-foreground text-sm">Pay Statement</p>
        </div>
        <div className="text-right text-sm text-muted-foreground leading-relaxed">
          <p className="font-medium text-foreground">{companyName}</p>
          {employerAddressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      
      <Separator className="my-4" />
      
      {/* Employee & Pay Period Info */}
      <div className="flex justify-between items-start gap-6 mb-4">
        <div>
          <p className="font-semibold">{payStub.employeeName}</p>
          {employeeAddressLines.map((line) => (
            <p key={line} className="text-sm text-muted-foreground">{line}</p>
          ))}
          <p className="text-sm text-muted-foreground">Employee #: {payStub.employeeNumber}</p>
          {payStub.province && <p className="text-sm text-muted-foreground">Province: {payStub.province}</p>}
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
