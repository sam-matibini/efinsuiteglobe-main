import { useState, useRef, useEffect } from 'react';
import aliceAvatar from '@/assets/alice-avatar.png';
import { 
  Table, Download, FileSpreadsheet, Edit2, Trash2, Plus, 
  ArrowUpDown, Copy, X, Check, Maximize2,
  Minimize2, FileUp, CreditCard, Building2, Columns, FileText,
  Combine, Sparkles, Send, RotateCcw,
  ChevronRight, Bot, FunctionSquare, Paperclip, RefreshCw, BarChart2,
  TrendingUp, Mic, Upload, Layers, CheckSquare
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  AlertDialog, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { evaluateFormula, formatFormulaValue } from '@/lib/formulaEngine';
import { useAIFormula } from '@/hooks/useAIFormula';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { usePdfToSpreadsheet } from '@/hooks/usePdfToSpreadsheet';
import { Progress } from '@/components/ui/progress';
import { useBankTransactions } from '@/hooks/useBankTransactions';
import { useCreditCardTransactions, useCreditCards } from '@/hooks/useCreditCards';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { useAliceSheetsChat, type SheetAction, type SheetContext } from '@/hooks/useAliceSheetsChat';


interface SheetRow {
  [key: string]: string | number | boolean | null | undefined | unknown;
}

interface AISheetData {
  name: string;
  columns: string[];
  rows: SheetRow[];
  formulaColumns: Record<string, string>; // col name → formula expression
  sourceFile?: string;
  sourceType?: 'pdf' | 'excel' | 'csv' | 'manual';
}

interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
}

interface AISheetsProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: SheetRow[];
  initialColumns?: string[];
  sourceFile?: string;
  onImportToBank?: (data: SheetRow[], mapping?: ColumnMapping[]) => void;
  onImportToCreditCard?: (data: SheetRow[], mapping?: ColumnMapping[]) => void;
}

// ─── Excel Formula Catalog ─────────────────────────────────────────────────
const FORMULA_CATALOG = [
  // Math & Aggregation
  { name: 'SUM',        syntax: 'SUM(Column)',                  category: 'Math',        desc: 'Sum all values in a column' },
  { name: 'AVG',        syntax: 'AVG(Column)',                  category: 'Math',        desc: 'Average of all values in a column' },
  { name: 'MIN',        syntax: 'MIN(Column)',                  category: 'Math',        desc: 'Minimum value in a column' },
  { name: 'MAX',        syntax: 'MAX(Column)',                  category: 'Math',        desc: 'Maximum value in a column' },
  { name: 'COUNT',      syntax: 'COUNT(Column)',                category: 'Math',        desc: 'Count non-empty values in a column' },
  { name: 'ROUND',      syntax: 'ROUND(Column, 2)',             category: 'Math',        desc: 'Round a value to N decimal places' },
  { name: 'ABS',        syntax: 'ABS(Column)',                  category: 'Math',        desc: 'Absolute value (removes negative sign)' },
  // Arithmetic
  { name: 'Multiply',   syntax: 'Column1 * Column2',           category: 'Arithmetic',  desc: 'Multiply two column values' },
  { name: 'Divide',     syntax: 'Column1 / Column2',           category: 'Arithmetic',  desc: 'Divide one column by another' },
  { name: 'Add',        syntax: 'Column1 + Column2',           category: 'Arithmetic',  desc: 'Add two column values' },
  { name: 'Subtract',   syntax: 'Column1 - Column2',           category: 'Arithmetic',  desc: 'Subtract one column from another' },
  { name: 'Percent',    syntax: 'Column / SUM(Column) * 100',  category: 'Arithmetic',  desc: 'Percentage share of total' },
  { name: 'Margin',     syntax: '(Revenue - Cost) / Revenue * 100', category: 'Arithmetic', desc: 'Gross margin percentage' },
  // Logic
  { name: 'IF',         syntax: 'IF(Column > 0, "Positive", "Negative")', category: 'Logic', desc: 'Conditional: returns one of two values' },
  { name: 'IF (compare)', syntax: 'IF(Column1 > Column2, "Over", "Under")', category: 'Logic', desc: 'Compare two columns conditionally' },
  { name: 'IF (empty)',  syntax: 'IF(Column = "", "Missing", Column)', category: 'Logic', desc: 'Handle empty cells with a fallback' },
  // Text
  { name: 'UPPER',      syntax: 'UPPER(Column)',               category: 'Text',        desc: 'Convert text to uppercase' },
  { name: 'LOWER',      syntax: 'LOWER(Column)',               category: 'Text',        desc: 'Convert text to lowercase' },
  { name: 'CONCAT',     syntax: 'CONCAT(Column1, " ", Column2)', category: 'Text',     desc: 'Join multiple columns into one string' },
  // Finance
  { name: 'Balance',    syntax: 'OpeningBalance + Amount',     category: 'Finance',     desc: 'Running balance formula' },
  { name: 'Tax Amount', syntax: 'Amount * TaxRate / 100',      category: 'Finance',     desc: 'Calculate tax from rate column' },
  { name: 'Net Amount', syntax: 'GrossAmount - TaxAmount',     category: 'Finance',     desc: 'Net after tax deduction' },
  { name: 'Cumulative', syntax: 'SUM(Column)',                 category: 'Finance',     desc: 'Cumulative total across all rows' },
] as const;

export function AISheets({
  isOpen,
  onOpenChange,
  initialData = [],
  initialColumns = [],
  sourceFile,
  onImportToBank,
  onImportToCreditCard,
}: AISheetsProps) {
  const [sheets, setSheets] = useState<AISheetData[]>([
    {
      name: 'Sheet1',
      columns: initialColumns.length > 0 ? initialColumns : ['A', 'B', 'C', 'D', 'E'],
      rows: initialData.length > 0 ? initialData : [],
      formulaColumns: {},
      sourceFile,
    },
  ]);
  // Formula column dialog state
  const [formulaDialogOpen, setFormulaDialogOpen] = useState(false);
  const [formulaColName, setFormulaColName] = useState('');
  const [formulaExpression, setFormulaExpression] = useState('');
  const [formulaPreview, setFormulaPreview] = useState<string | number>('');
  const [formulaDropdownOpen, setFormulaDropdownOpen] = useState(false);
  const [formulaSearch, setFormulaSearch] = useState('');
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<'bank' | 'creditcard' | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [renameColumnDialogOpen, setRenameColumnDialogOpen] = useState(false);
  const [columnToRename, setColumnToRename] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedSheetsToMerge, setSelectedSheetsToMerge] = useState<number[]>([]);
  const [mergedSheetName, setMergedSheetName] = useState('Merged');
  // AI Chat panel
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatAttachments, setChatAttachments] = useState<{ name: string; context: string }[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages: aiMessages, isLoading: aiLoading, sendMessage: aiSend, clearMessages: aiClear, pushUndo, popUndo } = useAliceSheetsChat();
  // Clear & Charts panel state
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [chartTypeOverride, setChartTypeOverride] = useState<'line' | 'bar' | 'pie' | 'scatter' | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const chatAttachInputRef = useRef<HTMLInputElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  
  const { convertPdfToSpreadsheet, isConverting: isPdfConverting, progress } = usePdfToSpreadsheet();
  
  // Account selection state
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const [selectedCreditCardId, setSelectedCreditCardId] = useState<string | null>(null);
  
  // Import hooks for direct database operations when callbacks aren't provided
  const { accounts: bankAccounts } = useBankAccounts();
  const { creditCards } = useCreditCards();
  
  // Use selected account or fall back to first account
  const effectiveBankAccount = bankAccounts.find(a => a.id === selectedBankAccountId) || bankAccounts[0];
  const effectiveBankAccountId = effectiveBankAccount?.id;
  const effectiveBankGlAccountId = effectiveBankAccount?.gl_account_id;
  const effectiveCreditCard = creditCards.find(c => c.id === selectedCreditCardId) || creditCards[0];
  const effectiveCreditCardId = effectiveCreditCard?.id;
  const effectiveCreditCardGlAccountId = effectiveCreditCard?.gl_account_id;
  
  const { importTransactions: importBankTx } = useBankTransactions(effectiveBankAccountId);
  const { importTransactions: importCcTx } = useCreditCardTransactions(effectiveCreditCardId);
  
  // Bank/CC target columns. Virtual targets prefixed with "_" collapse split
  // Charge/Payment or Withdrawal/Deposit statement columns into a single signed
  // amount + transaction_type during posting.
  const bankTargetColumns = ['transaction_date', 'description', 'amount', '_withdrawal_column', '_deposit_column', 'payee_payor', 'reference', 'category', 'memo'];
  const creditCardTargetColumns = ['transaction_date', 'posted_date', 'description', 'amount', '_charge_column', '_payment_column', 'payee_payor', 'reference', 'category', 'merchant_category_code', 'memo'];

  // Header aliases: source-column patterns that map onto a target field.
  const HEADER_ALIASES: Record<string, string[]> = {
    transaction_date: ['date', 'trans date', 'transaction date', 'txn date'],
    posted_date: ['posted', 'posted date', 'posting date', 'post date'],
    description: ['description', 'details', 'narrative', 'transaction details'],
    payee_payor: ['payer/payee', 'payee/payer', 'payee', 'payer', 'payor', 'merchant', 'counterparty', 'payer_payee'],
    reference: ['reference', 'ref', 'ref #', 'ref no', 'cheque', 'check', 'check no', 'cheque no'],
    category: ['category', 'type'],
    merchant_category_code: ['mcc', 'merchant category', 'merchant category code'],
    memo: ['memo', 'notes', 'note'],
    _charge_column: ['charge', 'charges', 'debit', 'debits', 'purchases', 'amount out', 'withdrawal'],
    _payment_column: ['payment', 'payments', 'credit', 'credits', 'payments/credits', 'amount in', 'deposit'],
    _withdrawal_column: ['withdrawal', 'withdrawals', 'debit', 'debits', 'amount out', 'money out', 'paid out'],
    _deposit_column: ['deposit', 'deposits', 'credit', 'credits', 'amount in', 'money in', 'paid in'],
    amount: ['amount', 'value', 'total'],
  };

  const normalize = (s: string) => s.toLowerCase().replace(/[_\s\-/#().]+/g, '');

  const matchAlias = (target: string, sourceCols: string[]): string => {
    const aliases = HEADER_ALIASES[target] ?? [target];
    const normAliases = aliases.map(normalize);
    // Exact alias match
    for (const src of sourceCols) {
      const n = normalize(src);
      if (normAliases.includes(n)) return src;
    }
    // Alias contained in header
    for (const src of sourceCols) {
      const n = normalize(src);
      if (normAliases.some(a => a && (n === a || n.startsWith(a) || n.endsWith(a)))) return src;
    }
    return '';
  };

  // Detect whether the currently active sheet looks like a credit card statement.
  const detectStatementType = (): 'bank' | 'creditcard' => {
    const cols = (activeSheet?.columns ?? []).map(normalize);
    const src = (activeSheet?.sourceFile ?? '').toLowerCase();
    const hasCharge = cols.some(c => ['charge', 'charges', 'purchases'].includes(c));
    const hasPayment = cols.some(c => ['payment', 'payments', 'paymentscredits'].includes(c));
    if (hasCharge && hasPayment) return 'creditcard';
    if (/credit|visa|mastercard|amex|americanexpress|card|statement-?\d/.test(src)) return 'creditcard';
    if (cols.includes('posteddate') && cols.includes('transactiondate')) return 'creditcard';
    return 'bank';
  };

  const activeSheet = sheets[activeSheetIndex];

  // AI formula resolver (=AI, =CLASSIFY, =EXPLAIN, =PREDICT, =ANALYZE, =GENERATE_JE, etc.)
  const aiFormula = useAIFormula({
    columns: activeSheet?.columns ?? [],
    sampleRows: (activeSheet?.rows ?? []).slice(0, 5),
  });

  // Initialize with provided data
  useEffect(() => {
    if (initialData.length > 0 && initialColumns.length > 0) {
      setSheets([{
        name: 'Sheet1',
        columns: initialColumns,
        rows: initialData,
        formulaColumns: {},
        sourceFile,
        sourceType: sourceFile?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'excel',
      }]);
    }
  }, [initialData, initialColumns, sourceFile]);

  // Focus input when editing
  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
    }
  }, [editingCell]);

  // Auto-scroll AI messages
  useEffect(() => {
    if (aiPanelOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiMessages, aiPanelOpen]);

  // Apply a structured action returned by Alice
  const applySheetAction = (action: SheetAction) => {
    const p = action.params || {};
    // Deep clone the active sheet to prevent mutation bugs when chaining actions
    const newSheets = sheets.map((s, i) =>
      i === activeSheetIndex
        ? { ...s, columns: [...s.columns], rows: s.rows.map(r => ({ ...r })), formulaColumns: { ...(s.formulaColumns || {}) } }
        : s
    );
    const sheet = newSheets[activeSheetIndex];

    switch (action.action) {
      case 'sort': {
        if (!p.column) break;
        const dir = p.direction || 'asc';
        setSortColumn(p.column);
        setSortDirection(dir);
        sheet.rows.sort((a, b) => {
          const aVal = a[p.column!] ?? '';
          const bVal = b[p.column!] ?? '';
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return dir === 'asc' ? aVal - bVal : bVal - aVal;
          }
          return dir === 'asc'
            ? String(aVal).localeCompare(String(bVal))
            : String(bVal).localeCompare(String(aVal));
        });
        setSheets(newSheets);
        toast.success(`✓ Sorted by "${p.column}" (${dir})`);
        break;
      }
      case 'filter': {
        if (!p.column || p.operator === undefined) break;
        pushUndo(sheet.rows);
        const filterVal = p.value;
        sheet.rows = sheet.rows.filter(row => {
          const cellVal = row[p.column!];
          const numCell = Number(cellVal);
          const numFilter = Number(filterVal);
          switch (p.operator) {
            case 'eq': return String(cellVal) === String(filterVal);
            case 'neq': return String(cellVal) !== String(filterVal);
            case 'gt': return numCell > numFilter;
            case 'gte': return numCell >= numFilter;
            case 'lt': return numCell < numFilter;
            case 'lte': return numCell <= numFilter;
            case 'contains': return String(cellVal).toLowerCase().includes(String(filterVal).toLowerCase());
            default: return true;
          }
        });
        setSheets(newSheets);
        toast.success(`✓ Filter applied — ${sheet.rows.length} rows match`);
        break;
      }
      case 'add_row': {
        const newRow: SheetRow = {};
        sheet.columns.forEach(col => { newRow[col] = p.values?.[col] ?? ''; });
        sheet.rows.push(newRow);
        setSheets(newSheets);
        toast.success('✓ New row added');
        break;
      }
      case 'add_column': {
        const colName = p.name || p.target_column || 'New Column';
        if (!sheet.columns.includes(colName)) {
          sheet.columns.push(colName);
        }
        if (p.expression) {
          // Store as live formula column
          if (!sheet.formulaColumns) sheet.formulaColumns = {};
          const fExpr = p.expression.startsWith('=') ? p.expression : `=${p.expression}`;
          sheet.formulaColumns[colName] = fExpr;
        }
        setSheets(newSheets);
        toast.success(`✓ Column "${colName}" added`);
        break;
      }
      case 'rename_column': {
        if (!p.from || !p.to) break;
        const colIdx = sheet.columns.indexOf(p.from);
        if (colIdx !== -1) {
          sheet.columns[colIdx] = p.to;
          sheet.rows = sheet.rows.map(row => {
            const newRow = { ...row };
            newRow[p.to!] = newRow[p.from!];
            delete newRow[p.from!];
            return newRow;
          });
          // Migrate formula columns
          if (sheet.formulaColumns?.[p.from!]) {
            sheet.formulaColumns[p.to!] = sheet.formulaColumns[p.from!];
            delete sheet.formulaColumns[p.from!];
          }
        }
        setSheets(newSheets);
        toast.success(`✓ Column renamed to "${p.to}"`);
        break;
      }
      case 'fill_formula': {
        const targetCol = p.target_column || p.name;
        if (!targetCol || !p.expression) break;
        if (!sheet.columns.includes(targetCol)) sheet.columns.push(targetCol);
        // Store as live reactive formula
        if (!sheet.formulaColumns) sheet.formulaColumns = {};
        const fExpr = p.expression.startsWith('=') ? p.expression : `=${p.expression}`;
        sheet.formulaColumns[targetCol] = fExpr;
        setSheets(newSheets);
        toast.success(`✓ Formula "${fExpr}" applied to "${targetCol}"`);
        break;
      }
      case 'summarize': {
        const aggCol = p.aggregate_column;
        const groupBy = p.group_by;
        const op = p.operation || 'sum';
        if (!aggCol) break;

        const summaryRows: SheetRow[] = [];
        if (groupBy) {
          const groups: Record<string, SheetRow[]> = {};
          sheet.rows.forEach(row => {
            const key = String(row[groupBy] ?? 'Other');
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
          });
          Object.entries(groups).forEach(([key, rows]) => {
            const vals = rows.map(r => Number(r[aggCol]) || 0);
            let result = 0;
            switch (op) {
              case 'sum': result = vals.reduce((a, b) => a + b, 0); break;
              case 'count': result = vals.length; break;
              case 'avg': result = vals.reduce((a, b) => a + b, 0) / vals.length; break;
              case 'min': result = Math.min(...vals); break;
              case 'max': result = Math.max(...vals); break;
            }
            summaryRows.push({ [groupBy]: key, [`${op}_${aggCol}`]: Math.round(result * 100) / 100 });
          });
        } else {
          const vals = sheet.rows.map(r => Number(r[aggCol]) || 0);
          let result = 0;
          switch (op) {
            case 'sum': result = vals.reduce((a, b) => a + b, 0); break;
            case 'count': result = vals.length; break;
            case 'avg': result = vals.reduce((a, b) => a + b, 0) / vals.length; break;
            case 'min': result = Math.min(...vals); break;
            case 'max': result = Math.max(...vals); break;
          }
          summaryRows.push({ metric: `${op} of ${aggCol}`, value: Math.round(result * 100) / 100 });
        }

        const summaryCols = summaryRows.length > 0 ? Object.keys(summaryRows[0]) : [];
        setSheets([...sheets, {
          name: `Summary_${aggCol}`,
          columns: summaryCols,
          rows: summaryRows,
          formulaColumns: {},
          sourceType: 'manual',
        }]);
        setActiveSheetIndex(sheets.length);
        toast.success(`✓ Summary created in new sheet`);
        break;
      }
      case 'set_rows': {
        const newRows = p.rows;
        const newCols = p.columns;
        if (!newRows || !Array.isArray(newRows) || newRows.length === 0) {
          toast.error('Alice returned no rows to post.');
          break;
        }
        pushUndo(sheet.rows);
        sheet.rows = newRows as SheetRow[];
        if (newCols && newCols.length > 0) {
          sheet.columns = newCols;
        } else if (newRows.length > 0) {
          sheet.columns = Object.keys(newRows[0] as object);
        }
        sheet.formulaColumns = {};
        setSheets(newSheets);
        toast.success(`✓ ${newRows.length} rows posted to the sheet`);
        break;
      }
      case 'create_sheet': {
        const newRows = (p.rows || []) as SheetRow[];
        const newCols = p.columns || (newRows.length > 0 ? Object.keys(newRows[0] as object) : []);
        const sheetName = p.sheet_name || `Alice_${Date.now()}`;
        const newSheet: AISheetData = {
          name: sheetName,
          columns: newCols,
          rows: newRows,
          formulaColumns: {},
          sourceType: 'manual',
        };
        const updatedSheets = [...newSheets, newSheet];
        setSheets(updatedSheets);
        setActiveSheetIndex(updatedSheets.length - 1);
        toast.success(`✓ Sheet "${sheetName}" created with ${newRows.length} rows`);
        break;
      }
      default: break;
    }
  };

  const buildSheetContext = (): SheetContext => ({
    activeSheetName: activeSheet.name,
    columns: activeSheet.columns,
    rowCount: activeSheet.rows.length,
    sampleRows: activeSheet.rows.slice(0, 50),
  });

  // ---- analyzeSheet helper ----
  const analyzeSheet = (sheet: AISheetData) => {
    const cols = sheet.columns;
    const rows = sheet.rows;
    const dateHints = ['date', 'month', 'year', 'period', 'quarter'];
    const catHints = ['category', 'type', 'class', 'group', 'department', 'name', 'product', 'item', 'description', 'status'];

    // Is the column truly numeric (>60% parseable values)?
    const isNumericCol = (col: string) => {
      if (rows.length === 0) return false;
      const sample = rows.slice(0, 20).filter(r => r[col] !== '' && r[col] != null);
      if (sample.length === 0) return false;
      return sample.filter(r => !isNaN(Number(r[col]))).length / sample.length > 0.6;
    };

    // Is the column a sequential integer index (1,2,3...N)?
    const isSequentialIndex = (col: string): boolean => {
      const vals = rows.map(r => Number(r[col])).filter(n => !isNaN(n) && n !== 0);
      if (vals.length < 3) return false;
      const sorted = [...vals].sort((a, b) => a - b);
      const allIntegers = sorted.every(n => Number.isInteger(n));
      const range = sorted[sorted.length - 1] - sorted[0] + 1;
      const isSeq = range <= vals.length * 1.15;
      return allIntegers && isSeq;
    };

    const allNumericCols = cols.filter(c => isNumericCol(c));
    // Separate index columns (used as X-axis) from value columns (charted as series)
    const indexCols = allNumericCols.filter(c => isSequentialIndex(c));
    const valueCols = allNumericCols.filter(c => !indexCols.includes(c));

    const dateColumns = cols.filter(c => dateHints.some(h => c.toLowerCase().includes(h)) && !isNumericCol(c));
    const categoricalColumns = cols.filter(c => !allNumericCols.includes(c) && !dateColumns.includes(c));

    // X-axis: prefer a named date/period column, fall back to sequential index
    const primaryDateCol = dateColumns[0] || null;
    const xAxisCol: string | null = primaryDateCol || indexCols[0] || null;

    const primaryCatCol = categoricalColumns.find(c => catHints.some(h => c.toLowerCase().includes(h))) || categoricalColumns[0] || null;
    const primaryNumCol = valueCols[0] || allNumericCols[0] || null;
    const secondaryNumCol = valueCols[1] || allNumericCols[1] || null;

    // KPI stats — value cols only (exclude index/sequence cols)
    const kpiCols = valueCols.length > 0 ? valueCols : allNumericCols;
    const kpis = kpiCols.slice(0, 4).map(col => {
      const vals = rows.map(r => Number(r[col]) || 0);
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = vals.length ? sum / vals.length : 0;
      const min = vals.length ? Math.min(...vals) : 0;
      const max = vals.length ? Math.max(...vals) : 0;
      return { col, sum, avg, min, max };
    });

    // Multi-line data: one entry per X-axis value, each value col = a line series
    let multiLineData: { name: string; [key: string]: string | number }[] = [];
    if (xAxisCol && valueCols.length > 0) {
      const seen = new Set<string>();
      rows.forEach(r => {
        const key = String(r[xAxisCol] ?? '');
        if (!seen.has(key) && key !== '') {
          seen.add(key);
          const entry: { name: string; [key: string]: string | number } = { name: key };
          valueCols.slice(0, 4).forEach(col => {
            entry[col] = Number(r[col]) || 0;
          });
          multiLineData.push(entry);
        }
      });
    }

    // Bar/Pie chart data (categorical grouping vs primary value col)
    let barData: { name: string; value: number }[] = [];
    if (primaryCatCol && primaryNumCol) {
      const groups: Record<string, number> = {};
      rows.forEach(r => {
        const key = String(r[primaryCatCol] ?? 'Other');
        groups[key] = (groups[key] || 0) + (Number(r[primaryNumCol]) || 0);
      });
      barData = Object.entries(groups)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
    }

    // Pie: top-5 + Other
    let pieData: { name: string; value: number }[] = [];
    if (barData.length > 0) {
      const top5 = barData.slice(0, 5);
      const otherSum = barData.slice(5).reduce((a, b) => a + b.value, 0);
      pieData = otherSum > 0 ? [...top5, { name: 'Other', value: Math.round(otherSum * 100) / 100 }] : top5;
    }

    // Scatter: only when no xAxisCol and 2+ truly independent numeric value cols
    let scatterData: { x: number; y: number }[] = [];
    if (!xAxisCol && primaryNumCol && secondaryNumCol) {
      scatterData = rows.slice(0, 60).map(r => ({
        x: Number(r[primaryNumCol]) || 0,
        y: Number(r[secondaryNumCol]) || 0,
      }));
    }

    return {
      kpis, barData, pieData, scatterData, multiLineData,
      valueCols, xAxisCol, primaryNumCol, secondaryNumCol, primaryCatCol, primaryDateCol
    };
  };

  const handleSummarize = async () => {
    setIsSummarizing(true);
    // aiSend returns SheetAction | null; for summarize we just need the message from Alice's response
    // We send the message and capture what Alice says via a reply_only response
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alice-sheets-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Give me a concise statistical summary: total rows, sum/avg/min/max for each numeric column, top categories if applicable, and 2-3 key insights.' }],
            sheetContext: buildSheetContext(),
          }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.result?.message) setSummaryText(data.result.message);
      }
    } catch (err) {
      console.error('Summarize error:', err);
    }
    setIsSummarizing(false);
  };

  const handleClearCurrentSheet = () => {
    pushUndo(activeSheet.rows);
    const newSheets = sheets.map((s, i) =>
      i === activeSheetIndex
        ? { name: s.name, columns: ['A', 'B', 'C', 'D', 'E'], rows: [], formulaColumns: {}, sourceType: 'manual' as const }
        : s
    );
    setSheets(newSheets);
    aiClear();
    setSummaryText('');
    setChartsOpen(false);
    setChartTypeOverride(null);
    setClearDialogOpen(false);
    toast.success(`Sheet "${activeSheet.name}" cleared`);
  };

  const handleClearAllSheets = () => {
    pushUndo(activeSheet.rows);
    setSheets([{ name: 'Sheet1', columns: ['A', 'B', 'C', 'D', 'E'], rows: [], formulaColumns: {}, sourceType: 'manual' }]);
    setActiveSheetIndex(0);
    setSelectedSheetsToMerge([]);
    setMergeDialogOpen(false);
    aiClear();
    setSummaryText('');
    setChartsOpen(false);
    setChartTypeOverride(null);
    setClearDialogOpen(false);
    toast.success('All sheets cleared');
  };

  // Reset chart type override when switching sheets
  useEffect(() => {
    setChartTypeOverride(null);
  }, [activeSheetIndex]);

  // Suggested prompts based on column names
  const getSuggestedPrompts = () => {
    const cols = activeSheet.columns;
    const prompts: string[] = [];
    const numericHints = ['amount', 'total', 'price', 'value', 'cost', 'balance', 'quantity', 'qty'];
    const dateHints = ['date', 'month', 'year', 'period'];
    const catHints = ['category', 'type', 'class', 'group', 'department'];

    const numCol = cols.find(c => numericHints.some(h => c.toLowerCase().includes(h)));
    const dateCol = cols.find(c => dateHints.some(h => c.toLowerCase().includes(h)));
    const catCol = cols.find(c => catHints.some(h => c.toLowerCase().includes(h)));

    if (numCol) {
      prompts.push(`Sort by ${numCol} descending`);
      prompts.push(`Sum all ${numCol}s`);
      prompts.push(`Filter rows where ${numCol} > 0`);
    }
    if (catCol && numCol) {
      prompts.push(`Summarize ${numCol} by ${catCol}`);
    }
    if (dateCol && numCol) {
      prompts.push(`Summarize ${numCol} by ${dateCol}`);
    }
    prompts.push('Add a totals row');
    prompts.push('Remove duplicate rows');
    if (cols.length > 0) prompts.push(`Rename column "${cols[0]}" to something better`);

    return prompts.slice(0, 5);
  };

  const handleAiSend = async () => {
    const text = chatInput.trim();
    if (!text || aiLoading) return;
    setChatInput('');
    const attachments = chatAttachments;
    setChatAttachments([]);
    const combinedContext = attachments.length > 0
      ? attachments.map(a => a.context).join('\n\n---\n\n')
      : null;
    const action = await aiSend(text, buildSheetContext(), combinedContext);
    if (action) {
      applySheetAction(action);
    }
  };

  const processOneAttachment = async (file: File): Promise<{ name: string; context: string } | null> => {
    const isPdf = file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('maxPages', '50');
      formData.append('useAI', 'true');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pdf-to-spreadsheet`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: formData,
        }
      );

      if (!response.ok) return null;

      const result = await response.json();
      if (result.success && result.rows?.length > 0) {
        const header = result.columns.join(' | ');
        const rowsText = result.rows.slice(0, 200).map((r: Record<string, unknown>) =>
          result.columns.map((c: string) => String(r[c] ?? '')).join(' | ')
        ).join('\n');
        const context = `## Attached file: "${file.name}"\n\nColumns: ${header}\n\nData (${result.rows.length} rows):\n${header}\n${rowsText}`;
        return { name: file.name, context };
      }
      return null;
    } else {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      if (jsonRows.length === 0) return null;
      const cols = Object.keys(jsonRows[0]);
      const header = cols.join(' | ');
      const rowsText = jsonRows.slice(0, 200).map(r =>
        cols.map(c => String(r[c] ?? '')).join(' | ')
      ).join('\n');
      const context = `## Attached file: "${file.name}"\n\nColumns: ${header}\n\nData (${jsonRows.length} rows):\n${header}\n${rowsText}`;
      return { name: file.name, context };
    }
  };

  const handleChatAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    // Cap at 10 files
    const selectedFiles = files.slice(0, 10);
    if (files.length > 10) {
      toast.warning('Maximum 10 files per batch. Only the first 10 will be processed.');
    }

    setIsAttaching(true);
    try {
      const results = await Promise.all(selectedFiles.map(f => processOneAttachment(f)));
      const successful = results.filter((r): r is { name: string; context: string } => r !== null);

      if (successful.length === 0) {
        toast.error('No data could be extracted from the selected files.');
      } else {
        setChatAttachments(prev => [...prev, ...successful]);
        toast.success(`📎 ${successful.length} file${successful.length > 1 ? 's' : ''} attached — ask Alice what to do!`);
      }
    } catch (err) {
      console.error('Chat attach error:', err);
      toast.error('Failed to read the attached files.');
    } finally {
      setIsAttaching(false);
    }
  };

  const handleUndoLastAction = () => {
    const prevRows = popUndo();
    if (prevRows) {
      const newSheets = [...sheets];
      newSheets[activeSheetIndex].rows = prevRows;
      setSheets(newSheets);
      toast.success('↩ Last action undone');
    } else {
      toast.info('Nothing to undo');
    }
  };

  const handleCellClick = (rowIndex: number, col: string) => {
    setSelectedCell({ row: rowIndex, col });
  };

  const handleCellDoubleClick = (rowIndex: number, col: string) => {
    setEditingCell({ row: rowIndex, col });
    // Show formula expression in edit box if it's a formula column
    const formula = activeSheet.formulaColumns?.[col];
    setEditValue(formula ?? String(activeSheet.rows[rowIndex]?.[col] ?? ''));
  };

  const handleCellBlur = () => {
    if (editingCell) {
      const newSheets = [...sheets];
      if (!newSheets[activeSheetIndex].rows[editingCell.row]) {
        newSheets[activeSheetIndex].rows[editingCell.row] = {};
      }
      const val = editValue.trim();
      if (val.startsWith('=')) {
        // Store formula definition; clear raw value so display uses formula engine
        if (!newSheets[activeSheetIndex].formulaColumns) {
          newSheets[activeSheetIndex].formulaColumns = {};
        }
        newSheets[activeSheetIndex].formulaColumns[editingCell.col] = val;
        // Remove raw value so the cell is driven by formula
        delete newSheets[activeSheetIndex].rows[editingCell.row][editingCell.col];
      } else {
        // Plain value — clear any existing formula for this column
        if (newSheets[activeSheetIndex].formulaColumns?.[editingCell.col]) {
          delete newSheets[activeSheetIndex].formulaColumns[editingCell.col];
        }
        newSheets[activeSheetIndex].rows[editingCell.row][editingCell.col] = editValue;
      }
      setSheets(newSheets);
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const addRow = () => {
    const newSheets = [...sheets];
    const newRow: SheetRow = {};
    activeSheet.columns.forEach(col => {
      newRow[col] = '';
    });
    newSheets[activeSheetIndex].rows.push(newRow);
    setSheets(newSheets);
  };

  const addColumn = () => {
    const newSheets = [...sheets];
    const colNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let newColName = `Col${activeSheet.columns.length + 1}`;
    for (let i = 0; i < 26; i++) {
      const name = colNames[i];
      if (!activeSheet.columns.includes(name)) {
        newColName = name;
        break;
      }
    }
    newSheets[activeSheetIndex].columns.push(newColName);
    setSheets(newSheets);
  };

  const deleteRow = (rowIndex: number) => {
    const newSheets = [...sheets];
    newSheets[activeSheetIndex].rows.splice(rowIndex, 1);
    setSheets(newSheets);
    setSelectedCell(null);
  };

  const deleteColumn = (col: string) => {
    const newSheets = [...sheets];
    newSheets[activeSheetIndex].columns = activeSheet.columns.filter(c => c !== col);
    newSheets[activeSheetIndex].rows = activeSheet.rows.map(row => {
      const newRow = { ...row };
      delete newRow[col];
      return newRow;
    });
    setSheets(newSheets);
  };

  const sortByColumn = (col: string) => {
    const direction = sortColumn === col && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(col);
    setSortDirection(direction);

    const newSheets = [...sheets];
    newSheets[activeSheetIndex].rows.sort((a, b) => {
      const aVal = a[col] ?? '';
      const bVal = b[col] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return direction === 'asc' 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    setSheets(newSheets);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as SheetRow[];

      if (jsonData.length > 0) {
        const columns = Object.keys(jsonData[0]);
        setSheets([...sheets, {
          name: file.name.replace(/\.[^/.]+$/, ''),
          columns,
          rows: jsonData,
          formulaColumns: {},
          sourceFile: file.name,
          sourceType: file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'excel',
        }]);
        setActiveSheetIndex(sheets.length);
        toast.success(`Loaded ${jsonData.length} rows from ${file.name}`);
      }
    } catch (err) {
      toast.error('Failed to parse file');
      console.error(err);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportToExcel = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(activeSheet.rows);
      const wb = XLSX.utils.book_new();
      // Excel sheet names must be <= 31 characters
      const sheetName = activeSheet.name.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${activeSheet.name}.xlsx`);
      toast.success('Exported to Excel');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Failed to export to Excel');
    }
  };

  const exportToCsv = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(activeSheet.rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${activeSheet.name}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Exported to CSV');
    } catch (error) {
      console.error('CSV export error:', error);
      toast.error('Failed to export to CSV');
    }
  };

  const copySelectedCell = () => {
    if (selectedCell) {
      const value = String(activeSheet.rows[selectedCell.row]?.[selectedCell.col] ?? '');
      navigator.clipboard.writeText(value);
      toast.success('Copied to clipboard');
    }
  };

  const openMappingDialog = (target: 'bank' | 'creditcard') => {
    setImportTarget(target);
    const targetCols = target === 'bank' ? bankTargetColumns : creditCardTargetColumns;
    const sourceCols = activeSheet.columns;
    // Alias-based auto-map with fallback to name-similarity
    const autoMappings: ColumnMapping[] = targetCols.map(tc => {
      let match = matchAlias(tc, sourceCols);
      if (!match) {
        const tcN = tc.replace(/^_/, '').replace(/_/g, '');
        match = sourceCols.find(sc => {
          const n = normalize(sc);
          return n.includes(tcN) || tcN.includes(n);
        }) || '';
      }
      return { sourceColumn: match, targetColumn: tc };
    });
    setColumnMappings(autoMappings);
    setMappingDialogOpen(true);
  };

  const toNum = (v: unknown): number => {
    if (v === null || v === undefined || v === '') return 0;
    const n = Number(String(v).replace(/[$,\s()]/g, '').replace(/^-?/, m => m));
    // Handle parentheses as negative
    const s = String(v);
    const isParenNeg = /^\s*\(.*\)\s*$/.test(s);
    const parsed = Number.isFinite(n) ? n : 0;
    return isParenNeg ? -Math.abs(parsed) : parsed;
  };

  const handleImportWithMapping = () => {
    if (!importTarget || activeSheet.rows.length === 0) return;

    // Transform data based on mappings
    const mappedData = activeSheet.rows.map(row => {
      const newRow: SheetRow = {};
      columnMappings.forEach(m => {
        if (m.sourceColumn && m.targetColumn) {
          newRow[m.targetColumn] = row[m.sourceColumn];
        }
      });
      return newRow;
    });

    if (importTarget === 'bank') {
      if (onImportToBank) {
        onImportToBank(mappedData, columnMappings);
        toast.success(`Imported ${mappedData.length} rows to bank transactions`);
      } else if (effectiveBankAccountId) {
        const mappedTransactions = mappedData
          .map(tx => {
            const withdrawal = toNum(tx._withdrawal_column);
            const deposit = toNum(tx._deposit_column);
            const rawAmount = toNum(tx.amount);
            let amount = 0;
            let transaction_type: 'deposit' | 'withdrawal' = 'deposit';
            if (Math.abs(withdrawal) > 0 || Math.abs(deposit) > 0) {
              if (Math.abs(withdrawal) > 0) {
                amount = Math.abs(withdrawal);
                transaction_type = 'withdrawal';
              } else {
                amount = Math.abs(deposit);
                transaction_type = 'deposit';
              }
            } else {
              amount = Math.abs(rawAmount);
              transaction_type = rawAmount >= 0 ? 'deposit' : 'withdrawal';
            }
            if (amount === 0) return null;
            const transactionDate = String(tx.transaction_date || tx.date || new Date().toISOString().split('T')[0]);
            const payeePayor = tx.payee_payor ?? tx.merchant_name ?? tx.merchant ?? tx.payee ?? tx.payor ?? null;
            return {
              bank_account_id: effectiveBankAccountId,
              gl_account_id: effectiveBankGlAccountId || null,
              transaction_date: transactionDate,
              description: String(tx.description || ''),
              amount,
              transaction_type,
              payee_payor: payeePayor ? String(payeePayor) : null,
              reference: tx.reference ? String(tx.reference) : null,
              category: tx.category ? String(tx.category) : null,
              memo: tx.memo ? String(tx.memo) : null,
            };
          })
          .filter((t): t is NonNullable<typeof t> => t !== null);
        if (mappedTransactions.length === 0) {
          toast.error('No valid rows to import (all amounts are zero or empty)');
          return;
        }
        importBankTx.mutate(mappedTransactions);
        toast.success(`Imported ${mappedTransactions.length} rows to bank transactions`);
      } else {
        toast.error('No bank account found. Please create a bank account first.');
        return;
      }
    } else if (importTarget === 'creditcard') {
      if (onImportToCreditCard) {
        onImportToCreditCard(mappedData, columnMappings);
        toast.success(`Imported ${mappedData.length} rows to credit card transactions`);
      } else if (effectiveCreditCardId) {
        const mappedTransactions = mappedData
          .map(tx => {
            const charge = toNum(tx._charge_column);
            const payment = toNum(tx._payment_column);
            const rawAmount = toNum(tx.amount);
            let amount = 0;
            let transaction_type: 'charge' | 'payment' = 'charge';
            if (Math.abs(charge) > 0 || Math.abs(payment) > 0) {
              if (Math.abs(charge) > 0) {
                amount = Math.abs(charge);
                transaction_type = 'charge';
              } else {
                amount = Math.abs(payment);
                transaction_type = 'payment';
              }
            } else {
              amount = Math.abs(rawAmount);
              transaction_type = rawAmount >= 0 ? 'charge' : 'payment';
            }
            if (amount === 0) return null;
            const transactionDate = String(tx.transaction_date || tx.date || new Date().toISOString().split('T')[0]);
            const payeePayor = tx.payee_payor ?? tx.merchant_name ?? tx.merchant ?? tx.payee ?? tx.payor ?? null;
            const postedDate = String(tx.posted_date ?? tx.posting_date ?? '') || null;
            return {
              credit_card_id: effectiveCreditCardId,
              transaction_date: transactionDate,
              posted_date: postedDate,
              description: String(tx.description || ''),
              amount,
              transaction_type,
              payee_payor: payeePayor ? String(payeePayor) : null,
              reference: tx.reference ? String(tx.reference) : null,
              category: tx.category ? String(tx.category) : null,
              merchant_category_code: tx.merchant_category_code ? String(tx.merchant_category_code) : null,
              memo: tx.memo ? String(tx.memo) : null,
              is_cleared: false,
              cleared_at: null,
              gl_account_id: effectiveCreditCardGlAccountId || null,
              journal_entry_id: null,
              status: 'pending' as const,
              imported_at: new Date().toISOString(),
            };
          })
          .filter((t): t is NonNullable<typeof t> => t !== null);
        if (mappedTransactions.length === 0) {
          toast.error('No valid rows to import (all amounts are zero or empty)');
          return;
        }
        importCcTx.mutate(mappedTransactions);
        toast.success(`Imported ${mappedTransactions.length} rows to credit card transactions`);
      } else {
        toast.error('No credit card found. Please add a credit card first.');
        return;
      }
    }
    setMappingDialogOpen(false);
  };


  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file');
      return;
    }

    try {
      const result = await convertPdfToSpreadsheet(file, { maxPages: 500, useAI: true });
      if (result?.success && result.rows.length > 0) {
        setSheets([...sheets, {
          name: file.name.replace(/\.pdf$/i, ''),
          columns: result.columns,
          rows: result.rows,
          formulaColumns: {},
          sourceFile: file.name,
          sourceType: 'pdf',
        }]);
        setActiveSheetIndex(sheets.length);
        toast.success(`Extracted ${result.rows.length} rows from ${result.processedPages} pages`);
      } else {
        toast.error(result?.message || 'No data extracted from PDF');
      }
    } catch (err) {
      toast.error('Failed to process PDF');
      console.error(err);
    }

    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handleRenameColumn = () => {
    if (!columnToRename || !newColumnName.trim()) return;
    
    const newSheets = [...sheets];
    const colIndex = newSheets[activeSheetIndex].columns.indexOf(columnToRename);
    if (colIndex !== -1) {
      newSheets[activeSheetIndex].columns[colIndex] = newColumnName.trim();
      // Update all row keys
      newSheets[activeSheetIndex].rows = newSheets[activeSheetIndex].rows.map(row => {
        const newRow = { ...row };
        if (columnToRename in newRow) {
          newRow[newColumnName.trim()] = newRow[columnToRename];
          delete newRow[columnToRename];
        }
        return newRow;
      });
      setSheets(newSheets);
      toast.success(`Column renamed to "${newColumnName.trim()}"`);
    }
    setRenameColumnDialogOpen(false);
    setColumnToRename(null);
    setNewColumnName('');
  };

  const openRenameDialog = (col: string) => {
    setColumnToRename(col);
    setNewColumnName(col);
    setRenameColumnDialogOpen(true);
  };

  const openMergeDialog = () => {
    setSelectedSheetsToMerge([]);
    setMergedSheetName(`Merged_${new Date().toISOString().split('T')[0]}`);
    setMergeDialogOpen(true);
  };

  const toggleSheetForMerge = (idx: number) => {
    setSelectedSheetsToMerge(prev => 
      prev.includes(idx) 
        ? prev.filter(i => i !== idx)
        : [...prev, idx]
    );
  };

  const handleMergeSheets = () => {
    if (selectedSheetsToMerge.length < 2) {
      toast.error('Select at least 2 sheets to merge');
      return;
    }

    // Collect all unique columns from selected sheets
    const allColumns = new Set<string>();
    selectedSheetsToMerge.forEach(idx => {
      sheets[idx].columns.forEach(col => allColumns.add(col));
    });
    const mergedColumns = Array.from(allColumns);

    // Merge all rows with source tracking
    const mergedRows: SheetRow[] = [];
    selectedSheetsToMerge.forEach(idx => {
      const sheet = sheets[idx];
      sheet.rows.forEach(row => {
        const newRow: SheetRow = { _source: sheet.name };
        mergedColumns.forEach(col => {
          newRow[col] = row[col] ?? '';
        });
        mergedRows.push(newRow);
      });
    });

    // Add _source to columns if not present
    const finalColumns = mergedColumns.includes('_source') 
      ? mergedColumns 
      : ['_source', ...mergedColumns];

    // Create merged sheet
    const mergedSheet: AISheetData = {
      name: mergedSheetName || 'Merged',
      columns: finalColumns,
      rows: mergedRows,
      formulaColumns: {},
      sourceType: 'manual',
      sourceFile: `Merged from ${selectedSheetsToMerge.length} sheets`,
    };

    setSheets([...sheets, mergedSheet]);
    setActiveSheetIndex(sheets.length);
    setMergeDialogOpen(false);
    toast.success(`Merged ${mergedRows.length} rows from ${selectedSheetsToMerge.length} sheets`);
  };

  const addNewSheet = () => {
    setSheets([...sheets, {
      name: `Sheet${sheets.length + 1}`,
      columns: ['A', 'B', 'C', 'D', 'E'],
      rows: [],
      formulaColumns: {},
      sourceType: 'manual',
    }]);
    setActiveSheetIndex(sheets.length);
  };

  const deleteSheet = (idx: number) => {
    if (sheets.length <= 1) {
      toast.error('Cannot delete the last sheet');
      return;
    }
    const sheetName = sheets[idx].name;
    const newSheets = sheets.filter((_, i) => i !== idx);
    setSheets(newSheets);
    // Adjust active index if needed
    if (activeSheetIndex >= newSheets.length) {
      setActiveSheetIndex(newSheets.length - 1);
    } else if (activeSheetIndex > idx) {
      setActiveSheetIndex(activeSheetIndex - 1);
    }
    toast.success(`Deleted sheet "${sheetName}"`);
  };

  if (!isOpen) return null;

  const suggestedPrompts = getSuggestedPrompts();

  return (
    <div
      className={cn(
        "fixed z-50 bg-card border border-border rounded-xl shadow-2xl flex flex-col transition-all duration-300",
        isFullscreen 
          ? "inset-4" 
          : "bottom-6 right-6 w-[900px] h-[600px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 rounded-t-xl flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Table className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">AI Sheets</h3>
            <p className="text-xs text-muted-foreground">
              {activeSheet.sourceFile ? `Source: ${activeSheet.sourceFile}` : 'Spreadsheet Editor'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Ask Alice toggle */}
          <Button
            variant={aiPanelOpen ? 'default' : 'outline'}
            size="sm"
            className={cn("h-8 gap-1.5 text-xs", aiPanelOpen && "bg-primary text-primary-foreground")}
            onClick={() => setAiPanelOpen(!aiPanelOpen)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask Alice
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT: Spreadsheet area */}
        <div className={cn("flex flex-col flex-1 min-w-0 min-h-0 transition-all duration-300", aiPanelOpen && "border-r border-border")}>

      {/* PDF Conversion Progress */}
      {isPdfConverting && progress && (
        <div className="px-4 py-2 bg-primary/5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-xs font-medium">Extracting data from PDF with AI...</span>
          </div>
          <Progress value={progress.current} className="h-1.5" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileUpload}
        />
        <input
          ref={pdfInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handlePdfUpload}
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <FileUp className="h-4 w-4 mr-1" />
              Import
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => pdfInputRef.current?.click()}>
              <FileText className="h-4 w-4 mr-2 text-destructive" />
              <div className="flex flex-col">
                <span>PDF (AI Extract)</span>
                <span className="text-[10px] text-muted-foreground">Up to 500 pages</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <FileSpreadsheet className="h-4 w-4 mr-2 text-success" />
              Excel / CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={exportToExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export as Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToCsv}>
              <Table className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6" />

        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" />
          Add Row
        </Button>

        <Button variant="outline" size="sm" onClick={addColumn}>
          <Plus className="h-4 w-4 mr-1" />
          Add Column
        </Button>

        <Button variant="outline" size="sm" onClick={() => {
          setFormulaColName('');
          setFormulaExpression('');
          setFormulaPreview('');
          setFormulaDialogOpen(true);
        }}>
          <FunctionSquare className="h-4 w-4 mr-1" />
          Formula Column
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Charts toggle */}
        <Button
          variant={chartsOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setChartsOpen(!chartsOpen)}
        >
          <BarChart2 className="h-4 w-4 mr-1" />
          Charts
        </Button>

        {/* Clear button */}
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive border-destructive/30"
          onClick={() => setClearDialogOpen(true)}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Clear
        </Button>

        {sheets.length >= 2 && (
          <Button variant="outline" size="sm" onClick={openMergeDialog}>
            <Combine className="h-4 w-4 mr-1" />
            Merge Sheets
          </Button>
        )}

        {selectedCell && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="sm" onClick={copySelectedCell}>
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-destructive"
              onClick={() => deleteRow(selectedCell.row)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Row
            </Button>
          </>
        )}

        <div className="flex-1" />

        {/* Import to banking actions with mapping */}
        {activeSheet.rows.length > 0 && (onImportToBank || onImportToCreditCard || effectiveBankAccountId || effectiveCreditCardId) && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="default"
              size="sm"
              className="bg-primary"
              onClick={() => openMappingDialog(detectStatementType())}
              title="Auto-detects credit card vs bank statement"
            >
              <Upload className="h-4 w-4 mr-1" />
              Post to Banking
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" title="Manual mapping">
                  <Columns className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(onImportToBank || effectiveBankAccountId) && (
                  <DropdownMenuItem onClick={() => openMappingDialog('bank')}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Map to Bank Statement
                  </DropdownMenuItem>
                )}
                {(onImportToCreditCard || effectiveCreditCardId) && (
                  <DropdownMenuItem onClick={() => openMappingDialog('creditcard')}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Map to Credit Card
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Sheet Tabs */}
      <div className="flex items-center gap-1 px-4 py-1 border-b border-border bg-muted/30 overflow-x-auto">
        {sheets.map((sheet, idx) => (
          <div
            key={idx}
            className={cn(
              "group flex items-center gap-1 px-3 py-1 text-xs rounded-t transition-colors",
              idx === activeSheetIndex
                ? "bg-background border-t border-x border-border font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <button
              onClick={() => setActiveSheetIndex(idx)}
              className="flex items-center gap-1"
            >
              {sheet.name}
              {sheet.sourceType && (
                <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                  {sheet.sourceType}
                </Badge>
              )}
            </button>
            {sheets.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSheet(idx);
                }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
                title={`Delete ${sheet.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addNewSheet}
          className="p-1 text-muted-foreground hover:text-foreground"
          title="Add new sheet"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Cell Reference Bar */}
      {selectedCell && (
        <div className="flex items-center gap-2 px-4 py-1 border-b border-border bg-muted/20 text-xs">
          <Badge variant="secondary" className="font-mono">
            {selectedCell.col}{selectedCell.row + 1}
          </Badge>
          {activeSheet.formulaColumns?.[selectedCell.col] ? (
            <>
              <span className="text-primary font-semibold font-mono">fx</span>
              <span className="font-mono text-primary text-xs">
                {activeSheet.formulaColumns[selectedCell.col]}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {String(activeSheet.rows[selectedCell.row]?.[selectedCell.col] ?? '')}
            </span>
          )}
        </div>
      )}

      {/* Charts & Dashboard Panel */}
      {chartsOpen && (() => {
        const hasData = activeSheet.rows.length > 0;
        return (
          <div className="border-b border-border bg-muted/20 flex-shrink-0 overflow-y-auto" style={{ maxHeight: '380px' }}>
            <div className="border-b border-border bg-background/80 sticky top-0 z-10">
              <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-1.5">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold">Charts & Summary</span>
                  {hasData && <span className="text-[10px] text-muted-foreground">({activeSheet.rows.length} rows)</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSummarize} disabled={isSummarizing || !hasData || aiLoading}>
                    {isSummarizing ? <span className="animate-pulse">Analyzing…</span> : <><TrendingUp className="h-3 w-3 mr-1" />Summarize</>}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setChartsOpen(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {hasData && (
                <div className="flex items-center gap-1 px-4 pb-2">
                  {(['line', 'bar', 'pie', 'scatter'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setChartTypeOverride(prev => prev === type ? null : type)}
                      className={[
                        'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                        chartTypeOverride === type
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      ].join(' ')}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                  {chartTypeOverride === null && (
                    <span className="ml-1 text-[10px] text-muted-foreground italic">Auto</span>
                  )}
                </div>
              )}
            </div>
            {!hasData ? (
              <div className="p-6 text-center text-muted-foreground text-xs">No data to visualize. Import a file or ask Alice to generate data.</div>
            ) : (() => {
              const LINE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4'];
              const { kpis, barData, pieData, scatterData, multiLineData, valueCols, xAxisCol, primaryNumCol, secondaryNumCol, primaryCatCol } = analyzeSheet(activeSheet);
              const tickInterval = multiLineData.length > 0 ? Math.max(0, Math.ceil(multiLineData.length / 12) - 1) : 0;
              const fmtY = (v: number) => v >= 10000 ? `${(v / 1000).toFixed(1)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));

              // Determine effective chart type: override takes precedence over auto-detection
              const effectiveType = chartTypeOverride ?? (
                multiLineData.length > 1 && valueCols.length > 0 ? 'line' :
                barData.length > 0 ? 'bar' :
                pieData.length > 0 ? 'pie' :
                scatterData.length > 1 ? 'scatter' : null
              );

              // Synthesize fallback data for forced overrides
              const rows = activeSheet.rows;

              // Fallback line data: use row index as X when no xAxisCol
              const fallbackLineData = xAxisCol ? multiLineData : (() => {
                if (valueCols.length === 0) return [];
                return rows.slice(0, 100).map((r, i) => {
                  const entry: { name: string; [k: string]: string | number } = { name: String(i + 1) };
                  valueCols.slice(0, 4).forEach(col => { entry[col] = Number(r[col]) || 0; });
                  return entry;
                });
              })();

              // Fallback bar/pie data: use first string col as category, or row index
              const fallbackBarData = barData.length > 0 ? barData : (() => {
                if (valueCols.length === 0) return [];
                const catCol = primaryCatCol || activeSheet.columns.find(c => rows.some(r => typeof r[c] === 'string' && isNaN(Number(r[c]))));
                const numCol = primaryNumCol || valueCols[0];
                if (!numCol) return [];
                const grouped: Record<string, number> = {};
                rows.forEach((r, i) => {
                  const key = catCol ? String(r[catCol] ?? `Row ${i + 1}`) : `Row ${i + 1}`;
                  grouped[key] = (grouped[key] || 0) + (Number(r[numCol]) || 0);
                });
                return Object.entries(grouped).slice(0, 10).map(([name, value]) => ({ name, value }));
              })();
              const fallbackPieData = pieData.length > 0 ? pieData : fallbackBarData.slice(0, 5);

              // Fallback scatter data: valueCols[0] vs valueCols[1]
              const fallbackScatterData = scatterData.length > 1 ? scatterData : (() => {
                if (valueCols.length < 2) return [];
                return rows.slice(0, 100).map(r => ({
                  x: Number(r[valueCols[0]]) || 0,
                  y: Number(r[valueCols[1]]) || 0,
                })).filter(p => p.x !== 0 || p.y !== 0);
              })();

              const effectivePrimaryNumCol = primaryNumCol || valueCols[0] || '';
              const effectiveSecondaryNumCol = secondaryNumCol || valueCols[1] || '';
              const effectivePrimaryCatCol = primaryCatCol || (activeSheet.columns.find(c => rows.some(r => typeof r[c] === 'string' && isNaN(Number(r[c])))) ?? '');

              return (
                <div className="p-4 space-y-5">
                  {summaryText && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs leading-relaxed">
                      <p className="text-[10px] font-semibold text-primary mb-1 uppercase tracking-wide">AI Summary</p>
                      <span dangerouslySetInnerHTML={{ __html: summaryText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br/>') }} />
                    </div>
                  )}

                  {/* KPI tiles — always visible */}
                  {kpis.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {kpis.map(({ col, sum, avg, min, max }) => (
                        <div key={col} className="rounded-xl border border-border bg-muted/30 p-3 hover:bg-muted/50 transition-colors">
                          <p className="text-[10px] font-semibold text-muted-foreground truncate uppercase tracking-wide">{col}</p>
                          <p className="text-base font-bold mt-0.5 tabular-nums">{sum >= 1000 ? sum.toLocaleString(undefined, { maximumFractionDigits: 0 }) : sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                          <div className="mt-1.5 text-[10px] text-muted-foreground space-y-0.5">
                            <div>Avg <span className="font-medium text-foreground">{avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                            <div>Min <span className="font-medium text-foreground">{min.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span> · Max <span className="font-medium text-foreground">{max.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Single chart block based on effectiveType */}
                  {effectiveType === 'line' && (() => {
                    const data = fallbackLineData;
                    const xLabel = xAxisCol || 'Row';
                    const interval = Math.max(0, Math.ceil(data.length / 12) - 1);
                    if (data.length < 2 || valueCols.length === 0) return (
                      <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Not enough data for a line chart.</div>
                    );
                    return (
                      <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs font-semibold text-foreground mb-0.5">{valueCols.slice(0, 4).join(' · ')}</p>
                        <p className="text-[10px] text-muted-foreground mb-3">over {xLabel} · {data.length} periods</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 48, left: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={interval} />
                            <YAxis tick={{ fontSize: 10 }} width={56} tickFormatter={fmtY} />
                            <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} formatter={(v, name) => [Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }), name]} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                            {valueCols.slice(0, 4).map((col, i) => (
                              <Line key={col} type="monotone" dataKey={col} stroke={LINE_COLORS[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}

                  {effectiveType === 'bar' && (() => {
                    const data = fallbackBarData;
                    if (data.length === 0) return (
                      <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Not enough data for a bar chart.</div>
                    );
                    return (
                      <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs font-semibold text-foreground mb-0.5">{effectivePrimaryCatCol || 'Category'} by {effectivePrimaryNumCol}</p>
                        <p className="text-[10px] text-muted-foreground mb-3">Top {data.length} categories</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 44, left: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                            <YAxis tick={{ fontSize: 10 }} width={52} tickFormatter={fmtY} />
                            <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} formatter={(v) => [Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }), effectivePrimaryNumCol]} />
                            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}

                  {effectiveType === 'pie' && (() => {
                    const data = fallbackPieData;
                    if (data.length === 0) return (
                      <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Not enough data for a pie chart.</div>
                    );
                    return (
                      <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs font-semibold text-foreground mb-0.5">Distribution</p>
                        <p className="text-[10px] text-muted-foreground mb-3">Top {data.length} by {effectivePrimaryNumCol}</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={72} innerRadius={30}
                              label={({ name, percent }) => `${String(name).slice(0, 9)} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {data.map((_, index) => <Cell key={`cell-${index}`} fill={LINE_COLORS[index % LINE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} formatter={(v) => [Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}

                  {effectiveType === 'scatter' && (() => {
                    const data = fallbackScatterData;
                    if (data.length < 2 || !effectivePrimaryNumCol || !effectiveSecondaryNumCol) return (
                      <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Not enough data for a scatter chart (need 2+ numeric columns).</div>
                    );
                    return (
                      <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs font-semibold text-foreground mb-0.5">{effectivePrimaryNumCol} vs {effectiveSecondaryNumCol}</p>
                        <p className="text-[10px] text-muted-foreground mb-3">Correlation — {data.length} data points</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="x" name={effectivePrimaryNumCol} tick={{ fontSize: 10 }} tickFormatter={fmtY} label={{ value: effectivePrimaryNumCol, position: 'insideBottom', offset: -4, fontSize: 10 }} />
                            <YAxis dataKey="y" name={effectiveSecondaryNumCol} tick={{ fontSize: 10 }} width={56} tickFormatter={fmtY} />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                            <Scatter data={data} fill="hsl(var(--primary))" opacity={0.65} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}

                  {/* Empty state when no chart type matches */}
                  {effectiveType === null && (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      Not enough structured data for charts. Add more rows or categorical columns.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Spreadsheet Grid */}
      <ScrollArea className="flex-1">
        <div className="min-w-max">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="w-10 p-2 border-r border-b border-border text-center text-xs font-medium text-muted-foreground">
                  #
                </th>
                {activeSheet.columns.map(col => (
                  <th key={col} className="min-w-[120px] border-r border-b border-border">
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="font-medium text-xs">{col}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => sortByColumn(col)}
                          className="p-0.5 hover:bg-muted rounded"
                        >
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-0.5 hover:bg-muted rounded">
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => sortByColumn(col)}>
                              <ArrowUpDown className="h-4 w-4 mr-2" />
                              Sort
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openRenameDialog(col)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Rename Column
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => deleteColumn(col)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Column
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSheet.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeSheet.columns.length + 1}
                    className="p-8 text-center text-muted-foreground"
                  >
                    <FileSpreadsheet className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No data yet</p>
                    <p className="text-xs">Import a file or add rows manually</p>
                  </td>
                </tr>
              ) : (
                activeSheet.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-muted/30">
                    <td className="w-10 p-2 border-r border-b border-border text-center text-xs text-muted-foreground bg-muted/30">
                      {rowIndex + 1}
                    </td>
                    {activeSheet.columns.map(col => (
                      <td
                        key={col}
                        onClick={() => handleCellClick(rowIndex, col)}
                        onDoubleClick={() => handleCellDoubleClick(rowIndex, col)}
                        className={cn(
                          "min-w-[120px] p-0 border-r border-b border-border cursor-pointer transition-colors",
                          selectedCell?.row === rowIndex && selectedCell?.col === col
                            ? "bg-primary/10 ring-2 ring-primary ring-inset"
                            : "hover:bg-muted/50"
                        )}
                      >
                        {editingCell?.row === rowIndex && editingCell?.col === col ? (
                          <Input
                            ref={cellInputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyDown}
                            className="h-8 border-0 rounded-none focus-visible:ring-0 text-xs"
                          />
                        ) : (
                          <div className={cn(
                            "px-2 py-1.5 text-xs truncate max-w-[200px]",
                            activeSheet.formulaColumns?.[col] && "text-primary font-mono"
                          )}>
                            {activeSheet.formulaColumns?.[col]
                              ? (aiFormula.isAIFormula(activeSheet.formulaColumns[col])
                                ? String(aiFormula.resolve(activeSheet.formulaColumns[col], row))
                                : formatFormulaValue(evaluateFormula(activeSheet.formulaColumns[col], {
                                    row,
                                    allRows: activeSheet.rows,
                                    columns: activeSheet.columns,
                                  })))
                              : String(row[col] ?? '')}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
        <span>
          {activeSheet.rows.length} rows × {activeSheet.columns.length} columns
        </span>
        <div className="flex items-center gap-2">
          {activeSheet.sourceType && (
            <Badge variant="outline" className="text-[10px]">
              {activeSheet.sourceType.toUpperCase()}
            </Badge>
          )}
          <span>Ready</span>
        </div>
      </div>
        </div>{/* END left column */}

        {/* RIGHT: Alice AI Conversation Panel */}
        {aiPanelOpen && (
          <div className="w-[340px] flex-shrink-0 flex flex-col bg-background/50 backdrop-blur-sm">
            {/* Panel header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <img src={aliceAvatar} alt="Alice" className="w-7 h-7 rounded-full flex-shrink-0 border border-accent/30" />
                <div>
                  <p className="text-xs font-semibold">AI Sheets Mode</p>
                  <p className="text-[10px] text-muted-foreground">Alice · Spreadsheet AI</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Clear conversation" onClick={aiClear}>
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAiPanelOpen(false)}>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-3">
                {aiMessages.map((msg) => (
                  <div key={msg.id} className={cn("flex gap-2", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {msg.role === 'assistant' && (
                      <img src={aliceAvatar} alt="Alice" className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5 border border-accent/30" />
                    )}
                    <div className={cn(
                      "max-w-[230px] rounded-xl px-3 py-2 text-xs leading-relaxed",
                      msg.role === 'user'
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    )}>
                      {/* Render basic markdown bold/italic */}
                      <span
                        dangerouslySetInnerHTML={{
                          __html: msg.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            .replace(/\n/g, '<br/>')
                            .replace(/- (.*?)(<br\/>|$)/g, '• $1$2')
                        }}
                      />
                      {msg.action && msg.action.action !== 'reply_only' && (
                        <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center gap-1 text-[10px] opacity-70">
                          <Check className="h-3 w-3" />
                          {(msg.action.action === 'set_rows' || msg.action.action === 'create_sheet')
                            ? `${msg.action.params?.rows?.length ?? 0} rows posted to spreadsheet`
                            : 'Action applied'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex gap-2 justify-start">
                    <img src={aliceAvatar} alt="Alice" className="w-6 h-6 rounded-full flex-shrink-0 border border-accent/30" />
                    <div className="bg-muted rounded-xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Suggested prompts */}
            {!aiLoading && suggestedPrompts.length > 0 && (
              <div className="px-3 pb-2 flex-shrink-0">
                <div className="flex flex-wrap gap-1">
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setChatInput(prompt);
                      }}
                      className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                    >
                      {prompt}
                    </button>
                  ))}
                  {/* Undo chip if undo stack has items */}
                </div>
              </div>
            )}

            {/* Undo button */}
            <div className="px-3 pb-1 flex-shrink-0">
              <button
                onClick={handleUndoLastAction}
                className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors border border-border flex items-center gap-1"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Undo last action
              </button>
            </div>

            {/* Input bar */}
            <div className="p-3 border-t border-border flex-shrink-0">
              {/* Hidden file input for chat attachments */}
              <input
                ref={chatAttachInputRef}
                type="file"
                accept=".pdf,.csv,.xlsx,.xls"
                multiple
                className="hidden"
                onChange={handleChatAttach}
              />

              {/* Attachment chips */}
              {(chatAttachments.length > 0 || isAttaching) && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {chatAttachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20">
                      <FileText className="h-3 w-3 text-primary flex-shrink-0" />
                      <span className="text-[10px] text-primary truncate max-w-[120px]">{att.name}</span>
                      <button
                        onClick={() => setChatAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {isAttaching && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20">
                      <FileText className="h-3 w-3 text-primary flex-shrink-0" />
                      <span className="text-[10px] text-primary animate-pulse">Extracting files…</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <Textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAiSend();
                      }
                    }}
                    placeholder="Ask Alice to sort, filter, summarize…"
                    className="w-full min-h-[60px] max-h-[100px] text-xs resize-none pr-8"
                    disabled={aiLoading}
                  />
                  {/* Paperclip attach button inside textarea */}
                  <button
                    type="button"
                    onClick={() => chatAttachInputRef.current?.click()}
                    disabled={aiLoading || isAttaching}
                    title="Attach a file for Alice to analyze (PDF, Excel, CSV)"
                    className={cn(
                      "absolute bottom-2 right-2 p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors",
                      chatAttachments.length > 0 && "text-primary",
                      (aiLoading || isAttaching) && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleAiSend}
                    disabled={aiLoading || (!chatInput.trim() && chatAttachments.length === 0)}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    title="Voice input (coming soon)"
                    disabled
                  >
                    <Mic className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Enter to send · Shift+Enter for new line · 📎 Attach PDF/Excel</p>
            </div>
          </div>
        )}
      </div>{/* END two-column body */}

      {/* Column Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Columns className="h-5 w-5" />
              Map Columns for {importTarget === 'bank' ? 'Bank' : 'Credit Card'} Import
            </DialogTitle>
            <DialogDescription>
              Map your spreadsheet columns to the target statement fields.
            </DialogDescription>
          </DialogHeader>
          
          {/* Account Selection */}
          <div className="pb-3 border-b border-border">
            <Label className="text-sm font-medium mb-2 block">
              Target {importTarget === 'bank' ? 'Bank Account' : 'Credit Card'}
            </Label>
            {importTarget === 'bank' ? (
              <Select
                value={selectedBankAccountId || effectiveBankAccountId || ''}
                onValueChange={(val) => setSelectedBankAccountId(val)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select bank account..." />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  {bankAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{account.name}</span>
                        {account.account_number && (
                          <span className="text-muted-foreground text-xs">
                            ···{account.account_number.slice(-4)}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={selectedCreditCardId || effectiveCreditCardId || ''}
                onValueChange={(val) => setSelectedCreditCardId(val)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select credit card..." />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border z-50">
                  {creditCards.map(card => (
                    <SelectItem key={card.id} value={card.id}>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{card.name}</span>
                        {card.card_number && (
                          <span className="text-muted-foreground text-xs">
                            ···{card.card_number.slice(-4)}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div className="max-h-[350px] overflow-y-auto space-y-3 py-3">
            {columnMappings.map((mapping, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    {mapping.targetColumn.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Label>
                  <Select
                    value={mapping.sourceColumn || '__skip__'}
                    onValueChange={(val) => {
                      const newMappings = [...columnMappings];
                      newMappings[idx].sourceColumn = val === '__skip__' ? '' : val;
                      setColumnMappings(newMappings);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50">
                      <SelectItem value="__skip__">-- Skip --</SelectItem>
                      {activeSheet.columns.map(col => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportWithMapping}>
              <Upload className="h-4 w-4 mr-1" />
              Import {activeSheet.rows.length} Rows
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Column Dialog */}
      <Dialog open={renameColumnDialogOpen} onOpenChange={setRenameColumnDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Column</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>New Column Name</Label>
            <Input
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameColumn()}
              className="mt-1"
              placeholder="Enter column name..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameColumnDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameColumn}>
              <Check className="h-4 w-4 mr-1" />
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Sheets Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Combine className="h-5 w-5" />
              Merge Sheets
            </DialogTitle>
            <DialogDescription>
              Select sheets to combine into a single merged sheet. All rows will be appended with a source column.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label>Merged Sheet Name</Label>
              <Input
                value={mergedSheetName}
                onChange={(e) => setMergedSheetName(e.target.value)}
                className="mt-1"
                placeholder="Enter name for merged sheet..."
              />
            </div>
            <div>
              <Label className="mb-2 block">Select Sheets to Merge</Label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-2">
                {sheets.map((sheet, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleSheetForMerge(idx)}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-md text-sm transition-colors",
                      selectedSheetsToMerge.includes(idx)
                        ? "bg-primary/10 border border-primary"
                        : "bg-muted/50 hover:bg-muted border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      <span className="font-medium">{sheet.name}</span>
                      {sheet.sourceType && (
                        <Badge variant="outline" className="text-[10px]">
                          {sheet.sourceType}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {sheet.rows.length} rows
                      </span>
                      {selectedSheetsToMerge.includes(idx) && (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Selected: {selectedSheetsToMerge.length} sheets 
                ({selectedSheetsToMerge.reduce((sum, idx) => sum + (sheets[idx]?.rows.length ?? 0), 0)} total rows)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleMergeSheets}
              disabled={selectedSheetsToMerge.length < 2}
            >
              <Combine className="h-4 w-4 mr-1" />
              Merge {selectedSheetsToMerge.length} Sheets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Formula Column Dialog */}
      <Dialog open={formulaDialogOpen} onOpenChange={(open) => { setFormulaDialogOpen(open); setFormulaSearch(''); setFormulaDropdownOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FunctionSquare className="h-5 w-5 text-primary" />
              Add Formula Column
            </DialogTitle>
            <DialogDescription>
              Create a computed column using an expression. Type column names directly, e.g. <code className="font-mono text-xs bg-muted px-1 rounded">=Price * Quantity</code> or <code className="font-mono text-xs bg-muted px-1 rounded">=SUM(Amount)</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Column Name</Label>
              <Input
                value={formulaColName}
                onChange={e => setFormulaColName(e.target.value)}
                className="mt-1 font-mono"
                placeholder="e.g. Total"
              />
            </div>

            {/* Formula Function Lookup */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Formula Expression</Label>
                <button
                  type="button"
                  onClick={() => { setFormulaDropdownOpen(v => !v); setFormulaSearch(''); }}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <FunctionSquare className="h-3 w-3" />
                  Browse functions
                </button>
              </div>

              {/* Searchable formula dropdown */}
              {formulaDropdownOpen && (
                <div className="mb-2 border border-border rounded-md bg-popover shadow-lg z-50">
                  <div className="p-2 border-b border-border">
                    <Input
                      autoFocus
                      value={formulaSearch}
                      onChange={e => setFormulaSearch(e.target.value)}
                      placeholder="Search functions… e.g. SUM, IF, ROUND"
                      className="h-7 text-xs font-mono"
                    />
                  </div>
                  <ScrollArea className="h-52">
                    {(() => {
                      const term = formulaSearch.toLowerCase();
                      const filtered = FORMULA_CATALOG.filter(f =>
                        f.name.toLowerCase().includes(term) ||
                        f.desc.toLowerCase().includes(term) ||
                        f.category.toLowerCase().includes(term)
                      );
                      if (filtered.length === 0) return (
                        <div className="py-6 text-center text-xs text-muted-foreground">No functions found</div>
                      );
                      let lastCat = '';
                      return filtered.map(fn => {
                        const showHeader = fn.category !== lastCat;
                        lastCat = fn.category;
                        return (
                          <div key={fn.name}>
                            {showHeader && (
                              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40 border-b border-border/50">
                                {fn.category}
                              </div>
                            )}
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors group"
                              onClick={() => {
                                // Insert function template at cursor or append
                                const prefix = formulaExpression.trim().startsWith('=') || formulaExpression === ''
                                  ? formulaExpression
                                  : `=${formulaExpression}`;
                                const insert = formulaExpression === '' ? `=${fn.syntax}` : `${prefix}${fn.syntax}`;
                                setFormulaExpression(insert);
                                setFormulaDropdownOpen(false);
                                setFormulaSearch('');
                              }}
                            >
                              <div className="flex items-baseline gap-2">
                                <span className="font-mono text-xs font-semibold text-primary group-hover:text-primary">
                                  {fn.name}
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">
                                  {fn.syntax}
                                </span>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                                {fn.desc}
                              </div>
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </ScrollArea>
                </div>
              )}

              <Input
                value={formulaExpression}
                onChange={e => {
                  setFormulaExpression(e.target.value);
                  // Live preview using first row
                  if (activeSheet.rows.length > 0 && e.target.value.trim()) {
                    const expr = e.target.value.startsWith('=') ? e.target.value : `=${e.target.value}`;
                    try {
                      const preview = evaluateFormula(expr, {
                        row: activeSheet.rows[0],
                        allRows: activeSheet.rows,
                        columns: activeSheet.columns,
                      });
                      setFormulaPreview(preview);
                    } catch {
                      setFormulaPreview('#ERR');
                    }
                  } else {
                    setFormulaPreview('');
                  }
                }}
                className="font-mono"
                placeholder="=Price * Quantity"
              />
            </div>

            {formulaPreview !== '' && (
              <div className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/50 border border-border">
                <span className="text-muted-foreground">Preview (row 1):</span>
                <span className={cn(
                  "font-mono font-medium",
                  formulaPreview === '#ERR' ? "text-destructive" : "text-primary"
                )}>
                  {formatFormulaValue(formulaPreview)}
                </span>
              </div>
            )}
            {activeSheet.columns.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Available columns:</span>{' '}
                <span className="font-mono">{activeSheet.columns.join(', ')}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormulaDialogOpen(false); setFormulaDropdownOpen(false); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!formulaColName.trim() || !formulaExpression.trim()) return;
                const newSheets = [...sheets];
                const sheet = newSheets[activeSheetIndex];
                const colName = formulaColName.trim();
                if (!sheet.columns.includes(colName)) sheet.columns.push(colName);
                if (!sheet.formulaColumns) sheet.formulaColumns = {};
                const expr = formulaExpression.trim().startsWith('=')
                  ? formulaExpression.trim()
                  : `=${formulaExpression.trim()}`;
                sheet.formulaColumns[colName] = expr;
                setSheets(newSheets);
                setFormulaDialogOpen(false);
                setFormulaDropdownOpen(false);
                toast.success(`✓ Formula column "${colName}" created`);
              }}
              disabled={!formulaColName.trim() || !formulaExpression.trim()}
            >
              <FunctionSquare className="h-4 w-4 mr-1" />
              Add Formula Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Sheet AlertDialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Sheet Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently erase all rows and columns from <strong>{activeSheet.name}</strong>. This action can be undone once using Undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10" onClick={handleClearCurrentSheet}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Clear Current Sheet
            </Button>
            <Button variant="destructive" onClick={handleClearAllSheets}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All Sheets
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
