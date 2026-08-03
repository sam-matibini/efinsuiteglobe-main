import { useState, useMemo, useCallback, Fragment } from 'react';
import {
  Eye, Check, AlertTriangle, ChevronLeft, ChevronRight,
  FileCheck, ArrowRight, Edit2, RotateCcw, Pencil, ArrowLeftRight, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [rowOverrides, setRowOverrides] = useState<Record<number, Record<string, unknown>>>({});
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const pageSize = 20;
  
  const { mappings, dateFormat, numberFormat, invertSign, treatBracketsAsNegative } = mappingConfig;
  
  // Process all data with mappings
  const baseProcessedData = useMemo(() => {

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
      // Bank: positive = deposit (credit - debit). CC: positive = charge (debit - credit).
      if (!mapped['amount'] && (mapped['debit'] || mapped['credit'])) {
        const debit = typeof mapped['debit'] === 'number' ? mapped['debit'] : 0;
        const credit = typeof mapped['credit'] === 'number' ? mapped['credit'] : 0;
        mapped['amount'] = statementType === 'creditcard' ? debit - credit : credit - debit;
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
  
  const mappedFields = mappings.filter(m => m.sourceColumn).map(m => m.targetField);

  // Add a synthetic "Type" column when the statement uses split debit/credit
  // (or always for credit cards) so users see Deposit/Withdrawal classification.
  const hasDebit = mappedFields.includes('debit');
  const hasCredit = mappedFields.includes('credit');
  const showTypeColumn = statementType === 'creditcard' || hasDebit || hasCredit;

  // Apply per-row manual corrections on top of the parsed rows.
  const processedData = useMemo(() => {
    return baseProcessedData.map((p) => {
      const ov = rowOverrides[p.rowIndex];
      if (!ov) return p;
      const mapped = { ...p.mapped, ...ov };

      // Recompute the signed amount whenever debit/credit were corrected
      if ('debit' in ov || 'credit' in ov) {
        const debit = typeof mapped['debit'] === 'number' ? (mapped['debit'] as number) : 0;
        const credit = typeof mapped['credit'] === 'number' ? (mapped['credit'] as number) : 0;
        mapped['amount'] = statementType === 'creditcard' ? debit - credit : credit - debit;
      }

      // Drop parse errors for fields the user has corrected, then re-validate required fields
      const overriddenFields = Object.keys(ov);
      const errors = p.errors.filter(
        (e) => !overriddenFields.some((f) => e.includes(`"${f}"`) || e.includes(`field: ${f}`)),
      );
      for (const req of mappings.filter((m) => m.isRequired)) {
        const v = mapped[req.targetField];
        const missing = v === undefined || v === null || v === '';
        const already = errors.some((e) => e.includes(`field: ${req.targetField}`));
        if (missing && !already) errors.push(`Missing required field: ${req.targetField}`);
      }

      return { ...p, mapped, errors, edited: true } as TransactionPreview & { edited: boolean };
    });
  }, [baseProcessedData, rowOverrides, mappings, statementType]);

  const editedCount = Object.keys(rowOverrides).length;

  const totalPages = Math.ceil(processedData.length / pageSize);
  const paginatedData = processedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  
  const errorCount = processedData.filter(p => p.errors.length > 0).length;
  const warningCount = processedData.filter(p => p.warnings.length > 0).length;
  const validCount = processedData.filter(p => p.errors.length === 0).length;

  
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
      // Bank: positive = deposit (credit - debit). CC: positive = charge (debit - credit).
      out['amount'] = statementType === 'creditcard' ? debit - credit : credit - debit;
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

  // ---- Row-level manual corrections -------------------------------------
  const useSplitColumns = hasDebit || hasCredit;

  const rowMagnitude = (mapped: Record<string, unknown>): number => {
    const debit = typeof mapped['debit'] === 'number' ? Math.abs(mapped['debit'] as number) : 0;
    const credit = typeof mapped['credit'] === 'number' ? Math.abs(mapped['credit'] as number) : 0;
    if (useSplitColumns && (debit || credit)) return debit || credit;
    const amount = typeof mapped['amount'] === 'number' ? Math.abs(mapped['amount'] as number) : 0;
    return amount;
  };

  const typePatch = (mapped: Record<string, unknown>, type: 'deposit' | 'withdrawal') => {
    const value = rowMagnitude(mapped);
    if (useSplitColumns) {
      if (statementType === 'creditcard') {
        // charge (withdrawal) sits in debit, payment (deposit) in credit
        return type === 'withdrawal' ? { debit: value, credit: 0 } : { debit: 0, credit: value };
      }
      return type === 'deposit' ? { credit: value, debit: 0 } : { credit: 0, debit: value };
    }
    // Single signed amount column
    const signed =
      statementType === 'creditcard'
        ? (type === 'withdrawal' ? value : -value)
        : (type === 'deposit' ? value : -value);
    return { amount: signed };
  };

  const setRowType = useCallback(
    (rowIndex: number, type: 'deposit' | 'withdrawal', applyToMatching = false) => {
      const target = processedData.find((p) => p.rowIndex === rowIndex);
      if (!target) return;
      const key = String(
        target.mapped['description'] ?? target.mapped['payee_payor'] ?? target.mapped['merchant'] ?? '',
      )
        .trim()
        .toLowerCase();

      setRowOverrides((prev) => {
        const next = { ...prev };
        const rows = applyToMatching && key
          ? processedData.filter(
              (p) =>
                String(p.mapped['description'] ?? p.mapped['payee_payor'] ?? p.mapped['merchant'] ?? '')
                  .trim()
                  .toLowerCase() === key,
            )
          : [target];
        for (const r of rows) {
          next[r.rowIndex] = { ...(next[r.rowIndex] ?? {}), ...typePatch(r.mapped, type) };
        }
        return next;
      });
    },
    [processedData, statementType, useSplitColumns],
  );

  const setRowField = useCallback((rowIndex: number, field: string, value: unknown) => {
    setRowOverrides((prev) => ({
      ...prev,
      [rowIndex]: { ...(prev[rowIndex] ?? {}), [field]: value },
    }));
  }, []);

  const resetRow = useCallback((rowIndex: number) => {
    setRowOverrides((prev) => {
      const next = { ...prev };
      delete next[rowIndex];
      return next;
    });
  }, []);

  const matchingCount = (mapped: Record<string, unknown>): number => {
    const key = String(mapped['description'] ?? mapped['payee_payor'] ?? mapped['merchant'] ?? '')
      .trim()
      .toLowerCase();
    if (!key) return 0;
    return processedData.filter(
      (p) =>
        String(p.mapped['description'] ?? p.mapped['payee_payor'] ?? p.mapped['merchant'] ?? '')
          .trim()
          .toLowerCase() === key,
    ).length;
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
          {editedCount > 0 && (
            <>
              <Badge variant="outline" className="gap-1 text-amber-600 border-amber-600">
                <Pencil className="h-3 w-3" />
                {editedCount} corrected
              </Badge>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setRowOverrides({})}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset all edits
              </Button>
            </>
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
                  <TableHead className="w-24 text-right">Correct</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((preview) => {
                  const isEdited = !!rowOverrides[preview.rowIndex];
                  const rowType = deriveType(preview.mapped);
                  const isEditing = editingRow === preview.rowIndex;
                  const dupes = matchingCount(preview.mapped);
                  const colSpan = 2 + mappedFields.length + (showTypeColumn ? 1 : 0) + 1;
                  return (
                  <>
                  <TableRow 
                    key={preview.rowIndex}
                    className={cn(
                      preview.errors.length > 0 && "bg-destructive/5",
                      isEdited && "bg-amber-500/5"
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
                      ) : isEdited ? (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-600">
                          Edited
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
                    {showTypeColumn && (
                      <TableCell className="text-xs">
                        {!rowType ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                rowType === 'deposit'
                                  ? "text-green-600 border-green-600"
                                  : "text-red-600 border-red-600"
                              )}
                            >
                              {rowType === 'deposit' ? 'Deposit' : 'Withdrawal'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              title="Flip this row between Deposit and Withdrawal"
                              onClick={() =>
                                setRowType(
                                  preview.rowIndex,
                                  rowType === 'deposit' ? 'withdrawal' : 'deposit',
                                )
                              }
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Edit this row"
                          onClick={() => setEditingRow(isEditing ? null : preview.rowIndex)}
                        >
                          {isEditing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                        </Button>
                        {isEdited && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Reset this row"
                            onClick={() => resetRow(preview.rowIndex)}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isEditing && (
                    <TableRow key={`${preview.rowIndex}-editor`} className="bg-muted/40">
                      <TableCell colSpan={colSpan} className="p-4">
                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                            {mappedFields.map((field) => {
                              const isAmount = ['amount', 'debit', 'credit', 'balance', 'foreign_amount'].includes(field);
                              const val = preview.mapped[field];
                              return (
                                <div key={field} className="space-y-1">
                                  <Label className="text-[11px] text-muted-foreground">
                                    {getFieldDisplayLabel(field)}
                                  </Label>
                                  <Input
                                    className="h-8 text-xs"
                                    type={isAmount ? 'number' : field.includes('date') ? 'date' : 'text'}
                                    step={isAmount ? '0.01' : undefined}
                                    value={val === undefined || val === null ? '' : String(val)}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      if (isAmount) {
                                        setRowField(
                                          preview.rowIndex,
                                          field,
                                          raw === '' ? null : Number(raw),
                                        );
                                      } else {
                                        setRowField(preview.rowIndex, field, raw);
                                      }
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                          {showTypeColumn && (
                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                              <span className="text-xs text-muted-foreground">Transaction type:</span>
                              <Button
                                size="sm"
                                variant={rowType === 'deposit' ? 'default' : 'outline'}
                                className="h-7 text-xs"
                                onClick={() => setRowType(preview.rowIndex, 'deposit')}
                              >
                                {statementType === 'creditcard' ? 'Payment (Credit)' : 'Deposit (Credit)'}
                              </Button>
                              <Button
                                size="sm"
                                variant={rowType === 'withdrawal' ? 'default' : 'outline'}
                                className="h-7 text-xs"
                                onClick={() => setRowType(preview.rowIndex, 'withdrawal')}
                              >
                                {statementType === 'creditcard' ? 'Charge (Debit)' : 'Withdrawal (Debit)'}
                              </Button>
                              {dupes > 1 && rowType && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-xs"
                                  onClick={() => setRowType(preview.rowIndex, rowType, true)}
                                >
                                  Apply this type to all {dupes} matching rows
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs ml-auto"
                                onClick={() => setEditingRow(null)}
                              >
                                Done
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </>
                  );
                })}

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
