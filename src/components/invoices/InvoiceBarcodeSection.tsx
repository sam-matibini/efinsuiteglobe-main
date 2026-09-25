import { useEffect, useRef, useState } from 'react';
import { Barcode, Download, Copy, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import JsBarcode from 'jsbarcode';

interface InvoiceBarcodeSectionProps {
  invoiceNumber: string;
}

type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'UPC' | 'ITF';

export function InvoiceBarcodeSection({ invoiceNumber }: InvoiceBarcodeSectionProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>('CODE128');
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  // Generate barcode
  useEffect(() => {
    if (barcodeRef.current && invoiceNumber) {
      try {
        setBarcodeError(null);
        JsBarcode(barcodeRef.current, invoiceNumber, {
          format: barcodeFormat,
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch {
        setBarcodeError(`Invalid format for "${invoiceNumber}". Try CODE128.`);
        // Fallback to CODE128
        if (barcodeFormat !== 'CODE128') {
          try {
            JsBarcode(barcodeRef.current, invoiceNumber, {
              format: 'CODE128',
              width: 2,
              height: 60,
              displayValue: true,
              fontSize: 14,
              margin: 10,
              background: '#ffffff',
              lineColor: '#000000',
            });
          } catch {
            // Ignore fallback errors
          }
        }
      }
    }
  }, [invoiceNumber, barcodeFormat]);

  // Generate simple QR-like pattern (basic implementation)
  useEffect(() => {
    if (qrRef.current && invoiceNumber) {
      const canvas = qrRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Simple QR-like visualization (for demo - in production use a QR library)
      const size = 150;
      canvas.width = size;
      canvas.height = size;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      // Create a simple pattern based on invoice number
      ctx.fillStyle = '#000000';
      const cellSize = 5;
      const data = invoiceNumber.split('').map(c => c.charCodeAt(0));
      
      // Draw finder patterns (corners)
      const drawFinder = (x: number, y: number) => {
        ctx.fillRect(x, y, 35, 35);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 5, y + 5, 25, 25);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 10, y + 10, 15, 15);
      };

      drawFinder(5, 5);
      drawFinder(size - 40, 5);
      drawFinder(5, size - 40);

      // Draw data pattern
      let idx = 0;
      for (let row = 0; row < 20; row++) {
        for (let col = 0; col < 20; col++) {
          if (row < 8 && col < 8) continue; // Skip top-left finder
          if (row < 8 && col > 11) continue; // Skip top-right finder
          if (row > 11 && col < 8) continue; // Skip bottom-left finder
          
          const x = 50 + col * cellSize;
          const y = 50 + row * cellSize;
          
          if (data[idx % data.length] % 2 === (row + col) % 2) {
            ctx.fillRect(x, y, cellSize - 1, cellSize - 1);
          }
          idx++;
        }
      }
    }
  }, [invoiceNumber]);

  const downloadBarcode = (type: 'barcode' | 'qr') => {
    const element = type === 'barcode' ? barcodeRef.current : qrRef.current;
    if (!element) return;

    let dataUrl: string;
    
    if (type === 'barcode' && element instanceof SVGSVGElement) {
      const svgData = new XMLSerializer().serializeToString(element);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      dataUrl = URL.createObjectURL(svgBlob);
      
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `barcode-${invoiceNumber}.svg`;
      link.click();
      URL.revokeObjectURL(dataUrl);
    } else if (type === 'qr' && element instanceof HTMLCanvasElement) {
      dataUrl = element.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `qr-${invoiceNumber}.png`;
      link.click();
    }

    toast.success(`${type === 'barcode' ? 'Barcode' : 'QR Code'} downloaded`);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(invoiceNumber);
      toast.success('Invoice number copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Card className="p-4">
      <Label className="text-base font-semibold mb-3 flex items-center gap-2">
        <Barcode className="w-5 h-5" />
        Barcode & QR Code
      </Label>

      <Tabs defaultValue="barcode" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="barcode">
            <Barcode className="w-4 h-4 mr-1" />
            Barcode
          </TabsTrigger>
          <TabsTrigger value="qr">
            <QrCode className="w-4 h-4 mr-1" />
            QR Code
          </TabsTrigger>
        </TabsList>

        <TabsContent value="barcode" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm">Format:</Label>
            <Select value={barcodeFormat} onValueChange={(v) => setBarcodeFormat(v as BarcodeFormat)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CODE128">CODE128 (Default)</SelectItem>
                <SelectItem value="CODE39">CODE39</SelectItem>
                <SelectItem value="ITF">ITF-14</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {barcodeError && (
            <p className="text-sm text-warning">{barcodeError}</p>
          )}

          <div className="border rounded-lg p-4 bg-white flex justify-center">
            <svg ref={barcodeRef} />
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => downloadBarcode('barcode')}>
              <Download className="w-4 h-4 mr-1" />
              Download SVG
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="w-4 h-4 mr-1" />
              Copy Number
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="qr" className="space-y-4 mt-4">
          <div className="border rounded-lg p-4 bg-white flex justify-center">
            <canvas ref={qrRef} className="max-w-full" />
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => downloadBarcode('qr')}>
              <Download className="w-4 h-4 mr-1" />
              Download PNG
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="w-4 h-4 mr-1" />
              Copy Number
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Note: For production use, consider using a proper QR code library like qrcode.js
          </p>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
