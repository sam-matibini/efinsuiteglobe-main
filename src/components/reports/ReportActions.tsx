import React, { useState } from 'react';
import {
  Download,
  Printer,
  Share2,
  Mail,
  MessageCircle,
  Phone,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { copyTextToClipboard, tryOpenInNewTab, openWhatsAppShare } from '@/lib/share';
import { exportToFormattedExcel } from '@/lib/excelExport';

export interface ReportData {
  title: string;
  subtitle?: string;
  dateRange?: string;
  organizationName?: string;
  headers: string[];
  rows: (string | number)[][];
  totals?: { label: string; value: string | number }[];
  metadata?: Record<string, string>;
}

interface ReportActionsProps {
  reportData: ReportData;
  className?: string;
  variant?: 'default' | 'compact';
}

export const ReportActions = React.forwardRef<HTMLDivElement, ReportActionsProps>(function ReportActions({ reportData, className = '', variant = 'default' }, ref) {
  const [isExporting, setIsExporting] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState(`${reportData.title} Report`);
  const [emailMessage, setEmailMessage] = useState('');
  const [smsTo, setSmsTo] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Export to Excel with proper numeric formatting
  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      exportToFormattedExcel({
        title: reportData.title,
        subtitle: reportData.subtitle,
        organizationName: reportData.organizationName,
        dateRange: reportData.dateRange,
        headers: reportData.headers,
        rows: reportData.rows,
        totals: reportData.totals,
      });
      
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Failed to export to Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;
      
      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(reportData.title, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      // Subtitle
      if (reportData.subtitle) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(reportData.subtitle, pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;
      }
      
      // Organization & Date
      doc.setFontSize(10);
      doc.setTextColor(100);
      if (reportData.organizationName) {
        doc.text(reportData.organizationName, pageWidth / 2, yPos, { align: 'center' });
        yPos += 6;
      }
      if (reportData.dateRange) {
        doc.text(`Period: ${reportData.dateRange}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 6;
      }
      
      yPos += 10;
      doc.setTextColor(0);
      
      // Table header
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const colWidth = (pageWidth - 40) / reportData.headers.length;
      const startX = 20;
      
      // Header background
      doc.setFillColor(240, 240, 240);
      doc.rect(startX, yPos - 4, pageWidth - 40, 8, 'F');
      
      reportData.headers.forEach((header, i) => {
        const x = startX + (i * colWidth);
        const align = i === 0 ? 'left' : 'right';
        doc.text(header, align === 'left' ? x : x + colWidth - 2, yPos, { align });
      });
      yPos += 10;
      
      // Helper to detect total rows
      const isTotalRow = (row: (string | number)[]) => {
        const label = String(row[0] || '').toLowerCase().trim();
        return label.startsWith('total') || label.includes('total ') ||
          label === 'net profit/loss' || label === 'net income' ||
          label === 'net change in cash' || label === 'ending cash balance' ||
          label === 'gross profit' || label === 'operating profit' ||
          label === 'operating income' || label === 'net tax' || label.includes('net tax') ||
          label.includes('liabilities and equity');
      };
      const isGrandTotalRow = (row: (string | number)[]) => {
        const label = String(row[0] || '').toLowerCase().trim();
        return label.startsWith('total assets') || label.includes('liabilities and equity') ||
          label === 'net income' || label === 'net profit/loss' ||
          label === 'net change in cash' || label === 'ending cash balance';
      };

      // Table rows
      doc.setFont('helvetica', 'normal');
      reportData.rows.forEach((row, rowIndex) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        const isTotal = isTotalRow(row);
        const isGrand = isGrandTotalRow(row);

        // Alternate row background (skip for totals)
        if (!isTotal && rowIndex % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(startX, yPos - 4, pageWidth - 40, 7, 'F');
        }
        
        // Total row: thin top border
        if (isTotal) {
          doc.setDrawColor(0);
          doc.setLineWidth(0.3);
          doc.line(startX, yPos - 4, pageWidth - 20, yPos - 4);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFont('helvetica', 'normal');
        }
        
        row.forEach((cell, i) => {
          const x = startX + (i * colWidth);
          const align = i === 0 ? 'left' : 'right';
          const text = String(cell);
          doc.text(text, align === 'left' ? x : x + colWidth - 2, yPos, { align });
        });

        // Total row: bottom border (double for grand totals)
        if (isGrand) {
          doc.setDrawColor(0);
          doc.setLineWidth(0.3);
          doc.line(startX, yPos + 2, pageWidth - 20, yPos + 2);
          doc.line(startX, yPos + 3.5, pageWidth - 20, yPos + 3.5);
        } else if (isTotal) {
          doc.setDrawColor(0);
          doc.setLineWidth(0.2);
          doc.line(startX, yPos + 2, pageWidth - 20, yPos + 2);
        }

        yPos += 7;
      });
      
      // Totals
      if (reportData.totals && reportData.totals.length > 0) {
        yPos += 5;
        doc.setFont('helvetica', 'bold');
        
        reportData.totals.forEach(total => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          // Thin top border
          doc.setDrawColor(0);
          doc.setLineWidth(0.3);
          doc.line(startX, yPos - 4, pageWidth - 20, yPos - 4);
          
          doc.text(total.label, startX, yPos);
          doc.text(String(total.value), pageWidth - 22, yPos, { align: 'right' });
          
          // Double bottom border
          doc.line(startX, yPos + 2, pageWidth - 20, yPos + 2);
          doc.line(startX, yPos + 3.5, pageWidth - 20, yPos + 3.5);
          yPos += 9;
        });
      }
      
      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150);
        doc.text(
          `Generated on ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
          pageWidth / 2,
          285,
          { align: 'center' }
        );
      }
      
      const filename = `${reportData.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
      toast.success('PDF file downloaded successfully');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export to PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Print
  const handlePrint = () => {
    // Use about:blank to get a clean document we can write to
    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }
    
    const styles = `
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; margin: 0; }
        h1 { font-size: 24px; margin-bottom: 5px; }
        h2 { font-size: 14px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f5f5f5; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; font-size: 12px; }
        td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
        tr:nth-child(even) { background: #fafafa; }
        tr.section-total { font-weight: bold; border-top: 1px solid #333; border-bottom: 1px solid #333; background: transparent; }
        tr.grand-total { font-weight: bold; border-top: 1px solid #333; border-bottom: 3px double #333; background: transparent; }
        .totals-table { margin-top: 20px; width: 100%; border-collapse: collapse; }
        .totals-table td { padding: 8px 10px; font-weight: bold; font-size: 12px; }
        .totals-table tr { border-top: 1px solid #333; border-bottom: 3px double #333; }
        .totals-table td:first-child { text-align: left; }
        .totals-table td:not(:first-child) { text-align: right; }
        .text-right { text-align: right; }
        .footer { margin-top: 30px; font-size: 10px; color: #999; text-align: center; }
        @media print { 
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    `;
    
    // Calculate number of value columns based on headers (first header is label, rest are value columns)
    const numValueCols = reportData.headers.length - 1;
    
    let tableHtml = `<table><thead><tr>`;
    reportData.headers.forEach((h, i) => {
      tableHtml += `<th class="${i > 0 ? 'text-right' : ''}">${h}</th>`;
    });
    tableHtml += `</tr></thead><tbody>`;
    
    const isTotalLabel = (label: string) => {
      const l = label.toLowerCase().trim();
      return l.startsWith('total') || l.includes('total ') ||
        l === 'net profit/loss' || l === 'net income' ||
        l === 'net change in cash' || l === 'ending cash balance' ||
        l === 'gross profit' || l === 'operating profit' ||
        l === 'operating income' || l === 'net tax' || l.includes('net tax') ||
        l.includes('liabilities and equity');
    };
    const isGrandLabel = (label: string) => {
      const l = label.toLowerCase().trim();
      return l.startsWith('total assets') || l.includes('liabilities and equity') ||
        l === 'net income' || l === 'net profit/loss' ||
        l === 'net change in cash' || l === 'ending cash balance';
    };

    reportData.rows.forEach(row => {
      const label = String(row[0] || '');
      const rowClass = isGrandLabel(label) ? 'grand-total' : isTotalLabel(label) ? 'section-total' : '';
      tableHtml += `<tr class="${rowClass}">`;
      row.forEach((cell, i) => {
        tableHtml += `<td class="${i > 0 ? 'text-right' : ''}">${cell}</td>`;
      });
      tableHtml += `</tr>`;
    });
    tableHtml += `</tbody></table>`;
    
    let totalsHtml = '';
    if (reportData.totals && reportData.totals.length > 0) {
      totalsHtml = `<table class="totals-table">`;
      reportData.totals.forEach(t => {
        // First column is label, then value spans remaining columns (right-aligned in last column)
        totalsHtml += `<tr><td>${t.label}</td>`;
        // Add empty cells for middle columns if multiple value columns exist
        for (let i = 1; i < numValueCols; i++) {
          totalsHtml += `<td></td>`;
        }
        totalsHtml += `<td class="text-right">${t.value}</td></tr>`;
      });
      totalsHtml += `</table>`;
    }
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${reportData.title}</title>
  ${styles}
</head>
<body>
  <h1>${reportData.title}</h1>
  <h2>${reportData.organizationName || ''} ${reportData.dateRange ? `| ${reportData.dateRange}` : ''}</h2>
  ${tableHtml}
  ${totalsHtml}
  <div class="footer">Generated on ${new Date().toLocaleString()}</div>
</body>
</html>`;
    
    // Write the content to the new window
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for the document to be fully ready before printing
    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.error('Print failed:', e);
      }
    };
    
    // Use onload event or fallback to timeout
    if (printWindow.document.readyState === 'complete') {
      // Document already loaded, wait a bit for rendering
      setTimeout(triggerPrint, 150);
    } else {
      printWindow.onload = () => {
        setTimeout(triggerPrint, 150);
      };
      // Fallback in case onload doesn't fire
      setTimeout(triggerPrint, 500);
    }
  };

  // Generate shareable text
  const generateShareText = () => {
    let text = `${reportData.title}\n`;
    if (reportData.organizationName) text += `${reportData.organizationName}\n`;
    if (reportData.dateRange) text += `Period: ${reportData.dateRange}\n\n`;
    
    // Summary totals only for sharing
    if (reportData.totals) {
      reportData.totals.forEach(t => {
        text += `${t.label}: ${t.value}\n`;
      });
    }
    
    text += `\nGenerated on ${new Date().toLocaleDateString()}`;
    return text;
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateShareText());
      setCopied(true);
      toast.success('Report summary copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Share via WhatsApp
  const shareViaWhatsApp = async () => {
    const raw = generateShareText();
    const { opened, copied } = await openWhatsAppShare(raw);

    if (!opened) {
      toast.info(
        copied
          ? 'Message copied—paste it in WhatsApp to share.'
          : 'Could not open WhatsApp.'
      );
      return;
    }

    toast.success('Opening WhatsApp...');
  };

  // Share via Email (opens email dialog)
  const openEmailDialog = () => {
    setEmailSubject(`${reportData.title} Report`);
    setEmailMessage(`Please find the ${reportData.title} report attached.\n\n${generateShareText()}`);
    setEmailDialogOpen(true);
  };

  // Send email (opens default email client)
  const sendEmail = () => {
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailMessage);
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
    setEmailDialogOpen(false);
    toast.success('Email client opened');
  };

  // Share via SMS
  const shareViaSMS = () => {
    const text = encodeURIComponent(generateShareText());
    if (smsTo) {
      window.location.href = `sms:${smsTo}?body=${text}`;
    } else {
      window.location.href = `sms:?body=${text}`;
    }
    setSmsDialogOpen(false);
  };

  // Native share (mobile)
  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: reportData.title,
          text: generateShareText(),
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      copyToClipboard();
    }
  };

  // Share via Google Chat
  const shareViaGoogleChat = async () => {
    const raw = generateShareText();
    const copied = await copyTextToClipboard(raw);
    toast[copied ? 'success' : 'error'](
      copied ? 'Copied to clipboard for Google Chat' : 'Failed to copy to clipboard'
    );
    if (copied) tryOpenInNewTab('https://chat.google.com/');
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={exportToExcel} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Export to Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToPDF} className="gap-2">
              <FileText className="w-4 h-4" />
              Export to PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={openEmailDialog} className="gap-2">
              <Mail className="w-4 h-4" />
              Email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={shareViaWhatsApp} className="gap-2">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSmsDialogOpen(true)} className="gap-2">
              <Phone className="w-4 h-4" />
              SMS
            </DropdownMenuItem>
            <DropdownMenuItem onClick={shareViaGoogleChat} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Google Chat
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={copyToClipboard} className="gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
          <Printer className="w-4 h-4" />
          Print
        </Button>

        {/* Email Dialog */}
        <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Share via Email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="emailTo">To</Label>
                <Input
                  id="emailTo"
                  type="email"
                  placeholder="recipient@email.com"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="emailSubject">Subject</Label>
                <Input
                  id="emailSubject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="emailMessage">Message</Label>
                <Textarea
                  id="emailMessage"
                  rows={6}
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
              <Button onClick={sendEmail} className="gap-2">
                <Mail className="w-4 h-4" />
                Open Email Client
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SMS Dialog */}
        <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Share via SMS</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="smsTo">Phone Number (optional)</Label>
                <Input
                  id="smsTo"
                  type="tel"
                  placeholder="+1234567890"
                  value={smsTo}
                  onChange={(e) => setSmsTo(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Leave empty to open your messaging app with the report summary ready to send.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSmsDialogOpen(false)}>Cancel</Button>
              <Button onClick={shareViaSMS} className="gap-2">
                <Phone className="w-4 h-4" />
                Send SMS
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Export Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={exportToExcel} className="gap-2">
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            <div>
              <p className="font-medium">Export to Excel</p>
              <p className="text-xs text-muted-foreground">Download as .xlsx file</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportToPDF} className="gap-2">
            <FileText className="w-4 h-4 text-red-600" />
            <div>
              <p className="font-medium">Export to PDF</p>
              <p className="text-xs text-muted-foreground">Download as .pdf file</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Share Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={openEmailDialog} className="gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            <div>
              <p className="font-medium">Email</p>
              <p className="text-xs text-muted-foreground">Send via email</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={shareViaWhatsApp} className="gap-2">
            <MessageCircle className="w-4 h-4 text-green-600" />
            <div>
              <p className="font-medium">WhatsApp</p>
              <p className="text-xs text-muted-foreground">Share on WhatsApp</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSmsDialogOpen(true)} className="gap-2">
            <Phone className="w-4 h-4 text-purple-600" />
            <div>
              <p className="font-medium">SMS</p>
              <p className="text-xs text-muted-foreground">Send via text message</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={shareViaGoogleChat} className="gap-2">
            <ExternalLink className="w-4 h-4 text-blue-500" />
            <div>
              <p className="font-medium">Google Chat</p>
              <p className="text-xs text-muted-foreground">Share on Google Chat</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copyToClipboard} className="gap-2">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            <div>
              <p className="font-medium">{copied ? 'Copied!' : 'Copy to Clipboard'}</p>
              <p className="text-xs text-muted-foreground">Copy report summary</p>
            </div>
          </DropdownMenuItem>
          {navigator.share && (
            <DropdownMenuItem onClick={nativeShare} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              <div>
                <p className="font-medium">More Options</p>
                <p className="text-xs text-muted-foreground">System share menu</p>
              </div>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Print Button */}
      <Button variant="outline" className="gap-2" onClick={handlePrint}>
        <Printer className="w-4 h-4" />
        Print
      </Button>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Share via Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="emailTo">To</Label>
              <Input
                id="emailTo"
                type="email"
                placeholder="recipient@email.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="emailSubject">Subject</Label>
              <Input
                id="emailSubject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="emailMessage">Message</Label>
              <Textarea
                id="emailMessage"
                rows={6}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button onClick={sendEmail} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Mail className="w-4 h-4" />
              Open Email Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMS Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-purple-600" />
              Share via SMS
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="smsTo">Phone Number (optional)</Label>
              <Input
                id="smsTo"
                type="tel"
                placeholder="+1234567890"
                value={smsTo}
                onChange={(e) => setSmsTo(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Leave empty to open your messaging app with the report summary ready to send.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsDialogOpen(false)}>Cancel</Button>
            <Button onClick={shareViaSMS} className="gap-2 bg-purple-600 hover:bg-purple-700">
              <Phone className="w-4 h-4" />
              Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
