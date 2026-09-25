/**
 * Print Options Dialog Hook
 * Manages print options state and actions
 */

import { useState, useCallback } from 'react';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { printService, loadBrandingProfile, getPrintLocalization } from '@/lib/print';
import type { PrintOptions, PrintDocumentType, PrintBranding, PrintLocalization } from '@/lib/print';
import { DEFAULT_PRINT_OPTIONS } from '@/lib/print';

export interface UsePrintOptionsReturn {
  options: PrintOptions;
  setOptions: React.Dispatch<React.SetStateAction<PrintOptions>>;
  branding: PrintBranding | null;
  localization: PrintLocalization | null;
  isLoading: boolean;
  loadBranding: () => Promise<void>;
  generatePdf: (documentType: PrintDocumentType, title: string, generateContent: (service: typeof printService) => Promise<jsPDF>) => Promise<void>;
}

import jsPDF from 'jspdf';

export function usePrintOptions(): UsePrintOptionsReturn {
  const { organization } = useCurrentOrganization();
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS);
  const [branding, setBranding] = useState<PrintBranding | null>(null);
  const [localization, setLocalization] = useState<PrintLocalization | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadBranding = useCallback(async () => {
    if (!organization?.id) return;
    
    setIsLoading(true);
    try {
      const brand = await loadBrandingProfile(organization.id);
      setBranding(brand);
      
      const loc = getPrintLocalization(organization.country || 'CA', 'en', organization.currency || 'CAD');
      setLocalization(loc);
      
      // Update options with localized defaults
      setOptions(prev => ({
        ...prev,
        paperSize: loc.paperSize,
        currency: loc.currency,
        language: loc.language,
      }));
    } catch (err) {
      console.error('Failed to load branding:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id, organization?.country, organization?.currency]);

  const generatePdf = useCallback(async (
    documentType: PrintDocumentType,
    title: string,
    generateContent: (service: typeof printService) => Promise<jsPDF>
  ) => {
    if (!organization?.id) return;
    
    try {
      const doc = await generateContent(printService);
      
      // Log the action
      await printService.logPrintAction(organization.id, {
        actionType: options.outputType === 'browser_print' ? 'print' : 'pdf_download',
        documentType,
        documentTitle: title,
        outputType: options.outputType,
        paperSize: options.paperSize,
        orientation: options.orientation,
        language: options.language,
        currency: options.currency,
        pageCount: doc.getNumberOfPages(),
      });
      
      // Handle output
      if (options.outputType === 'browser_print') {
        printService.openPrintDialog(doc);
      } else {
        printService.downloadPdf(doc, `${title.replace(/\s+/g, '-')}.pdf`);
      }
    } catch (err) {
      console.error('PDF generation failed:', err);
      throw err;
    }
  }, [organization?.id, options]);

  return {
    options,
    setOptions,
    branding,
    localization,
    isLoading,
    loadBranding,
    generatePdf,
  };
}
