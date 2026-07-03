import jsPDF from 'jspdf';
import eFinSuiteGlobeLogo from '@/assets/efinsuite-globe-logo.png';

// Convert image to base64 for embedding in PDFs
let logoBase64: string | null = null;

const loadLogoAsBase64 = async (): Promise<string> => {
  if (logoBase64) return logoBase64;
  
  try {
    const response = await fetch(eFinSuiteGlobeLogo);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        logoBase64 = reader.result as string;
        resolve(logoBase64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Failed to load logo for PDF:', error);
    return '';
  }
};

interface BrandingFooterOptions {
  doc: jsPDF;
  includeTimestamp?: boolean;
  bottomOffset?: number;
}

/**
 * Adds eFinsuite Globe branding footer to a PDF document
 * Layout:
 *   Powered By:
 *   [Logo]
 *   eFinsuite Globe
 *   For more information or clarification email: info@efintax.biz
 */
export async function addPdfBrandingFooter(options: BrandingFooterOptions): Promise<void> {
  const { doc, includeTimestamp = true, bottomOffset = 30 } = options;
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = pageHeight - bottomOffset;
  
  // Load logo
  const logo = await loadLogoAsBase64();
  
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Powered By:', pageWidth / 2, y, { align: 'center' });
  y += 3;
  
  // Add logo
  if (logo) {
    try {
      const logoWidth = 12;
      const logoHeight = 12;
      const logoX = (pageWidth - logoWidth) / 2;
      doc.addImage(logo, 'PNG', logoX, y, logoWidth, logoHeight);
      y += logoHeight + 2;
    } catch (error) {
      console.error('Failed to add logo to PDF:', error);
      y += 2;
    }
  }
  
  // Brand name
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175); // Brand blue color
  doc.text('eFinsuite Globe', pageWidth / 2, y, { align: 'center' });
  y += 4;
  
  // Contact info
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('For more information or clarification email: info@efintax.biz', pageWidth / 2, y, { align: 'center' });
  
  // Timestamp
  if (includeTimestamp) {
    y += 4;
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-CA')}`, pageWidth / 2, y, { align: 'center' });
  }
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
}

/**
 * Synchronous version for cases where async isn't practical
 * Note: Logo won't be included unless preloaded
 */
export function addPdfBrandingFooterSync(options: BrandingFooterOptions): void {
  const { doc, includeTimestamp = true, bottomOffset = 30 } = options;
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = pageHeight - bottomOffset;
  
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('Powered By:', pageWidth / 2, y, { align: 'center' });
  y += 4;
  
  // Brand name (logo placeholder - sync version can't load image reliably)
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
  
  if (includeTimestamp) {
    y += 4;
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-CA')}`, pageWidth / 2, y, { align: 'center' });
  }
  
  doc.setTextColor(0, 0, 0);
}

// Preload logo for sync usage
export async function preloadBrandingLogo(): Promise<void> {
  await loadLogoAsBase64();
}
