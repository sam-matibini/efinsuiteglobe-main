import { useState, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useBulkCreateInventoryItems } from '@/hooks/useInventory';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';

interface BulkUploadInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedItem {
  sku: string;
  name: string;
  description: string;
  unit_of_measure: string;
  cost_price: number;
  selling_price: number;
  quantity_on_hand: number;
  reorder_point: number | null;
  is_taxable: boolean;
  barcode: string;
  barcode_type: string;
  isValid: boolean;
  errors: string[];
}

const CSV_HEADERS = [
  'sku',
  'name',
  'description',
  'unit_of_measure',
  'cost_price',
  'selling_price',
  'quantity_on_hand',
  'reorder_point',
  'is_taxable',
  'barcode',
  'barcode_type',
];

const SAMPLE_DATA = [
  ['SKU-001', 'Widget A', 'Standard widget', 'Each', '10.00', '25.00', '100', '10', 'true', '1234567890123', 'EAN13'],
  ['SKU-002', 'Widget B', 'Premium widget', 'Each', '15.00', '35.00', '50', '5', 'true', '9876543210987', 'EAN13'],
  ['SKU-003', 'Gadget X', 'Electronic gadget', 'Unit', '25.00', '55.00', '25', '3', 'false', 'ABC-12345', 'CODE128'],
];

export function BulkUploadInventoryDialog({ open, onOpenChange }: BulkUploadInventoryDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { organization } = useCurrentOrganization();
  const bulkCreate = useBulkCreateInventoryItems(organization?.id);

  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };

  const downloadTemplate = () => {
    const csvContent = [
      CSV_HEADERS.join(','),
      ...SAMPLE_DATA.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'inventory_upload_template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const parseCSV = (text: string): ParsedItem[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const dataLines = lines.slice(1);

    return dataLines.map((line) => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const errors: string[] = [];

      const getValue = (header: string): string => {
        const idx = headers.indexOf(header);
        return idx >= 0 ? values[idx] || '' : '';
      };

      const sku = getValue('sku');
      const name = getValue('name');
      const description = getValue('description');
      const unit_of_measure = getValue('unit_of_measure') || 'Each';
      const cost_price = parseFloat(getValue('cost_price')) || 0;
      const selling_price = parseFloat(getValue('selling_price')) || 0;
      const quantity_on_hand = parseInt(getValue('quantity_on_hand')) || 0;
      const reorder_point_str = getValue('reorder_point');
      const reorder_point = reorder_point_str ? parseInt(reorder_point_str) : null;
      const is_taxable = getValue('is_taxable').toLowerCase() === 'true';
      const barcode = getValue('barcode');
      const barcode_type = getValue('barcode_type') || 'CODE128';

      // Validation
      if (!sku) errors.push('SKU is required');
      if (!name) errors.push('Name is required');
      if (cost_price < 0) errors.push('Cost price must be positive');
      if (selling_price < 0) errors.push('Selling price must be positive');
      if (quantity_on_hand < 0) errors.push('Quantity must be positive');

      return {
        sku,
        name,
        description,
        unit_of_measure,
        cost_price,
        selling_price,
        quantity_on_hand,
        reorder_point,
        is_taxable,
        barcode,
        barcode_type,
        isValid: errors.length === 0,
        errors,
      };
    }).filter(item => item.sku || item.name); // Filter out completely empty rows
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const items = parseCSV(text);
      setParsedItems(items);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    const validItems = parsedItems.filter(item => item.isValid);
    if (validItems.length === 0) return;

    const itemsToInsert = validItems.map(({ isValid, errors, barcode, barcode_type, ...item }) => ({
      ...item,
      barcode: barcode || null,
      barcode_type: barcode_type || null,
      is_active: true,
      tax_rate: null,
      reorder_quantity: null,
      category_id: null,
      inventory_account_id: null,
      cogs_account_id: null,
      income_account_id: null,
    }));

    try {
      await bulkCreate.mutateAsync(itemsToInsert);
      handleClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    setStep('upload');
    setParsedItems([]);
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const validCount = parsedItems.filter(i => i.isValid).length;
  const invalidCount = parsedItems.filter(i => !i.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Upload Inventory
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to add multiple inventory items at once.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-10 w-10 text-primary" />
                <div>
                  <h4 className="font-medium">Download Template</h4>
                  <p className="text-sm text-muted-foreground">
                    Get the CSV template with sample data
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Upload CSV File</Label>
              <Input
                id="file"
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Accepted format: CSV. Required columns: sku, name
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>CSV Format:</strong> sku, name, description, unit_of_measure, cost_price, selling_price, quantity_on_hand, reorder_point, is_taxable, barcode, barcode_type
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                File: <span className="font-medium text-foreground">{fileName}</span>
              </p>
              <div className="flex gap-2">
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {validCount} valid
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {invalidCount} errors
                  </Badge>
                )}
              </div>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Status</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedItems.map((item, index) => (
                    <TableRow key={index} className={!item.isValid ? 'bg-destructive/10' : ''}>
                      <TableCell>
                        {item.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.unit_of_measure}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.cost_price)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.selling_price)}</TableCell>
                      <TableCell className="text-right">{item.quantity_on_hand}</TableCell>
                      <TableCell className="font-mono text-xs">{item.barcode || '-'}</TableCell>
                      <TableCell>
                        {item.errors.length > 0 && (
                          <span className="text-xs text-destructive">{item.errors.join(', ')}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <Button
              variant="outline"
              onClick={() => {
                setStep('upload');
                setParsedItems([]);
                setFileName('');
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              Choose Different File
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {step === 'preview' && (
            <Button
              onClick={handleUpload}
              disabled={validCount === 0 || bulkCreate.isPending}
            >
              {bulkCreate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload {validCount} Items
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
