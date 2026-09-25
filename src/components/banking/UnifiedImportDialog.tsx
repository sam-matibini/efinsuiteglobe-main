import { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X, FileText } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { classifyCreditCardType } from '@/lib/creditCardImportNormalizer';
import { EditableImportPreview } from './EditableImportPreview';


export type ImportAccountType = 'bank' | 'credit-card';

export interface ParsedBankTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  payee_payor?: string;
  reference?: string;
}

export interface ParsedCreditCardTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'charge' | 'payment' | 'credit' | 'fee' | 'interest';
  payee_payor?: string;
  reference?: string;
}

interface UnifiedImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountType: ImportAccountType;
  accountName: string;
  onImportBank?: (transactions: ParsedBankTransaction[]) => Promise<void> | void;
  onImportCreditCard?: (transactions: ParsedCreditCardTransaction[]) => Promise<void> | void;
  isImporting?: boolean;
}

export function UnifiedImportDialog({
  open,
  onOpenChange,
  accountType,
  accountName,
  onImportBank,
  onImportCreditCard,
  isImporting = false,
}: UnifiedImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dateFormat, setDateFormat] = useState('yyyy-mm-dd');
  const [previewData, setPreviewData] = useState<(ParsedBankTransaction | ParsedCreditCardTransaction)[]>([]);
  const [baselineData, setBaselineData] = useState<(ParsedBankTransaction | ParsedCreditCardTransaction)[]>([]);

  const [errors, setErrors] = useState<string[]>([]);
  
  // Column mapping state
  const [dateColumn, setDateColumn] = useState('Date');
  const [descriptionColumn, setDescriptionColumn] = useState('Description');
  const [amountColumn, setAmountColumn] = useState('Amount');
  const [amountMode, setAmountMode] = useState<'single' | 'split'>('single');
  const [debitColumn, setDebitColumn] = useState('Cheques & Debits');
  const [creditColumn, setCreditColumn] = useState('Deposits & Credits');

  const isCreditCard = accountType === 'credit-card';
  const title = isCreditCard ? 'Import Credit Card Statement' : 'Import Bank Transactions';
  const templateFileName = isCreditCard ? 'credit_card_template.csv' : 'bank_transactions_template.csv';

  const handleDownloadTemplate = () => {
    let csvContent: string;
    
    if (isCreditCard) {
      csvContent = `Date,Description,Amount,Type,Payee_Payor,Reference
2025-01-30,AMAZON.COM*ABC123,125.99,charge,Amazon,ORD-123456
2025-01-29,PAYMENT RECEIVED - THANK YOU,-500.00,payment,Bank Transfer,PMT-789
2025-01-28,SHELL OIL STATION,45.50,charge,Shell,
2025-01-27,REFUND - RETURN,-35.00,credit,Target,RET-456
2025-01-26,ANNUAL FEE,120.00,fee,Card Issuer,`;
    } else if (amountMode === 'split') {
      csvContent = `Date,Description,Cheques & Debits,Deposits & Credits,Payee_Payor,Reference
2025-01-30,PAYMENT - CUSTOMER ABC,,1500.00,ABC Corp,INV-001
2025-01-29,OFFICE SUPPLIES STORE,250.00,,Staples,PO-123
2025-01-28,WIRE TRANSFER - CLIENT XYZ,,8500.00,XYZ Ltd,WIRE-456
2025-01-27,UTILITY BILL PAYMENT,180.50,,City Power,BILL-789`;
    } else {
      csvContent = `Date,Description,Amount,Type,Payee_Payor,Reference
2025-01-30,PAYMENT - CUSTOMER ABC,1500.00,deposit,ABC Corp,INV-001
2025-01-29,OFFICE SUPPLIES STORE,-250.00,withdrawal,Staples,PO-123
2025-01-28,WIRE TRANSFER - CLIENT XYZ,8500.00,deposit,XYZ Ltd,WIRE-456
2025-01-27,UTILITY BILL PAYMENT,-180.50,withdrawal,City Power,BILL-789`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = templateFileName;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Template downloaded successfully');
  };

  const parseFile = async (file: File) => {
    const parseErrors: string[] = [];
    let transactions: (ParsedBankTransaction | ParsedCreditCardTransaction)[] = [];

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

      if (jsonData.length === 0) {
        parseErrors.push('No data found in the file');
        setErrors(parseErrors);
        return [];
      }

      transactions = jsonData.map((row, idx) => {
        // Try multiple column name variations
        const dateValue = row[dateColumn] || row['Date'] || row['Transaction Date'] || row['Posted Date'];
        const descValue = row[descriptionColumn] || row['Description'] || row['Merchant'] || row['Name'];
        const amountValue = row[amountColumn] || row['Amount'] || row['Debit'] || row['Credit'] || row['Charge'];
        const typeValue = row['Type'] || row['Transaction Type'];
        const payeeValue = row['Payee_Payor'] || row['Payee'] || row['Payor'] || row['Vendor'];
        const refValue = row['Reference'] || row['Ref'] || row['Check Number'];

        const toNum = (v: unknown): number => {
          if (v === undefined || v === null || v === '') return 0;
          if (typeof v === 'number') return v;
          const n = parseFloat(String(v).replace(/[$,()\s]/g, ''));
          return isNaN(n) ? 0 : n;
        };

        // Split debit/credit columns (bank only)
        const splitMode = !isCreditCard && amountMode === 'split';
        const debitValue = splitMode
          ? (row[debitColumn] ?? row['Cheques & Debits'] ?? row['Debit'] ?? row['Withdrawal'] ?? row['Cheques'])
          : undefined;
        const creditValue = splitMode
          ? (row[creditColumn] ?? row['Deposits & Credits'] ?? row['Credit'] ?? row['Deposit'] ?? row['Deposits'])
          : undefined;

        // Parse amount
        let amount = splitMode
          ? (Math.abs(toNum(creditValue)) || Math.abs(toNum(debitValue)))
          : (typeof amountValue === 'number'
              ? amountValue
              : parseFloat(String(amountValue || '0').replace(/[$,]/g, '')));

        if (isNaN(amount)) {
          parseErrors.push(`Row ${idx + 2}: Invalid amount "${amountValue}"`);
          amount = 0;
        }

        // Parse date
        let date = new Date().toISOString().split('T')[0];
        if (dateValue) {
          if (typeof dateValue === 'number') {
            // Excel serial date
            const excelDate = new Date((dateValue - 25569) * 86400 * 1000);
            date = excelDate.toISOString().split('T')[0];
          } else {
            const parsed = new Date(String(dateValue));
            if (!isNaN(parsed.getTime())) {
              date = parsed.toISOString().split('T')[0];
            }
          }
        }

        // Determine transaction type for credit cards
        // CC convention: positive amount = charge, negative = payment. Explicit Type wins.
        if (isCreditCard) {
          const type = classifyCreditCardType(
            amount,
            typeof typeValue === 'string' ? typeValue : '',
            String(descValue || ''),
          );
          amount = Math.abs(amount);

          return {
            date,
            description: String(descValue || 'Unknown'),
            amount,
            type,
            payee_payor: payeeValue ? String(payeeValue) : undefined,
            reference: refValue ? String(refValue) : undefined,
          } as ParsedCreditCardTransaction;
        } else {
          let type: ParsedBankTransaction['type'] = amount >= 0 ? 'deposit' : 'withdrawal';
          if (splitMode) {
            const c = Math.abs(toNum(creditValue));
            const d = Math.abs(toNum(debitValue));
            type = c >= d && c > 0 ? 'deposit' : 'withdrawal';
          } else {
            const typeStr = String(typeValue || '').toLowerCase();
            if (typeStr === 'deposit' || typeStr === 'credit') {
              type = 'deposit';
            } else if (typeStr === 'withdrawal' || typeStr === 'debit') {
              type = 'withdrawal';
            }
          }

          return {
            date,
            description: String(descValue || 'Unknown'),
            amount: Math.abs(amount),
            type,
            payee_payor: payeeValue ? String(payeeValue) : undefined,
            reference: refValue ? String(refValue) : undefined,
          } as ParsedBankTransaction;
        }
      }).filter(t => t.amount > 0);

      setErrors(parseErrors);
      return transactions;
    } catch (err) {
      parseErrors.push('Failed to parse file. Please ensure it is a valid CSV or Excel file.');
      console.error('Parse error:', err);
      setErrors(parseErrors);
      return [];
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const parsed = await parseFile(file);
    setPreviewData(parsed);
    setBaselineData(parsed.map((r) => ({ ...r })));
    setStep('preview');
  };

  const handleImport = async () => {
    try {
      if (isCreditCard && onImportCreditCard) {
        await onImportCreditCard(previewData as ParsedCreditCardTransaction[]);
      } else if (!isCreditCard && onImportBank) {
        await onImportBank(previewData as ParsedBankTransaction[]);
      }
      setStep('complete');
    } catch (error) {
      console.error('Import failed:', error);
      // Don't change step - stay on preview so user can retry
      // Toast error is shown by the mutation's onError handler
    }
  };

  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewData([]);
    setBaselineData([]);
    setErrors([]);
    onOpenChange(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Import transactions from a CSV or Excel file for {accountName}
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

            {/* Date Format */}
            <div className="space-y-2">
              <Label>Date Format in File</Label>
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yyyy-mm-dd">YYYY-MM-DD (2024-12-30)</SelectItem>
                  <SelectItem value="mm/dd/yyyy">MM/DD/YYYY (12/30/2024)</SelectItem>
                  <SelectItem value="dd/mm/yyyy">DD/MM/YYYY (30/12/2024)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Column Mapping */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Column Mapping (optional)</p>

              {!isCreditCard && (
                <div className="space-y-1">
                  <Label className="text-xs">Amount Format</Label>
                  <Select value={amountMode} onValueChange={(v) => setAmountMode(v as 'single' | 'split')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single Amount Column (signed)</SelectItem>
                      <SelectItem value="split">Separate Debit / Credit Columns</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date Column</Label>
                  <Input 
                    value={dateColumn} 
                    onChange={(e) => setDateColumn(e.target.value)}
                    placeholder="Date"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description Column</Label>
                  <Input 
                    value={descriptionColumn} 
                    onChange={(e) => setDescriptionColumn(e.target.value)}
                    placeholder="Description"
                  />
                </div>
                {(isCreditCard || amountMode === 'single') && (
                  <div className="space-y-1">
                    <Label className="text-xs">Amount Column</Label>
                    <Input 
                      value={amountColumn} 
                      onChange={(e) => setAmountColumn(e.target.value)}
                      placeholder="Amount"
                    />
                  </div>
                )}
                {!isCreditCard && amountMode === 'split' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Debits / Cheques Column</Label>
                      <Input 
                        value={debitColumn} 
                        onChange={(e) => setDebitColumn(e.target.value)}
                        placeholder="Cheques & Debits"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Credits / Deposits Column</Label>
                      <Input 
                        value={creditColumn} 
                        onChange={(e) => setCreditColumn(e.target.value)}
                        placeholder="Deposits & Credits"
                      />
                    </div>
                  </>
                )}
              </div>
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
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-foreground font-medium mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-muted-foreground">
                CSV or Excel files supported (max 10MB)
              </p>
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
                onClick={() => {
                  setStep('upload');
                  setSelectedFile(null);
                  setPreviewData([]);
                  setBaselineData([]);
                }}
              >
                <X className="w-4 h-4" />
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

            {/* Editable Preview Table */}
            <EditableImportPreview
              mode={isCreditCard ? 'credit-card' : 'bank'}
              rows={previewData}
              baselineRows={baselineData}
              onChange={setPreviewData}
              formatCurrency={formatCurrency}
            />


            {/* Summary */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {previewData.length} transactions ready to import
              </span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')} disabled={isImporting}>
                  Back
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={previewData.length === 0 || isImporting}
                  className="bg-accent hover:bg-accent/90"
                >
                  {isImporting ? 'Importing...' : `Import ${previewData.length} Transactions`}
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
              Successfully imported {previewData.length} transactions to {accountName}
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
