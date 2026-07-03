import { useState, useRef, useEffect, useCallback } from 'react';
import { Copy, Download, RefreshCw, Barcode, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import JsBarcode from 'jsbarcode';

type BarcodeFormat = 
  | 'CODE128' 
  | 'CODE39' 
  | 'EAN13' 
  | 'EAN8' 
  | 'UPC' 
  | 'ITF14' 
  | 'MSI' 
  | 'pharmacode';

interface BarcodeGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: string;
  onBarcodeGenerated?: (value: string, format: BarcodeFormat) => void;
}

const formatOptions: { value: BarcodeFormat; label: string; description: string }[] = [
  { value: 'CODE128', label: 'Code 128', description: 'High density, all ASCII' },
  { value: 'CODE39', label: 'Code 39', description: 'Alphanumeric, common' },
  { value: 'EAN13', label: 'EAN-13', description: 'Retail products (13 digits)' },
  { value: 'EAN8', label: 'EAN-8', description: 'Small products (8 digits)' },
  { value: 'UPC', label: 'UPC-A', description: 'US retail (12 digits)' },
  { value: 'ITF14', label: 'ITF-14', description: 'Shipping containers' },
];

export function BarcodeGenerator({
  open,
  onOpenChange,
  initialValue = '',
  onBarcodeGenerated,
}: BarcodeGeneratorProps) {
  const [value, setValue] = useState(initialValue);
  const [format, setFormat] = useState<BarcodeFormat>('CODE128');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate random barcode value based on format
  const generateRandomValue = useCallback(() => {
    let newValue = '';
    switch (format) {
      case 'EAN13':
        // 12 digits (13th is checksum, auto-calculated)
        newValue = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
        break;
      case 'EAN8':
        // 7 digits (8th is checksum)
        newValue = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('');
        break;
      case 'UPC':
        // 11 digits (12th is checksum)
        newValue = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('');
        break;
      case 'ITF14':
        // 13 digits (14th is checksum)
        newValue = Array.from({ length: 13 }, () => Math.floor(Math.random() * 10)).join('');
        break;
      default:
        // CODE128/CODE39 - alphanumeric
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        newValue = 'SKU-' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }
    setValue(newValue);
  }, [format]);

  // Render barcode when value or format changes
  useEffect(() => {
    if (!svgRef.current || !value) {
      setError(null);
      return;
    }

    try {
      JsBarcode(svgRef.current, value, {
        format,
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        margin: 10,
        background: '#ffffff',
        lineColor: '#000000',
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid barcode value for selected format');
    }
  }, [value, format]);

  // Initialize with random value on open
  useEffect(() => {
    if (open && !initialValue) {
      generateRandomValue();
    } else if (open && initialValue) {
      setValue(initialValue);
    }
  }, [open, initialValue, generateRandomValue]);

  const handleCopyValue = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Barcode value copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!svgRef.current) return;

    // Create canvas and draw SVG
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      // Download
      const link = document.createElement('a');
      link.download = `barcode-${value}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Barcode downloaded');
    };

    img.src = url;
  };

  const handleApply = () => {
    if (error) {
      toast.error('Please fix the barcode error first');
      return;
    }
    onBarcodeGenerated?.(value, format);
    onOpenChange(false);
    toast.success('Barcode applied to SKU');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="w-5 h-5" />
            Barcode Generator
          </DialogTitle>
          <DialogDescription>
            Generate a barcode for your inventory item SKU.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Barcode Format</Label>
            <Select 
              value={format} 
              onValueChange={(v) => {
                setFormat(v as BarcodeFormat);
                setValue(''); // Reset value on format change
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formatOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value Input */}
          <div className="space-y-2">
            <Label>Barcode Value</Label>
            <div className="flex gap-2">
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
                placeholder="Enter barcode value..."
                className="font-mono"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={generateRandomValue}
                title="Generate random"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyValue}
                disabled={!value}
                title="Copy value"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Barcode Preview */}
          <Card className="p-4 bg-white flex items-center justify-center min-h-32">
            {value && !error ? (
              <svg ref={svgRef} />
            ) : (
              <div className="text-muted-foreground text-sm">
                Enter a value to preview barcode
              </div>
            )}
          </Card>

          {/* Format hints */}
          <div className="text-xs text-muted-foreground">
            {format === 'EAN13' && 'EAN-13: Enter 12 digits (checksum auto-added)'}
            {format === 'EAN8' && 'EAN-8: Enter 7 digits (checksum auto-added)'}
            {format === 'UPC' && 'UPC-A: Enter 11 digits (checksum auto-added)'}
            {format === 'ITF14' && 'ITF-14: Enter 13 digits (checksum auto-added)'}
            {format === 'CODE128' && 'Code 128: Any ASCII characters supported'}
            {format === 'CODE39' && 'Code 39: A-Z, 0-9, and special characters (- . $ / + % space)'}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleDownload} disabled={!value || !!error}>
            <Download className="w-4 h-4 mr-2" />
            Download PNG
          </Button>
          {onBarcodeGenerated && (
            <Button onClick={handleApply} disabled={!value || !!error}>
              Apply to SKU
            </Button>
          )}
        </DialogFooter>

        {/* Hidden canvas for PNG export */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}