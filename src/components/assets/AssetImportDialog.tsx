import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCreateFixedAsset } from '@/hooks/useFixedAssets';
import * as XLSX from 'xlsx';

interface AssetImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId?: string;
}

interface ImportRow {
  asset_number: string;
  name: string;
  description?: string;
  acquisition_date: string;
  acquisition_cost: number;
  useful_life_months: number;
  salvage_value: number;
  depreciation_method: string;
  serial_number?: string;
  location?: string;
  cca_class?: string;
  status: 'valid' | 'error' | 'warning';
  errors: string[];
}

const EXPECTED_COLUMNS = [
  'asset_number',
  'name',
  'description',
  'acquisition_date',
  'acquisition_cost',
  'useful_life_months',
  'salvage_value',
  'depreciation_method',
  'serial_number',
  'location',
  'cca_class',
];

const COLUMN_LABELS: Record<string, string> = {
  asset_number: 'Asset Number',
  name: 'Asset Name',
  description: 'Description',
  acquisition_date: 'Acquisition Date',
  acquisition_cost: 'Cost',
  useful_life_months: 'Useful Life (Months)',
  salvage_value: 'Salvage Value',
  depreciation_method: 'Depreciation Method',
  serial_number: 'Serial Number',
  location: 'Location',
  cca_class: 'CCA Class',
};

export function AssetImportDialog({ open, onOpenChange, organizationId }: AssetImportDialogProps) {
  const { toast } = useToast();
  const createAsset = useCreateFixedAsset(organizationId);
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<ImportRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length < 2) {
          toast({ title: 'File must have headers and at least one data row', variant: 'destructive' });
          return;
        }

        const fileHeaders = (jsonData[0] as string[]).map(h => String(h || '').trim().toLowerCase().replace(/\s+/g, '_'));
        const dataRows = jsonData.slice(1).filter((row: any) => row.length > 0);
        
        setHeaders(fileHeaders);
        setRawData(dataRows);

        // Auto-map columns
        const autoMapping: Record<string, string> = {};
        EXPECTED_COLUMNS.forEach(col => {
          const match = fileHeaders.find(h => 
            h === col || 
            h.includes(col) || 
            col.includes(h) ||
            (col === 'asset_number' && (h.includes('asset') && h.includes('num') || h === 'id')) ||
            (col === 'name' && h.includes('name')) ||
            (col === 'acquisition_date' && (h.includes('date') || h.includes('acquired'))) ||
            (col === 'acquisition_cost' && (h.includes('cost') || h.includes('amount') || h.includes('price')))
          );
          if (match) {
            autoMapping[col] = match;
          }
        });
        setColumnMapping(autoMapping);
        setStep('mapping');
      } catch (err) {
        toast({ title: 'Failed to parse file', description: 'Please upload a valid Excel or CSV file', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  }, [toast]);

  const validateAndParseData = () => {
    const rows: ImportRow[] = rawData.map((row, idx) => {
      const errors: string[] = [];
      
      const getValue = (col: string) => {
        const mappedHeader = columnMapping[col];
        if (!mappedHeader) return undefined;
        const colIndex = headers.indexOf(mappedHeader);
        return colIndex >= 0 ? row[colIndex] : undefined;
      };

      const assetNumber = String(getValue('asset_number') || '').trim();
      const name = String(getValue('name') || '').trim();
      const acquisitionDate = getValue('acquisition_date');
      const acquisitionCost = parseFloat(String(getValue('acquisition_cost') || 0));
      const usefulLifeMonths = parseInt(String(getValue('useful_life_months') || 60), 10);
      const salvageValue = parseFloat(String(getValue('salvage_value') || 0));
      const depMethod = String(getValue('depreciation_method') || 'straight_line').toLowerCase().replace(/\s+/g, '_');

      // Validation
      if (!assetNumber) errors.push('Asset number is required');
      if (!name) errors.push('Name is required');
      if (!acquisitionDate) errors.push('Acquisition date is required');
      if (isNaN(acquisitionCost) || acquisitionCost <= 0) errors.push('Invalid acquisition cost');
      if (isNaN(usefulLifeMonths) || usefulLifeMonths <= 0) errors.push('Invalid useful life');

      // Parse date
      let parsedDate = '';
      if (acquisitionDate) {
        if (acquisitionDate instanceof Date) {
          parsedDate = acquisitionDate.toISOString().split('T')[0];
        } else {
          const d = new Date(acquisitionDate);
          if (!isNaN(d.getTime())) {
            parsedDate = d.toISOString().split('T')[0];
          } else {
            errors.push('Invalid date format');
          }
        }
      }

      return {
        asset_number: assetNumber,
        name,
        description: String(getValue('description') || ''),
        acquisition_date: parsedDate,
        acquisition_cost: acquisitionCost,
        useful_life_months: usefulLifeMonths,
        salvage_value: salvageValue,
        depreciation_method: depMethod.includes('declin') ? 'declining_balance' : 'straight_line',
        serial_number: String(getValue('serial_number') || ''),
        location: String(getValue('location') || ''),
        cca_class: String(getValue('cca_class') || ''),
        status: errors.length > 0 ? 'error' : 'valid',
        errors,
      };
    });

    setParsedRows(rows);
    setStep('preview');
  };

  const startImport = async () => {
    const validRows = parsedRows.filter(r => r.status === 'valid');
    if (validRows.length === 0) {
      toast({ title: 'No valid rows to import', variant: 'destructive' });
      return;
    }

    setStep('importing');
    setImportProgress(0);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await createAsset.mutateAsync({
          asset_number: row.asset_number,
          name: row.name,
          description: row.description || null,
          acquisition_date: row.acquisition_date,
          acquisition_cost: row.acquisition_cost,
          useful_life_months: row.useful_life_months,
          salvage_value: row.salvage_value,
          depreciation_method: row.depreciation_method,
          depreciation_start_date: row.acquisition_date,
          serial_number: row.serial_number || null,
          location: row.location || null,
        });
        success++;
      } catch (err) {
        failed++;
      }
      setImportProgress(((i + 1) / validRows.length) * 100);
    }

    setImportResults({ success, failed });
    toast({ 
      title: 'Import Complete', 
      description: `${success} assets imported, ${failed} failed` 
    });
  };

  const resetDialog = () => {
    setStep('upload');
    setFile(null);
    setRawData([]);
    setHeaders([]);
    setColumnMapping({});
    setParsedRows([]);
    setImportProgress(0);
    setImportResults({ success: 0, failed: 0 });
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const validCount = parsedRows.filter(r => r.status === 'valid').length;
  const errorCount = parsedRows.filter(r => r.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Fixed Assets
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {step === 'upload' && (
            <div className="space-y-4">
              <Card className="border-dashed">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-8">
                    <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Upload Asset File</h3>
                    <p className="text-sm text-muted-foreground mb-4">Excel (.xlsx, .xls) or CSV files supported</p>
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      className="max-w-xs"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <h4 className="font-medium mb-2">Expected Columns</h4>
                  <div className="flex flex-wrap gap-2">
                    {EXPECTED_COLUMNS.map(col => (
                      <Badge key={col} variant="outline">
                        {COLUMN_LABELS[col]}
                        {['asset_number', 'name', 'acquisition_date', 'acquisition_cost'].includes(col) && ' *'}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">* Required fields</p>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Map your file columns to asset fields. File: <span className="font-medium">{file?.name}</span> ({rawData.length} rows)
              </p>

              <div className="grid grid-cols-2 gap-4">
                {EXPECTED_COLUMNS.filter(col => ['asset_number', 'name', 'acquisition_date', 'acquisition_cost', 'useful_life_months', 'salvage_value', 'depreciation_method'].includes(col)).map(col => (
                  <div key={col} className="space-y-1">
                    <Label className="text-sm">
                      {COLUMN_LABELS[col]}
                      {['asset_number', 'name', 'acquisition_date', 'acquisition_cost'].includes(col) && ' *'}
                    </Label>
                    <Select
                      value={columnMapping[col] || 'none'}
                      onValueChange={(v) => setColumnMapping({ ...columnMapping, [col]: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="none">-- Not Mapped --</SelectItem>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <Button onClick={validateAndParseData}>
                Validate & Preview
              </Button>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {validCount} Valid
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {errorCount} Errors
                  </Badge>
                )}
              </div>

              <div className="max-h-[400px] overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Status</TableHead>
                      <TableHead>Asset #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 100).map((row, idx) => (
                      <TableRow key={idx} className={row.status === 'error' ? 'bg-red-50/50' : ''}>
                        <TableCell>
                          {row.status === 'valid' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.asset_number || '-'}</TableCell>
                        <TableCell>{row.name || '-'}</TableCell>
                        <TableCell>{row.acquisition_date || '-'}</TableCell>
                        <TableCell className="text-right">{row.acquisition_cost?.toLocaleString() || '-'}</TableCell>
                        <TableCell className="text-xs text-red-600">{row.errors.join(', ')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedRows.length > 100 && (
                <p className="text-xs text-muted-foreground">Showing first 100 of {parsedRows.length} rows</p>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-4 py-8">
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">Importing Assets...</h3>
                <p className="text-sm text-muted-foreground mb-4">Please wait while assets are being created</p>
              </div>
              <Progress value={importProgress} className="h-2" />
              <p className="text-center text-sm">{Math.round(importProgress)}% complete</p>
              
              {importProgress === 100 && (
                <Card className="mt-4">
                  <CardContent className="pt-4 text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="font-medium">{importResults.success} assets imported successfully</p>
                    {importResults.failed > 0 && (
                      <p className="text-sm text-red-600">{importResults.failed} failed</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {step === 'importing' && importProgress === 100 ? 'Close' : 'Cancel'}
          </Button>
          {step === 'preview' && validCount > 0 && (
            <Button onClick={startImport}>
              Import {validCount} Assets
            </Button>
          )}
          {step === 'mapping' && (
            <Button variant="ghost" onClick={() => setStep('upload')}>
              Back
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
