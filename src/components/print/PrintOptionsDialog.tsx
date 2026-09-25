/**
 * Print Options Dialog
 * Unified dialog for configuring print/PDF export options
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Printer, Download, FileText, Eye, Loader2 } from 'lucide-react';
import type {
  PrintOptions,
  PaperSize,
  Orientation,
  WatermarkType,
  PrintOutputType,
  PrintDocumentType,
  PrintBranding,
} from '@/lib/print/types';
import { DEFAULT_PRINT_OPTIONS, DOCUMENT_TYPE_LABELS } from '@/lib/print/types';

interface PrintOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: PrintDocumentType;
  documentTitle: string;
  branding?: PrintBranding | null;
  defaultOptions?: Partial<PrintOptions>;
  onPrint: (options: PrintOptions) => Promise<void>;
  isLoading?: boolean;
}

const PAPER_SIZE_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: 'letter', label: 'Letter (8.5" × 11")' },
  { value: 'a4', label: 'A4 (210 × 297 mm)' },
  { value: 'legal', label: 'Legal (8.5" × 14")' },
  { value: 'a3', label: 'A3 (297 × 420 mm)' },
];

const ORIENTATION_OPTIONS: { value: Orientation; label: string }[] = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
];

const WATERMARK_OPTIONS: { value: WatermarkType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'draft', label: 'DRAFT' },
  { value: 'confidential', label: 'CONFIDENTIAL' },
  { value: 'final', label: 'FINAL' },
];

const OUTPUT_OPTIONS: { value: PrintOutputType; label: string; icon: React.ReactNode }[] = [
  { value: 'pdf_download', label: 'Download PDF', icon: <Download className="h-4 w-4" /> },
  { value: 'browser_print', label: 'Print', icon: <Printer className="h-4 w-4" /> },
  { value: 'preview', label: 'Preview', icon: <Eye className="h-4 w-4" /> },
];

export function PrintOptionsDialog({
  open,
  onOpenChange,
  documentType,
  documentTitle,
  branding,
  defaultOptions,
  onPrint,
  isLoading = false,
}: PrintOptionsDialogProps) {
  const [options, setOptions] = useState<PrintOptions>({
    ...DEFAULT_PRINT_OPTIONS,
    ...defaultOptions,
  });
  const [isPrinting, setIsPrinting] = useState(false);

  // Reset options when dialog opens
  useEffect(() => {
    if (open) {
      setOptions({
        ...DEFAULT_PRINT_OPTIONS,
        ...defaultOptions,
      });
    }
  }, [open, defaultOptions]);

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await onPrint(options);
      onOpenChange(false);
    } catch (error) {
      console.error('Print failed:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  const updateOption = <K extends keyof PrintOptions>(key: K, value: PrintOptions[K]) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  const documentLabel = DOCUMENT_TYPE_LABELS[documentType] || 'Document';
  const loading = isLoading || isPrinting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Print Options
          </DialogTitle>
          <DialogDescription>
            Configure options for {documentLabel}: <strong>{documentTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Organization Branding Preview */}
          {branding && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-medium text-foreground">{branding.organizationName}</p>
              {branding.address && (
                <p className="text-xs text-muted-foreground mt-1">{branding.address}</p>
              )}
            </div>
          )}

          {/* Paper Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Paper Settings</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paper-size">Paper Size</Label>
                <Select
                  value={options.paperSize}
                  onValueChange={(v) => updateOption('paperSize', v as PaperSize)}
                >
                  <SelectTrigger id="paper-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_SIZE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orientation">Orientation</Label>
                <Select
                  value={options.orientation}
                  onValueChange={(v) => updateOption('orientation', v as Orientation)}
                >
                  <SelectTrigger id="orientation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIENTATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Watermark */}
          <div className="space-y-2">
            <Label htmlFor="watermark">Watermark</Label>
            <Select
              value={options.watermark}
              onValueChange={(v) => updateOption('watermark', v as WatermarkType)}
            >
              <SelectTrigger id="watermark">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WATERMARK_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Options */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Options</h4>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="include-notes" className="flex-1 cursor-pointer">
                Include Notes
              </Label>
              <Switch
                id="include-notes"
                checked={options.includeNotes}
                onCheckedChange={(v) => updateOption('includeNotes', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="include-attachments" className="flex-1 cursor-pointer">
                Include Attachments
              </Label>
              <Switch
                id="include-attachments"
                checked={options.includeAttachments}
                onCheckedChange={(v) => updateOption('includeAttachments', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-draft" className="flex-1 cursor-pointer">
                Mark as Draft
              </Label>
              <Switch
                id="is-draft"
                checked={options.isDraft}
                onCheckedChange={(v) => updateOption('isDraft', v)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            {OUTPUT_OPTIONS.map(output => (
              <Button
                key={output.value}
                variant={options.outputType === output.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateOption('outputType', output.value)}
                disabled={loading}
                className="flex-1 sm:flex-none"
              >
                {output.icon}
                <span className="ml-1.5 hidden sm:inline">{output.label}</span>
              </Button>
            ))}
          </div>
          <Button 
            onClick={handlePrint} 
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {options.outputType === 'browser_print' ? (
                  <Printer className="mr-2 h-4 w-4" />
                ) : options.outputType === 'preview' ? (
                  <Eye className="mr-2 h-4 w-4" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {options.outputType === 'browser_print' ? 'Print' : 
                 options.outputType === 'preview' ? 'Preview' : 'Download'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
