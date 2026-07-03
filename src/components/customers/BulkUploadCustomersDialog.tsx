import { useState, useRef } from 'react';
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
import { useBulkCreateCustomers } from '@/hooks/useCustomers';
import { useCurrentOrganization } from '@/hooks/useOrganization';

interface BulkUploadCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedCustomer {
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  tax_number: string;
  payment_terms: number | null;
  credit_limit: number | null;
  notes: string;
  isValid: boolean;
  errors: string[];
}

const CSV_HEADERS = [
  'name',
  'email',
  'phone',
  'address_line1',
  'address_line2',
  'city',
  'province',
  'postal_code',
  'country',
  'tax_number',
  'payment_terms',
  'credit_limit',
  'notes',
];

const SAMPLE_DATA = [
  ['Acme Corporation', 'billing@acme.com', '+1-555-100-2000', '123 Business Ave', 'Suite 400', 'Toronto', 'ON', 'M5V 3A1', 'CA', '123456789', '30', '50000', 'Key enterprise client'],
  ['Jane Smith', 'jane.smith@email.com', '+1-555-200-3000', '456 Elm Street', '', 'Vancouver', 'BC', 'V6B 1A1', 'CA', '', '15', '10000', 'Individual customer'],
  ['Global Supplies Ltd', 'accounts@globalsupplies.com', '+44-20-7946-0958', '10 Downing Rd', 'Floor 2', 'London', '', 'SW1A 2AA', 'GB', 'GB123456789', '45', '100000', 'International supplier'],
  ['Maria Garcia', 'maria@example.com', '+1-555-300-4000', '789 Oak Lane', '', 'Montreal', 'QC', 'H2X 1Y4', 'CA', '', '30', '5000', ''],
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BulkUploadCustomersDialog({ open, onOpenChange }: BulkUploadCustomersDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [parsedItems, setParsedItems] = useState<ParsedCustomer[]>([]);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { organization } = useCurrentOrganization();
  const bulkCreate = useBulkCreateCustomers();

  const defaultCountry = organization?.country || 'CA';

  const downloadTemplate = () => {
    const csvContent = [
      CSV_HEADERS.join(','),
      ...SAMPLE_DATA.map(row => row.map(v => v.includes(',') ? `"${v}"` : v).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'customers_upload_template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const parseCSV = (text: string): ParsedCustomer[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const dataLines = lines.slice(1);

    return dataLines.map((line) => {
      // Handle quoted values with commas
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const errors: string[] = [];

      const getValue = (header: string): string => {
        const idx = headers.indexOf(header);
        return idx >= 0 ? values[idx] || '' : '';
      };

      const name = getValue('name');
      const email = getValue('email');
      const phone = getValue('phone');
      const address_line1 = getValue('address_line1');
      const address_line2 = getValue('address_line2');
      const city = getValue('city');
      const province = getValue('province');
      const postal_code = getValue('postal_code');
      const country = getValue('country') || defaultCountry;
      const tax_number = getValue('tax_number');
      const paymentTermsStr = getValue('payment_terms');
      const creditLimitStr = getValue('credit_limit');
      const notes = getValue('notes');

      const payment_terms = paymentTermsStr ? parseFloat(paymentTermsStr) : null;
      const credit_limit = creditLimitStr ? parseFloat(creditLimitStr) : null;

      // Validation
      if (!name) errors.push('Name is required');
      if (email && !EMAIL_REGEX.test(email)) errors.push('Invalid email format');
      if (paymentTermsStr && (isNaN(Number(paymentTermsStr)) || Number(paymentTermsStr) < 0)) errors.push('Invalid payment terms');
      if (creditLimitStr && (isNaN(Number(creditLimitStr)) || Number(creditLimitStr) < 0)) errors.push('Invalid credit limit');

      return {
        name,
        email,
        phone,
        address_line1,
        address_line2,
        city,
        province,
        postal_code,
        country,
        tax_number,
        payment_terms,
        credit_limit,
        notes,
        isValid: errors.length === 0,
        errors,
      };
    }).filter(item => item.name);
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

    const itemsToInsert = validItems.map(({ isValid: _v, errors: _e, ...item }) => ({
      organization_id: organization.id,
      name: item.name,
      email: item.email || null,
      phone: item.phone || null,
      address_line1: item.address_line1 || null,
      address_line2: item.address_line2 || null,
      city: item.city || null,
      province: item.province || null,
      postal_code: item.postal_code || null,
      country: item.country || defaultCountry,
      tax_number: item.tax_number || null,
      payment_terms: item.payment_terms ?? 30,
      credit_limit: item.credit_limit ?? 0,
      notes: item.notes || null,
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
            Bulk Import Customers
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to add multiple customers at once.
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
              <Label htmlFor="customer-file">Upload CSV File</Label>
              <Input
                id="customer-file"
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Accepted format: CSV. Required column: name
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>CSV Columns:</strong> name, email, phone, address_line1, address_line2, city, province, postal_code, country, tax_number, payment_terms, credit_limit, notes
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
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Terms</TableHead>
                    <TableHead className="text-right">Credit Limit</TableHead>
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
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.email || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{item.phone || '-'}</TableCell>
                      <TableCell>{item.city || '-'}</TableCell>
                      <TableCell>{item.country}</TableCell>
                      <TableCell className="text-right">{item.payment_terms ?? '-'}</TableCell>
                      <TableCell className="text-right">{item.credit_limit ?? '-'}</TableCell>
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
              Import {validCount} Customers
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
