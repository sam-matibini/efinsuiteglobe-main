import { useState, useRef, useMemo } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { ColumnMappingBuilder, ColumnMapping, applyMappings } from './ColumnMappingBuilder';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ImportedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  payee_payor?: string;
  reference?: string;
}

interface TransactionImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (transactions: ImportedTransaction[]) => void;
}

const TARGET_FIELDS = [
  { id: 'date', label: 'Date', required: true, type: 'date' as const },
  { id: 'description', label: 'Description', required: true, type: 'string' as const },
  { id: 'amount', label: 'Amount', required: true, type: 'number' as const },
  { id: 'type', label: 'Type (deposit/withdrawal)', required: false, type: 'string' as const },
  { id: 'payee_payor', label: 'Payee/Payor', required: false, type: 'string' as const },
  { id: 'reference', label: 'Reference', required: false, type: 'string' as const },
];

export default function TransactionImportDialog({
  open,
  onOpenChange,
  onImport,
}: TransactionImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([
    { sourceColumn: '', targetField: 'date', transform: 'date' },
    { sourceColumn: '', targetField: 'description', transform: 'trim' },
    { sourceColumn: '', targetField: 'amount', transform: 'none' },
  ]);
  const [previewData, setPreviewData] = useState<ImportedTransaction[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const csvContent = `Date,Description,Amount,Type,Payee_Payor,Reference
2025-01-30,PAYMENT - CUSTOMER ABC,1500.00,deposit,ABC Corp,INV-001
2025-01-29,OFFICE SUPPLIES STORE,-250.00,withdrawal,Staples,PO-123
2025-01-28,WIRE TRANSFER - CLIENT XYZ,8500.00,deposit,XYZ Ltd,WIRE-456
2025-01-27,UTILITY BILL PAYMENT,-180.50,withdrawal,City Power,BILL-789`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'bank_transactions_template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Template downloaded successfully');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      toast.error('Please select a CSV or Excel file');
      return;
    }

    setSelectedFile(file);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

      if (jsonData.length === 0) {
        toast.error('No data found in file');
        return;
      }

      const columns = Object.keys(jsonData[0] || {});
      setAvailableColumns(columns);
      setRawData(jsonData);

      // Auto-detect common column names
      const autoMappings: ColumnMapping[] = [];
      
      const dateCol = columns.find(c => /date/i.test(c));
      if (dateCol) autoMappings.push({ sourceColumn: dateCol, targetField: 'date', transform: 'date' });
      
      const descCol = columns.find(c => /desc|memo|note|narration/i.test(c));
      if (descCol) autoMappings.push({ sourceColumn: descCol, targetField: 'description', transform: 'trim' });
      
      const amtCol = columns.find(c => /amount|value|sum|total|debit|credit/i.test(c));
      if (amtCol) autoMappings.push({ sourceColumn: amtCol, targetField: 'amount', transform: 'none' });
      
      const typeCol = columns.find(c => /type|direction|category/i.test(c));
      if (typeCol) autoMappings.push({ sourceColumn: typeCol, targetField: 'type', transform: 'lowercase' });
      
      const payeeCol = columns.find(c => /payee|vendor|merchant|party|customer/i.test(c));
      if (payeeCol) autoMappings.push({ sourceColumn: payeeCol, targetField: 'payee_payor', transform: 'trim' });
      
      const refCol = columns.find(c => /ref|check|cheque|invoice|number/i.test(c));
      if (refCol) autoMappings.push({ sourceColumn: refCol, targetField: 'reference', transform: 'trim' });

      if (autoMappings.length > 0) {
        setColumnMappings(autoMappings);
      }

      setStep('mapping');
    } catch (err) {
      toast.error('Failed to parse file');
      console.error('Parse error:', err);
    }
  };

  const processTransactions = () => {
    const parseErrors: string[] = [];
    const transactions: ImportedTransaction[] = [];

    rawData.forEach((row, index) => {
      const mapped = applyMappings(row, columnMappings);
      
      // Validate required fields
      if (!mapped.date) {
        parseErrors.push(`Row ${index + 2}: Missing date`);
        return;
      }
      if (!mapped.description) {
        parseErrors.push(`Row ${index + 2}: Missing description`);
        return;
      }

      // Parse amount
      let amount = 0;
      const rawAmount = mapped.amount;
      if (typeof rawAmount === 'number') {
        amount = rawAmount;
      } else if (typeof rawAmount === 'string') {
        amount = parseFloat(rawAmount.replace(/[$,]/g, '')) || 0;
      }

      if (amount === 0) {
        parseErrors.push(`Row ${index + 2}: Invalid amount`);
        return;
      }

      // Determine type
      let type: 'deposit' | 'withdrawal' = 'deposit';
      if (mapped.type) {
        const typeStr = String(mapped.type).toLowerCase();
        if (typeStr.includes('withdraw') || typeStr.includes('debit') || typeStr.includes('payment')) {
          type = 'withdrawal';
        }
      } else if (amount < 0) {
        type = 'withdrawal';
      }

      transactions.push({
        date: String(mapped.date),
        description: String(mapped.description),
        amount: Math.abs(amount) * (type === 'withdrawal' ? -1 : 1),
        type,
        payee_payor: mapped.payee_payor ? String(mapped.payee_payor) : undefined,
        reference: mapped.reference ? String(mapped.reference) : undefined,
      });
    });

    setErrors(parseErrors);
    setPreviewData(transactions);
    setStep('preview');
  };

  const handleImport = () => {
    onImport(previewData);
    setStep('complete');
  };

  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setRawData([]);
    setAvailableColumns([]);
    setPreviewData([]);
    setErrors([]);
    setColumnMappings([
      { sourceColumn: '', targetField: 'date', transform: 'date' },
      { sourceColumn: '', targetField: 'description', transform: 'trim' },
      { sourceColumn: '', targetField: 'amount', transform: 'none' },
    ]);
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
    }).format(Math.abs(value));
  };

  const hasRequiredMappings = columnMappings.some(m => m.targetField === 'date' && m.sourceColumn) &&
    columnMappings.some(m => m.targetField === 'description' && m.sourceColumn) &&
    columnMappings.some(m => m.targetField === 'amount' && m.sourceColumn);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Bank Transactions</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to import bank transactions
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            {/* Template Download */}
            <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Download Template</p>
                  <p className="text-sm text-muted-foreground">
                    Use our CSV template for easy importing
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>

            {/* File Upload */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-foreground font-medium mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-muted-foreground">
                CSV or Excel files (max 10MB)
              </p>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">{selectedFile?.name}</span>
                <span className="text-sm text-muted-foreground">({rawData.length} rows)</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep('upload');
                  setSelectedFile(null);
                  setRawData([]);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Detected Columns */}
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-xs font-medium mb-2">Detected Columns:</p>
              <div className="flex flex-wrap gap-1">
                {availableColumns.map(col => (
                  <span key={col} className="px-2 py-0.5 bg-background rounded text-xs border">
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Column Mapping Builder */}
            <ColumnMappingBuilder
              availableColumns={availableColumns}
              targetFields={TARGET_FIELDS}
              mappings={columnMappings}
              onMappingsChange={setColumnMappings}
            />

            {/* Preview of First Row */}
            {rawData.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start">
                    <Settings2 className="w-4 h-4 mr-2" />
                    Preview first row data
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="p-3 bg-muted/30 rounded-lg text-xs font-mono overflow-x-auto">
                    <pre>{JSON.stringify(rawData[0], null, 2)}</pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button 
                onClick={processTransactions}
                disabled={!hasRequiredMappings}
              >
                Continue to Preview
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">{selectedFile?.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('mapping')}
              >
                Edit Mappings
              </Button>
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">Import Warnings</span>
                </div>
                <ul className="text-sm text-destructive space-y-1">
                  {errors.slice(0, 5).map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                  {errors.length > 5 && (
                    <li>...and {errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Preview Table */}
            <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Date</th>
                    <th className="text-left p-2 font-medium">Description</th>
                    <th className="text-left p-2 font-medium">Payee/Payor</th>
                    <th className="text-left p-2 font-medium">Reference</th>
                    <th className="text-right p-2 font-medium">Amount</th>
                    <th className="text-left p-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 10).map((tx, idx) => (
                    <tr key={idx} className="border-t border-border">
                      <td className="p-2 text-muted-foreground">{tx.date}</td>
                      <td className="p-2 text-foreground">{tx.description}</td>
                      <td className="p-2 text-muted-foreground">{tx.payee_payor || '-'}</td>
                      <td className="p-2 text-muted-foreground text-xs font-mono">{tx.reference || '-'}</td>
                      <td className={`p-2 text-right font-mono ${tx.type === 'deposit' ? 'text-success' : 'text-foreground'}`}>
                        {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </td>
                      <td className="p-2 capitalize text-muted-foreground">{tx.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 10 && (
                <div className="p-2 text-center text-sm text-muted-foreground bg-muted/30">
                  ...and {previewData.length - 10} more transactions
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {previewData.length} transactions ready to import
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  Back
                </Button>
                <Button onClick={handleImport} disabled={previewData.length === 0}>
                  Import {previewData.length} Transactions
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 mx-auto text-success mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Import Complete!
            </h3>
            <p className="text-muted-foreground mb-6">
              Successfully imported {previewData.length} transactions
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
