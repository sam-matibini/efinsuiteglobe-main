/**
 * Centralized Print & PDF Service
 * Stateless service for PDF generation, printing, and document management
 */

import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import type {
  PrintJobConfig,
  PrintOptions,
  PrintAuditEntry,
  PrintDocumentArchive,
  PrintBranding,
  PrintMargins,
  WatermarkConfig,
  PaperSize,
  Orientation,
} from './types';
import { DEFAULT_MARGINS, PAPER_DIMENSIONS } from './types';

// Re-export types for convenience
export type { PrintJobConfig, PrintOptions, PrintBranding };

/**
 * Core Print Service class
 */
export class PrintService {
  private static instance: PrintService;
  
  private constructor() {}
  
  static getInstance(): PrintService {
    if (!PrintService.instance) {
      PrintService.instance = new PrintService();
    }
    return PrintService.instance;
  }
  
  /**
   * Create a new jsPDF document with configured settings
   */
  createDocument(
    paperSize: PaperSize = 'letter',
    orientation: Orientation = 'portrait',
    margins: PrintMargins = DEFAULT_MARGINS
  ): { doc: jsPDF; pageWidth: number; pageHeight: number; contentWidth: number } {
    const dimensions = PAPER_DIMENSIONS[paperSize];
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: [dimensions.width, dimensions.height],
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margins.left - margins.right;
    
    return { doc, pageWidth, pageHeight, contentWidth };
  }
  
  /**
   * Add organization header to document
   */
  addHeader(
    doc: jsPDF,
    branding: PrintBranding,
    yPosition: number,
    margins: PrintMargins
  ): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = yPosition;
    
    // Logo placeholder (would need async loading for actual logo)
    if (branding.logoUrl && branding.logoPosition === 'left') {
      // Logo goes here - requires async image loading
      y += 5;
    }
    
    // Organization name
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    
    const xPos = branding.logoPosition === 'center' 
      ? pageWidth / 2 
      : branding.logoPosition === 'right' 
        ? pageWidth - margins.right 
        : margins.left;
    const align = branding.logoPosition === 'center' ? 'center' : branding.logoPosition === 'right' ? 'right' : 'left';
    
    doc.text(branding.organizationName, xPos, y, { align });
    y += 6;
    
    // Address
    if (branding.showAddress && branding.address) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(branding.address, xPos, y, { align });
      y += 4;
      
      const cityLine = [branding.city, branding.province, branding.postalCode]
        .filter(Boolean)
        .join(', ');
      if (cityLine) {
        doc.text(cityLine, xPos, y, { align });
        y += 4;
      }
      
      if (branding.country) {
        doc.text(branding.country, xPos, y, { align });
        y += 4;
      }
    }
    
    // Contact info
    if (branding.showContact) {
      doc.setFontSize(8);
      const contactParts = [];
      if (branding.phone) contactParts.push(`Tel: ${branding.phone}`);
      if (branding.email) contactParts.push(branding.email);
      if (branding.showWebsite && branding.website) contactParts.push(branding.website);
      
      if (contactParts.length > 0) {
        doc.text(contactParts.join(' | '), xPos, y, { align });
        y += 5;
      }
    }
    
    // Divider line
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(margins.left, y, pageWidth - margins.right, y);
    y += 5;
    
    return y;
  }
  
  /**
   * Add document title section
   */
  addTitle(
    doc: jsPDF,
    title: string,
    subtitle?: string,
    yPosition: number = 20,
    _margins: PrintMargins = DEFAULT_MARGINS
  ): number {
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = yPosition;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(title, pageWidth / 2, y, { align: 'center' });
    y += 7;
    
    if (subtitle) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
      y += 5;
    }
    
    doc.setTextColor(0, 0, 0);
    return y + 5;
  }
  
  /**
   * Add watermark to all pages
   */
  addWatermark(doc: jsPDF, config: WatermarkConfig): void {
    if (config.type === 'none' || !config.text) return;
    
    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(60);
      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'bold');
      
      // Diagonal watermark
      doc.text(config.text.toUpperCase(), pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45,
      });
    }
    
    // Reset to normal
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
  }
  
  /**
   * Add page footer with branding
   */
  addFooter(
    doc: jsPDF,
    branding: PrintBranding,
    margins: PrintMargins,
    pageNumber: number,
    totalPages: number
  ): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const footerY = pageHeight - margins.bottom + 5;
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    
    // Footer text
    if (branding.footerText) {
      doc.text(branding.footerText, margins.left, footerY);
    }
    
    // Page numbers
    if (branding.showPageNumbers) {
      const pageText = branding.pageNumberFormat
        .replace('{page}', String(pageNumber))
        .replace('{pages}', String(totalPages));
      doc.text(pageText, pageWidth - margins.right, footerY, { align: 'right' });
    }
    
    doc.setTextColor(0, 0, 0);
  }
  
  /**
   * Add eFinsuite Globe branding footer
   */
  async addBrandingFooter(doc: jsPDF, bottomOffset: number = 30): Promise<void> {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = pageHeight - bottomOffset;
    
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Powered By:', pageWidth / 2, y, { align: 'center' });
    y += 4;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text('eFinsuite Globe', pageWidth / 2, y, { align: 'center' });
    y += 4;
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('For more information or clarification email: info@efintax.biz', pageWidth / 2, y, { align: 'center' });
    y += 4;
    
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-CA')}`, pageWidth / 2, y, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
  }
  
  /**
   * Add page break with automatic header/footer
   */
  addPageBreak(
    doc: jsPDF,
    branding: PrintBranding,
    margins: PrintMargins,
    currentPage: number,
    totalPages: number
  ): number {
    this.addFooter(doc, branding, margins, currentPage, totalPages);
    doc.addPage();
    return margins.top;
  }
  
  /**
   * Check if we need a page break
   */
  needsPageBreak(doc: jsPDF, currentY: number, margins: PrintMargins, minSpace: number = 40): boolean {
    const pageHeight = doc.internal.pageSize.getHeight();
    return currentY + minSpace > pageHeight - margins.bottom;
  }
  
  /**
   * Log print action to audit table
   */
  async logPrintAction(
    organizationId: string,
    entry: PrintAuditEntry
  ): Promise<void> {
    try {
      const { error } = await supabase.from('print_audit_log').insert([{
        organization_id: organizationId,
        action_type: entry.actionType,
        document_type: entry.documentType,
        document_title: entry.documentTitle,
        document_reference: entry.documentReference,
        source_record_id: entry.sourceRecordId,
        source_record_type: entry.sourceRecordType,
        template_id: entry.templateId,
        template_version: entry.templateVersion,
        output_type: entry.outputType,
        paper_size: entry.paperSize,
        orientation: entry.orientation,
        page_count: entry.pageCount,
        language: entry.language,
        currency: entry.currency,
        country_id: entry.countryId,
        metadata: (entry.metadata || {}) as any,
      }]);
      
      if (error) {
        console.error('Failed to log print action:', error);
      }
    } catch (err) {
      console.error('Error logging print action:', err);
    }
  }
  
  /**
   * Archive a generated document
   */
  async archiveDocument(
    archive: Omit<PrintDocumentArchive, 'id' | 'generatedAt'>
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.from('print_document_archive').insert([{
        organization_id: archive.organizationId,
        document_type: archive.documentType,
        document_title: archive.documentTitle,
        document_reference: archive.documentReference,
        source_record_id: archive.sourceRecordId,
        source_record_type: archive.sourceRecordType,
        reporting_period_start: archive.reportingPeriodStart,
        reporting_period_end: archive.reportingPeriodEnd,
        fiscal_year: archive.fiscalYear,
        country_id: archive.countryId,
        template_id: archive.templateId,
        template_version: archive.templateVersion,
        storage_path: archive.storagePath,
        file_size_bytes: archive.fileSizeBytes,
        checksum: archive.checksum,
        language: archive.language,
        currency: archive.currency,
        is_draft: archive.isDraft,
        is_confidential: archive.isConfidential,
        is_final: archive.isFinal,
        tags: archive.tags,
        metadata: archive.metadata as any,
        generated_by: archive.generatedBy,
        expires_at: archive.expiresAt,
      }]).select('id').single();
      
      if (error) {
        console.error('Failed to archive document:', error);
        return null;
      }
      
      return data?.id || null;
    } catch (err) {
      console.error('Error archiving document:', err);
      return null;
    }
  }
  
  /**
   * Download PDF
   */
  downloadPdf(doc: jsPDF, filename: string): void {
    doc.save(filename);
  }
  
  /**
   * Get PDF as blob
   */
  getPdfBlob(doc: jsPDF): Blob {
    return doc.output('blob');
  }
  
  /**
   * Get PDF as base64
   */
  getPdfBase64(doc: jsPDF): string {
    return doc.output('datauristring');
  }
  
  /**
   * Open print dialog using iframe for better compatibility
   */
  openPrintDialog(doc: jsPDF): void {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    
    // Create hidden iframe for reliable printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    
    // Store reference for cleanup
    let printAttempted = false;
    let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
    
    const cleanup = () => {
      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
      }
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
      URL.revokeObjectURL(url);
    };
    
    // Listen for after print event to cleanup
    const afterPrintHandler = () => {
      window.removeEventListener('afterprint', afterPrintHandler);
      // Delay cleanup to ensure print dialog has closed
      setTimeout(cleanup, 500);
    };
    
    window.addEventListener('afterprint', afterPrintHandler);
    
    iframe.onload = () => {
      if (printAttempted) return;
      printAttempted = true;
      
      try {
        // Small delay to ensure PDF is rendered in iframe
        setTimeout(() => {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.focus();
              iframe.contentWindow.print();
            } else {
              throw new Error('No content window');
            }
          } catch (innerError) {
            console.warn('Iframe print failed, opening in new window:', innerError);
            window.removeEventListener('afterprint', afterPrintHandler);
            // Open in new window as fallback - user can print from there
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
              printWindow.onload = () => {
                printWindow.focus();
                printWindow.print();
              };
            }
            cleanup();
          }
        }, 100);
      } catch (e) {
        console.error('Print dialog error:', e);
        window.removeEventListener('afterprint', afterPrintHandler);
        // Last resort: download the PDF
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.pdf';
        a.click();
        cleanup();
      }
    };
    
    iframe.onerror = () => {
      console.error('Iframe failed to load PDF');
      window.removeEventListener('afterprint', afterPrintHandler);
      // Fallback to download
      const a = document.createElement('a');
      a.href = url;
      a.download = 'document.pdf';
      a.click();
      cleanup();
    };
    
    // Set src and append to trigger load
    iframe.src = url;
    document.body.appendChild(iframe);
    
    // Safety cleanup - if nothing happens after 30 seconds, clean up
    cleanupTimer = setTimeout(() => {
      window.removeEventListener('afterprint', afterPrintHandler);
      cleanup();
    }, 30000);
  }
}

// Export singleton instance
export const printService = PrintService.getInstance();
