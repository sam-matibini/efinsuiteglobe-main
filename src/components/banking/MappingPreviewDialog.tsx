import { useState, useMemo } from 'react';
import { 
  Eye, Check, AlertTriangle, ChevronLeft, ChevronRight, 
  FileCheck, ArrowRight, Edit2, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { 
  ColumnMappingAdvanced, 
  MappingConfig,
  DateFormat,
  NumberFormat 
} from './AdvancedMappingEngine';

interface TransactionPreview {
  rowIndex: number;
  original: Record<string, unknown>;
  mapped: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

interface MappingPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceData: Record<string, unknown>[];
  mappingConfig: MappingConfig;
  statementType: 'bank' | 'creditcard';
  onConfirm: (normalizedData: Record<string, unknown>[]) => void;
  onBack: () => void;
}

// Parsing utilities
function excelSerialToDate(serial: number): Date | null {
  if (!isFinite(serial) || serial < 10000 || serial > 80000) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

function parseDate(value: unknown, format: DateFormat): string | null {
  if (value === null || value === undefined || value === '') return null;

  // Native Date object (e.g. xlsx with cellDates:true)
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString().split('T')[0];
  }

  // Excel serial number
  if (typeof value === 'number') {
    const d = excelSerialToDate(value);
    return d ? d.toISOString().split('T')[0] : null;
  }

  if (typeof value !== 'string') return null;

  const clean = value.trim();
  if (!clean) return null;

  // Numeric string that looks like an Excel serial
  if (/^\d+(\.\d+)?$/.test(clean)) {
    const n = parseFloat(clean);
    const d = excelSerialToDate(n);
    if (d) return d.toISOString().split('T')[0];
  }

  let day: number, month: number, year: number;

  try {
    const parts = clean.split(/[-\/\.]/);
    if (parts.length !== 3) {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
      return null;
    }

    switch (format) {
      case 'yyyy-mm-dd':
      case 'yyyy/mm/dd':
        [year, month, day] = parts.map(Number);
        break;
      case 'dd-mm-yyyy':
      case 'dd/mm/yyyy':
        [day, month, year] = parts.map(Number);
        break;
      case 'mm-dd-yyyy':
      case 'mm/dd/yyyy':
        [month, day, year] = parts.map(Number);
        break;
      case 'auto':
      default:
        const nums = parts.map(Number);
        if (nums[0] > 31) {
          [year, month, day] = nums;
        } else if (nums[2] > 31) {
          [day, month, year] = nums;
        } else {
          [month, day, year] = nums;
        }
        break;
    }

    if (year < 100) year = year >= 50 ? 1900 + year : 2000 + year;

    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return null;

    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

function parseNumber(
  value: unknown,
  format: NumberFormat,
  treatBracketsAsNegative: boolean,
  invertSign: boolean
): number | null {
  if (value === null || value === undefined || value === '') return null;

  // Native number
  if (typeof value === 'number') {
    if (!isFinite(value)) return null;
    return invertSign ? -value : value;
  }

  if (typeof value !== 'string') return null;

  let clean = value.trim();
  if (!clean) return null;
  let isNegative = false;

  if (/^\([^)]+\)$/.test(clean)) {
    if (treatBracketsAsNegative || format === 'accounting') {
      isNegative = true;
      clean = clean.slice(1, -1);
    }
  }

  if (clean.startsWith('-')) {
    isNegative = true;
    clean = clean.slice(1);
  }

  clean = clean.replace(/[$€£¥₹]/g, '');

  switch (format) {
    case 'european':
      clean = clean.replace(/\./g, '').replace(',', '.');
      break;
    case 'space-separated':
      clean = clean.replace(/\s/g, '').replace(',', '.');
      break;
    case 'standard':
    case 'accounting':
    default:
      clean = clean.replace(/,/g, '');
      break;
  }

  const num = parseFloat(clean);
  if (isNaN(num)) return null;

  let result = isNegative ? -Math.abs(num) : num;
  if (invertSign) result = -result;

  return result;
}

export function MappingPreviewDialog({
  open,
  onOpenChange,
  sourceData,
  mappingConfig,
  statementType,
  onConfirm,
  onBack,
}: MappingPreviewDialogProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 20;
  
  const { mappings, dateFormat, numberFormat, invertSign, treatBracketsAsNegative } = mappingConfig;
  
  // Process all data with mappings
  const processedData = useMemo(() => {
    return sourceData.map((row, rowIndex) => {
      const mapped: Record<string, unknown> = {};
      const errors: string[] = [];
      const warnings: string[] = [];
      
      for (const mapping of mappings) {
        if (!mapping.sourceColumn) continue;
        
        const rawValue = row[mapping.sourceColumn];
        const strValue = typeof rawValue === 'string' ? rawValue : (rawValue == null ? '' : String(rawValue));

        // Determine field type from targetField
        const isDateField = mapping.targetField.includes('date');
        const isAmountField = ['amount', 'debit', 'credit', 'balance', 'foreign_amount'].includes(mapping.targetField);

        if (isDateField) {
          const parsed = parseDate(rawValue, mapping.dateFormat || dateFormat);
          if (parsed) {
            mapped[mapping.targetField] = parsed;
          } else if (strValue) {
            errors.push(`Invalid date in "${mapping.targetField}": ${strValue}`);
          }
        } else if (isAmountField) {
          const parsed = parseNumber(
            rawValue,
            mapping.numberFormat || numberFormat,
            mapping.treatBracketsAsNegative ?? treatBracketsAsNegative,
            mapping.invertSign ?? invertSign
          );
          if (parsed !== null) {
            mapped[mapping.targetField] = parsed;
          } else if (strValue) {
            errors.push(`Invalid amount in "${mapping.targetField}": ${strValue}`);
          }
        } else {
          mapped[mapping.targetField] = strValue.trim();
        }
      }
      
      // Validate required fields
      const requiredFields = mappings.filter(m => m.isRequired);
      for (const req of requiredFields) {
        if (!mapped[req.targetField]) {
          errors.push(`Missing required field: ${req.targetField}`);
        }
      }
      
      // Handle amount logic (if debit/credit provided but not amount, calculate)
      if (!mapped['amount'] && (mapped['debit'] || mapped['credit'])) {
        const debit = typeof mapped['debit'] === 'number' ? mapped['debit'] : 0;
        const credit = typeof mapped['credit'] === 'number' ? mapped['credit'] : 0;
        mapped['amount'] = credit - debit;
      }
      
      return {
        rowIndex,
        original: row,
        mapped,
        errors,
        warnings,
      } as TransactionPreview;
    });
  }, [sourceData, mappings, dateFormat, numberFormat, invertSign, treatBracketsAsNegative]);
  
  const totalPages = Math.ceil(processedData.length / pageSize);
  const paginatedData = processedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  
  const errorCount = processedData.filter(p => p.errors.length > 0).length;
  const warningCount = processedData.filter(p => p.warnings.length > 0).length;
  const validCount = processedData.filter(p => p.errors.length === 0).length;
  
  const mappedFields = mappings.filter(m => m.sourceColumn).map(m => m.targetField);
  
  // Add a synthetic "Type" column when the statement uses split debit/credit
  // (or always for credit cards) so users see Deposit/Withdrawal classification.
  const hasDebit = mappedFields.includes('debit');
  const hasCredit = mappedFields.includes('credit');
  const showTypeColumn = statementType === 'creditcard' || hasDebit || hasCredit;
  
  // Display labels for column headers (matching database field names for import)
  const fieldDisplayLabels: Record<string, string> = {
    transaction_date: 'Date',
    posted_date: 'Posted Date',
    posting_date: 'Posted Date',
    description: 'Description',
    amount: 'Amount',
    debit: 'Debit',
    credit: 'Credit',
    balance: 'Balance',
    merchant: 'Payee/Payor',
    merchant_name: 'Payee/Payor',
    payee_payor: 'Payee/Payor',
    reference: 'Reference',
    category: 'Category',
    foreign_amount: 'Foreign Amount',
    foreign_currency: 'Currency',
    currency: 'Currency',
    memo: 'Memo',
    check_number: 'Check Number',
    merchant_category_code: 'MCC',
  };
  
  const getFieldDisplayLabel = (field: string): string => {
    return fieldDisplayLabels[field] || field.replace(/_/g, ' ');
  };
  
  const deriveType = (mapped: Record<string, unknown>): 'deposit' | 'withdrawal' | null => {
    const debit = typeof mapped['debit'] === 'number' ? (mapped['debit'] as number) : 0;
    const credit = typeof mapped['credit'] === 'number' ? (mapped['credit'] as number) : 0;
    if (statementType === 'bank' && (hasDebit || hasCredit)) {
      if (credit > 0 && credit >= debit) return 'deposit';
      if (debit > 0) return 'withdrawal';
      return null;
    }
    const amount = typeof mapped['amount'] === 'number' ? (mapped['amount'] as number) : 0;
    if (statementType === 'creditcard') {
      // CC convention (opposite of bank):
      //   POSITIVE amount  = charge   -> shown as Withdrawal (money out of card)
      //   NEGATIVE amount  = payment  -> shown as Deposit    (money into card from chequing)
      if (hasDebit || hasCredit) {
        if (debit > 0 && debit >= credit) return 'withdrawal';
        if (credit > 0) return 'deposit';
      }
      if (amount > 0) return 'withdrawal';
      if (amount < 0) return 'deposit';
      return null;
    }
    if (amount > 0) return 'deposit';
    if (amount < 0) return 'withdrawal';
    return null;
  };
  
  const normalizeMappedRow = (mapped: Record<string, unknown>) => {
    const out: Record<string, unknown> = { ...mapped };

    // Normalize payee/payor
    if ((out.payee_payor === undefined || out.payee_payor === null || out.payee_payor === '') && (out.merchant_name || out.merchant)) {
      out.payee_payor = (out.merchant_name ?? out.merchant) as unknown;
    }

    // Normalize posted date field naming
    if ((out.posted_date === undefined || out.posted_date === null || out.posted_date === '') && out.posting_date) {
      out.posted_date = out.posting_date as unknown;
    }

    // Derive signed amount and type from split debit/credit columns
    const debit = typeof out['debit'] === 'number' ? (out['debit'] as number) : 0;
    const credit = typeof out['credit'] === 'number' ? (out['credit'] as number) : 0;
    if ((out['amount'] === undefined || out['amount'] === null) && (hasDebit || hasCredit)) {
      out['amount'] = credit - debit;
    }
    if (!out['type']) {
      const t = deriveType(out);
      if (t) out['type'] = t;
    }

    return out;
  };

  const handleConfirm = () => {
    const normalizedData = processedData
      .filter(p => p.errors.length === 0)
      .map(p => normalizeMappedRow(p.mapped));
    onConfirm(normalizedData);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview & Validate Transactions
          </DialogTitle>
          <DialogDescription>
            Review the normalized data before importing. Rows with errors will be skipped.
          </DialogDescription>
        </DialogHeader>
        
        {/* Summary Stats */}
        <div className="px-6 py-3 border-b border-border bg-muted/30 flex items-center gap-4">
          <Badge variant="default" className="gap-1">
            <Check className="h-3 w-3" />
            {validCount} valid
          </Badge>
          {errorCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {errorCount} errors
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              {warningCount} warnings
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            Showing rows {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, processedData.length)} of {processedData.length}
          </span>
        </div>
        
        {/* Preview Table */}
        <ScrollArea className="flex-1 min-h-0 h-[calc(100vh-350px)]">
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 sticky left-0 bg-background">#</TableHead>
                  <TableHead className="w-16">Status</TableHead>
                  {mappedFields.map(field => (
                    <TableHead key={field} className="min-w-[120px]">
                      {getFieldDisplayLabel(field)}
                    </TableHead>
                  ))}
                  {showTypeColumn && (
                    <TableHead className="min-w-[100px]">Type</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((preview) => (
                  <TableRow 
                    key={preview.rowIndex}
                    className={cn(
                      preview.errors.length > 0 && "bg-destructive/5"
                    )}
                  >
                    <TableCell className="font-mono text-xs sticky left-0 bg-inherit">
                      {preview.rowIndex + 1}
                    </TableCell>
                    <TableCell>
                      {preview.errors.length > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Error
                        </Badge>
                      ) : preview.warnings.length > 0 ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Warning
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-green-600">
                          Valid
                        </Badge>
                      )}
                    </TableCell>
                    {mappedFields.map(field => {
                      const value = preview.mapped[field];
                      const hasError = preview.errors.some(e => e.includes(field));
                      
                      return (
                        <TableCell 
                          key={field}
                          className={cn(
                            "text-xs font-mono max-w-[200px] truncate",
                            hasError && "text-destructive"
                          )}
                        >
                          {value !== undefined && value !== null && value !== '' 
                            ? String(value) 
                            : <span className="text-muted-foreground">—</span>
                          }
                        </TableCell>
                      );
                    })}
                    {showTypeColumn && (() => {
                      const t = deriveType(preview.mapped);
                      if (!t) {
                        return (
                          <TableCell className="text-xs">
                            <span className="text-muted-foreground">—</span>
                          </TableCell>
                        );
                      }
                      const isDeposit = t === 'deposit';
                      return (
                        <TableCell className="text-xs">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              isDeposit ? "text-green-600 border-green-600" : "text-red-600 border-red-600"
                            )}
                          >
                            {isDeposit ? 'Deposit' : 'Withdrawal'}
                          </Badge>
                        </TableCell>
                      );
                    })()}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>

        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-2 border-t border-border flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <DialogFooter className="p-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={onBack}>
            <Edit2 className="h-4 w-4 mr-1" />
            Edit Mapping
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={validCount === 0}
          >
            <FileCheck className="h-4 w-4 mr-1" />
            Import {validCount} Transactions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
