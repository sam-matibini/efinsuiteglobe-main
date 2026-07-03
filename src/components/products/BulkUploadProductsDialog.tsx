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
import { useBulkCreateProductsServices } from '@/hooks/useProductsServices';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';

interface BulkUploadProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedItem {
  type: 'product' | 'service';
  name: string;
  sku: string;
  description: string;
  selling_price: number;
  cost_price: number | null;
  unit_of_measure: string;
  category: string;
  is_taxable: boolean;
  tax_rate: number | null;
  isValid: boolean;
  errors: string[];
}

const CSV_HEADERS = [
  'type',
  'name',
  'sku',
  'description',
  'selling_price',
  'cost_price',
  'unit_of_measure',
  'category',
  'is_taxable',
  'tax_rate',
];

const SAMPLE_DATA = [
  ['product', 'Widget Pro', 'WDG-001', 'Premium widget for professionals', '49.99', '25.00', 'Each', 'Hardware', 'true', '13'],
  ['product', 'Basic Widget', 'WDG-002', 'Entry-level widget', '19.99', '10.00', 'Each', 'Hardware', 'true', '13'],
  ['service', 'Consulting Hour', 'SVC-001', 'Professional consulting service', '150.00', '', 'Hour', 'Professional Services', 'true', '13'],
  ['service', 'Installation', 'SVC-002', 'On-site installation service', '75.00', '', 'Service', 'Installation', 'false', ''],
];

export function BulkUploadProductsDialog({ open, onOpenChange }: BulkUploadProductsDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { organization } = useCurrentOrganization();
  const bulkCreate = useBulkCreateProductsServices();

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
    link.download = 'products_services_upload_template.csv';
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

      const typeValue = getValue('type').toLowerCase();
      const type: 'product' | 'service' = typeValue === 'service' ? 'service' : 'product';
      const name = getValue('name');
      const sku = getValue('sku');
      const description = getValue('description');
      const selling_price = parseFloat(getValue('selling_price')) || 0;
      const cost_price_str = getValue('cost_price');
      const cost_price = cost_price_str ? parseFloat(cost_price_str) : null;
      const unit_of_measure = getValue('unit_of_measure') || 'Each';
      const category = getValue('category');
      const is_taxable = getValue('is_taxable').toLowerCase() === 'true';
      const tax_rate_str = getValue('tax_rate');
      const tax_rate = tax_rate_str ? parseFloat(tax_rate_str) : null;

      // Validation
      if (!name) errors.push('Name is required');
      if (selling_price < 0) errors.push('Selling price must be positive');
      if (cost_price !== null && cost_price < 0) errors.push('Cost price must be positive');
      if (!['product', 'service'].includes(type)) errors.push('Type must be product or service');

      return {
        type,
        name,
        sku,
        description,
        selling_price,
        cost_price,
        unit_of_measure,
        category,
        is_taxable,
        tax_rate,
        isValid: errors.length === 0,
        errors,
      };
    }).filter(item => item.name); // Filter out completely empty rows
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
    if (!organization?.id) return;
    
    const validItems = parsedItems.filter(item => item.isValid);
    if (validItems.length === 0) return;

    const itemsToInsert = validItems.map(({ isValid, errors, ...item }) => ({
      organization_id: organization.id,
      type: item.type,
      name: item.name,
      sku: item.sku || null,
      description: item.description || null,
      selling_price: item.selling_price,
      cost_price: item.cost_price,
      unit_of_measure: item.unit_of_measure || null,
      category: item.category || null,
      is_taxable: item.is_taxable,
      tax_rate: item.tax_rate,
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
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Upload Products & Services
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to add multiple products and services at once.
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
                Accepted format: CSV. Required columns: type, name, selling_price
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>CSV Format:</strong> type (product/service), name, sku, description, selling_price, cost_price, unit_of_measure, category, is_taxable, tax_rate
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
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Taxable</TableHead>
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
                      <TableCell>
                        <Badge variant={item.type === 'product' ? 'default' : 'secondary'}>
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-sm">{item.sku || '-'}</TableCell>
                      <TableCell>{item.category || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.selling_price)}</TableCell>
                      <TableCell className="text-right">
                        {item.cost_price !== null ? formatCurrency(item.cost_price) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.is_taxable ? 'default' : 'outline'}>
                          {item.is_taxable ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
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
