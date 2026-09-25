import { useState, useRef, useMemo } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { usePdfToSpreadsheet } from '@/hooks/usePdfToSpreadsheet';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, CreditCardTransaction } from '@/hooks/useCreditCards';
import * as XLSX from 'xlsx';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';
import { getLocaleForCountry } from '@/lib/localizedCurrencyFormatter';
import { classifyCreditCardType, normalizeCreditCardAmount } from '@/lib/creditCardImportNormalizer';
import { EditableImportPreview } from './EditableImportPreview';

interface CreditCardImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditCard: CreditCard | null;
  onImport: (transactions: Omit<CreditCardTransaction, 'id' | 'created_at' | 'updated_at'>[]) => Promise<void>;
  isPending?: boolean;
}

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'charge' | 'payment' | 'credit' | 'fee' | 'interest';
}

export function CreditCardImportDialog({
  open,
  onOpenChange,
  creditCard,
  onImport,
  isPending,
}: CreditCardImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [baselineTransactions, setBaselineTransactions] = useState<ParsedTransaction[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dateColumn, setDateColumn] = useState('Date');
  const [descriptionColumn, setDescriptionColumn] = useState('Description');
  const [amountColumn, setAmountColumn] = useState('Amount');
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload');
  const [isExtracting, setIsExtracting] = useState(false);
  const { organization } = useCurrentOrganization();
  const { convertPdfToSpreadsheet } = usePdfToSpreadsheet();

  const countryCode = organization?.country?.toUpperCase() || 'CA';
  const localization = getCountryLocalization(countryCode);
  const locale = getLocaleForCountry(countryCode);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: localization.currency,
    }).format(value);
  };


  const mapRowsToTransactions = (jsonData: Record<string, unknown>[]): ParsedTransaction[] => {
    return jsonData.map((row) => {
      const findValue = (columnNames: string) => {
        const names = columnNames.split(',').map(n => n.trim());
        for (const name of names) {
          if (row[name] !== undefined && row[name] !== null && row[name] !== '') return row[name];
          // case-insensitive fallback
          const match = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
          if (match && row[match] !== undefined && row[match] !== null && row[match] !== '') return row[match];
        }
        return undefined;
      };

      const dateValue = findValue(dateColumn) || findValue('Transaction Date,Date,Posted Date,Post Date,Trans Date');
      const descValue = findValue(descriptionColumn) || findValue('Description,Merchant,Name,Payee,Details');
      const amountValue = findValue(amountColumn) || findValue('Amount,Debit,Charge,Credit,Withdrawal,Deposit');
      const typeValue = findValue('Type,Transaction Type');

      const rawAmount = typeof amountValue === 'number'
        ? amountValue
        : parseFloat(String(amountValue ?? '').replace(/[$,\s]/g, '')) || 0;

      const description = String(descValue || 'Unknown');
      const type = classifyCreditCardType(
        rawAmount,
        typeof typeValue === 'string' ? typeValue : '',
        description,
      );
      const amount = normalizeCreditCardAmount(rawAmount);

      let date = new Date().toISOString().split('T')[0];
      if (dateValue) {
        if (typeof dateValue === 'number') {
          const excelDate = new Date((dateValue - 25569) * 86400 * 1000);
          date = excelDate.toISOString().split('T')[0];
        } else {
          const parsed = new Date(String(dateValue));
          if (!isNaN(parsed.getTime())) {
            date = parsed.toISOString().split('T')[0];
          }
        }
      }

      return { date, description, amount, type };
    }).filter(t => t.amount > 0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParseError(null);

    const isPdf = selectedFile.type === 'application/pdf' || /\.pdf$/i.test(selectedFile.name);

    try {
      if (isPdf) {
        setIsExtracting(true);
        const result = await convertPdfToSpreadsheet(selectedFile, { useAI: true, extractTables: true });
        setIsExtracting(false);

        if (!result || !result.success) {
          setParseError(result?.error || result?.message || 'AI could not extract transactions from this PDF. Try splitting it into smaller files or converting to CSV.');
          return;
        }

        const rows = (result.rows || []) as Record<string, unknown>[];
        if (rows.length === 0) {
          setParseError('No transactions detected in the PDF. The statement may be image-based or non-standard. Try a CSV/Excel export from your card issuer.');
          return;
        }

        const transactions = mapRowsToTransactions(rows);
        if (transactions.length === 0) {
          setParseError(`Extracted ${rows.length} rows but none matched the column mapping. Adjust the Date/Description/Amount column names below and re-upload.`);
          return;
        }
        setParsedTransactions(transactions);
        setBaselineTransactions(transactions.map((t) => ({ ...t })));
        setStep('preview');
        return;
      }

      // CSV / Excel path
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

      if (jsonData.length === 0) {
        setParseError('No data found in the file');
        return;
      }

      const transactions = mapRowsToTransactions(jsonData);
      setParsedTransactions(transactions);
      setBaselineTransactions(transactions.map((t) => ({ ...t })));
      setStep('preview');
    } catch (err) {
      setIsExtracting(false);
      const msg = err instanceof Error ? err.message : 'Failed to parse file.';
      setParseError(msg.includes('408') || msg.toLowerCase().includes('timeout')
        ? 'PDF extraction timed out — try splitting the statement into smaller PDFs.'
        : `Failed to parse file: ${msg}`);
      console.error('Parse error:', err);
    }
  };

  const handleImport = async () => {
    if (!creditCard || parsedTransactions.length === 0) return;

    const transactions = parsedTransactions.map(t => ({
      credit_card_id: creditCard.id,
      transaction_date: t.date,
      posted_date: null,
      description: t.description,
      amount: t.amount,
      transaction_type: t.type,
      category: null,
      merchant_category_code: null,
      payee_payor: null,
      memo: null,
      reference: null,
      is_cleared: false,
      cleared_at: null,
      gl_account_id: null,
      journal_entry_id: null,
      status: 'pending' as const,
      imported_at: new Date().toISOString(),
    }));

    await onImport(transactions);
    setStep('complete');
  };

  const handleClose = () => {
    setFile(null);
    setParsedTransactions([]);
    setBaselineTransactions([]);
    setParseError(null);
    setStep('upload');
    onOpenChange(false);
  };

  if (!creditCard) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Credit Card Statement
          </DialogTitle>
          <DialogDescription>
            Import transactions from a CSV, Excel, or PDF statement for {creditCard.name}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => !isExtracting && fileInputRef.current?.click()}
            >
              {isExtracting ? (
                <Loader2 className="w-12 h-12 mx-auto text-muted-foreground mb-4 animate-spin" />
              ) : (
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              )}
              <p className="text-sm text-muted-foreground mb-2">
                {isExtracting ? 'Extracting transactions with AI…' : 'Click to upload or drag and drop'}
              </p>
              <p className="text-xs text-muted-foreground">
                CSV, Excel, or PDF statements supported
              </p>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={isExtracting}
              />
            </div>

            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <p className="text-sm font-medium">Column Mapping (supports multiple columns)</p>
              <p className="text-xs text-muted-foreground mb-2">
                Enter column names separated by commas to try multiple options
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Date Column(s)</Label>
                  <Input 
                    value={dateColumn} 
                    onChange={(e) => setDateColumn(e.target.value)}
                    placeholder="Date, Transaction Date, Posted"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description Column(s)</Label>
                  <Input 
                    value={descriptionColumn} 
                    onChange={(e) => setDescriptionColumn(e.target.value)}
                    placeholder="Description, Merchant, Name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount Column(s)</Label>
                  <Input 
                    value={amountColumn} 
                    onChange={(e) => setAmountColumn(e.target.value)}
                    placeholder="Amount, Debit, Charge"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Preview ({parsedTransactions.length} transactions)
              </p>
              <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>
                Change File
              </Button>
            </div>

            <EditableImportPreview
              mode="credit-card"
              rows={parsedTransactions}
              baselineRows={baselineTransactions}
              onChange={setParsedTransactions}
              formatCurrency={formatCurrency}
              showPayee={false}
            />

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button 
                className="bg-accent hover:bg-accent/90"
                onClick={handleImport}
                disabled={isPending}
              >
                {isPending ? 'Importing...' : `Import ${parsedTransactions.length} Transactions`}
              </Button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Import Complete!</h3>
            <p className="text-muted-foreground mb-4">
              Successfully imported {parsedTransactions.length} transactions
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
