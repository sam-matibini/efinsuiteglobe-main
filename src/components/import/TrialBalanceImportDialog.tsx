import { useState, useRef, useMemo, useCallback } from 'react';
import { 
  Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X, FileText,
  ArrowRight, ArrowLeft, Settings2, Eye, Loader2, AlertTriangle, Link2,
  Building2, Globe, Calendar, DollarSign, ChevronDown, RefreshCw
} from 'lucide-react';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useImportBatches, useImportBatchRows, useAccountMatching, useImportMappingTemplates, useAccountAliases } from '@/hooks/useImportEngine';
import { useImportPosting } from '@/hooks/useImportPosting';
import { useAccounts } from '@/hooks/useAccounts';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';
import { 
  ImportType, 
  PostingMode, 
  FxSource, 
  ImportColumnMapping, 
  ParsedImportRow, 
  AccountSuggestion,
  ImportTargetField,
  IMPORT_TARGET_FIELDS 
} from '@/types/import';
import { cn } from '@/lib/utils';

type ImportStep = 'select' | 'upload' | 'mapping' | 'validation' | 'preview' | 'posting' | 'complete';

const SOURCE_SYSTEMS = [
  { value: 'quickbooks', label: 'QuickBooks' },
  { value: 'sage', label: 'Sage' },
  { value: 'xero', label: 'Xero' },
  { value: 'sap', label: 'SAP' },
  { value: 'oracle', label: 'Oracle' },
  { value: 'dynamics', label: 'Dynamics' },
  { value: 'freshbooks', label: 'FreshBooks' },
  { value: 'wave', label: 'Wave' },
  { value: 'zoho', label: 'Zoho Books' },
  { value: 'custom', label: 'Custom/Other' },
];

const IMPORT_TYPES: { value: ImportType; label: string; description: string }[] = [
  { value: 'trial_balance', label: 'Trial Balance', description: 'Import period-based trial balance' },
  { value: 'opening_balance', label: 'Opening Balance', description: 'Import prior-year opening balances' },
];

const POSTING_MODES: { value: PostingMode; label: string; description: string }[] = [
  { value: 'opening_balance', label: 'Opening Balance', description: 'Post directly to opening balances' },
  { value: 'journal_entry', label: 'Journal Entry', description: 'Create journal entries for each entity' },
];

const FX_SOURCES: { value: FxSource; label: string }[] = [
  { value: 'source', label: 'Use source file FX rates' },
  { value: 'system', label: 'Use system FX tables' },
  { value: 'manual', label: 'Manual entry' },
];

interface TrialBalanceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function TrialBalanceImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: TrialBalanceImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { organization } = useCurrentOrganization();
  const { formatCurrency } = useCurrencyFormatter();
  
  // State
  const [step, setStep] = useState<ImportStep>('select');
  const [importType, setImportType] = useState<ImportType>('trial_balance');
  const [postingMode, setPostingMode] = useState<PostingMode>('journal_entry');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear().toString());
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('CAD');
  const [sourceCurrency, setSourceCurrency] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [fxSource, setFxSource] = useState<FxSource>('source');
  const [sourceSystem, setSourceSystem] = useState('custom');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ImportColumnMapping[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  
  // Hooks
  const { createBatch, updateBatch } = useImportBatches();
  const { rows: importRows, insertRows, refetch: refetchRows } = useImportBatchRows(batchId);
  const { matchAccounts } = useAccountMatching();
  const { templates, createTemplate } = useImportMappingTemplates();
  const { aliases } = useAccountAliases();
  const { data: accountsData } = useAccounts(organization?.id);
  const accounts = accountsData || [];
  const { postImportBatch } = useImportPosting();

  // Computed values
  const validRows = useMemo(() => importRows.filter(r => r.is_valid), [importRows]);
  const invalidRows = useMemo(() => importRows.filter(r => !r.is_valid), [importRows]);
  const matchedRows = useMemo(() => importRows.filter(r => r.matched_account_id), [importRows]);
  const unmatchedRows = useMemo(() => importRows.filter(r => !r.matched_account_id), [importRows]);

  const totals = useMemo(() => {
    const debit = importRows.reduce((sum, r) => sum + (r.debit_amount || 0), 0);
    const credit = importRows.reduce((sum, r) => sum + (r.credit_amount || 0), 0);
    return { debit, credit, difference: Math.abs(debit - credit) };
  }, [importRows]);

  const isBalanced = totals.difference < 0.01;

  // File parsing
  const parseFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      // IMPORTANT: include blank cells so we don't “lose” columns (e.g., Credit) when the first data row is empty.
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];

      if (jsonData.length === 0) {
        toast.error('No data found in file');
        return;
      }

      // Get column headers
      const columns = Object.keys(jsonData[0]);
      setSourceColumns(columns);
      setParsedData(jsonData);
      
      // Auto-detect column mappings
      const autoMappings = autoDetectMappings(columns);
      setColumnMappings(autoMappings);
      
      toast.success(`Loaded ${jsonData.length} rows from ${file.name}`);
    } catch (err) {
      console.error('Parse error:', err);
      toast.error('Failed to parse file');
    }
  };

  const autoDetectMappings = (columns: string[]): ImportColumnMapping[] => {
    const mappings: ImportColumnMapping[] = [];
    const normalizedColumns = columns.map(c => c.toLowerCase().replace(/[_\s-]/g, ''));
    
    const patterns: Record<ImportTargetField, string[]> = {
      account_code: ['accountcode', 'acctcode', 'code', 'accountno', 'accountnumber', 'glcode', 'account'],
      account_name: ['accountname', 'acctname', 'name', 'description', 'accountdescription', 'gldescription'],
      debit: ['debit', 'dr', 'debitamount', 'debits'],
      credit: ['credit', 'cr', 'creditamount', 'credits'],
      balance: ['balance', 'netbalance', 'amount', 'closingbalance', 'endingbalance'],
      currency: ['currency', 'curr', 'currencycode'],
      department: ['department', 'dept', 'departmentcode'],
      cost_center: ['costcenter', 'cc', 'costcentre'],
      project: ['project', 'projectcode', 'fund', 'fundcode'],
      location: ['location', 'loc', 'locationcode'],
      program: ['program', 'programcode'],
      fund: ['fund', 'fundcode'],
    };

    for (const [target, keywords] of Object.entries(patterns)) {
      const matchIndex = normalizedColumns.findIndex(col => 
        keywords.some(kw => col.includes(kw))
      );
      
      if (matchIndex >= 0) {
        mappings.push({
          id: crypto.randomUUID(),
          sourceColumn: columns[matchIndex],
          targetField: target as ImportTargetField,
          transform: 'none',
        });
      }
    }

    return mappings;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    await parseFile(file);
    setStep('mapping');
  };

  // Create batch and process rows
  const processImport = async () => {
    if (!organization?.id) return;
    setIsProcessing(true);
    setErrors([]);
    setWarnings([]);

    try {
      // Create import batch
      const batch = await createBatch.mutateAsync({
        import_type: importType,
        posting_mode: postingMode,
        fiscal_year: fiscalYear,
        as_of_date: asOfDate,
        period_start: periodStart || undefined,
        period_end: periodEnd || undefined,
        base_currency: baseCurrency,
        source_currency: sourceCurrency || undefined,
        exchange_rate: exchangeRate,
        fx_source: fxSource,
        source_system: sourceSystem,
        original_filename: selectedFile?.name,
        file_size_bytes: selectedFile?.size,
      });

      setBatchId(batch.id);

      // Parse rows from file data using column mappings
      const parsedRows: ParsedImportRow[] = parsedData.map((row, idx) => {
        const getValue = (targetField: ImportTargetField): string | number | null => {
          const mapping = columnMappings.find(m => m.targetField === targetField);
          if (!mapping) return null;
          const value = row[mapping.sourceColumn];
          if (value === undefined || value === null) return null;
          return typeof value === 'number' ? value : String(value);
        };

        const parseAmount = (val: string | number | null): number => {
          if (val === null) return 0;
          if (typeof val === 'number') return val;
          // Handle accounting format (brackets as negative)
          let clean = val.replace(/[$,\s]/g, '');
          if (clean.startsWith('(') && clean.endsWith(')')) {
            clean = '-' + clean.slice(1, -1);
          }
          return parseFloat(clean) || 0;
        };

        const debit = parseAmount(getValue('debit'));
        const credit = parseAmount(getValue('credit'));
        const balance = parseAmount(getValue('balance'));
        
        // Normalize: if only balance provided, split into debit/credit based on sign
        let finalDebit = debit;
        let finalCredit = credit;
        if (debit === 0 && credit === 0 && balance !== 0) {
          if (balance > 0) {
            finalDebit = balance;
          } else {
            finalCredit = Math.abs(balance);
          }
        }

        return {
          rowNumber: idx + 1,
          rawData: row,
          accountCode: String(getValue('account_code') || ''),
          accountName: String(getValue('account_name') || ''),
          debit: finalDebit,
          credit: finalCredit,
          balance,
          currency: String(getValue('currency') || baseCurrency),
          department: String(getValue('department') || ''),
          costCenter: String(getValue('cost_center') || ''),
          project: String(getValue('project') || ''),
          fund: String(getValue('fund') || ''),
          location: String(getValue('location') || ''),
          program: String(getValue('program') || ''),
          errors: [],
          warnings: [],
        };
      });

      // Match accounts
      const accountList = accounts.map(a => ({
        id: a.id,
        code: a.code,
        name: a.name,
        account_type: a.account_type,
        is_header: a.is_header,
        posting_allowed: a.posting_allowed,
        parent_id: a.parent_id,
      }));

      const matchedRowsData = await matchAccounts(parsedRows, accountList, aliases);
      
      // Add batch_id to each row
      const rowsWithBatch = matchedRowsData.map(r => ({
        ...r,
        batch_id: batch.id,
      }));

      // Insert rows
      await insertRows.mutateAsync(rowsWithBatch);
      
      // Update batch with mapping config
      await updateBatch.mutateAsync({
        id: batch.id,
        column_mappings: columnMappings,
        status: 'validated',
        total_rows: parsedRows.length,
      });

      await refetchRows();
      setStep('validation');
    } catch (err: any) {
      console.error('Import error:', err);
      toast.error('Failed to process import: ' + err.message);
      setErrors([err.message]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Get batch for posting
  const getCurrentBatch = () => {
    return {
      id: batchId || '',
      organization_id: organization?.id || '',
      import_type: importType,
      posting_mode: postingMode,
      source_system: sourceSystem,
      fiscal_year: fiscalYear,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      as_of_date: asOfDate,
      base_currency: baseCurrency,
      source_currency: sourceCurrency || null,
      exchange_rate: exchangeRate,
      fx_source: fxSource,
      entity_id: null,
      country_id: null,
      original_filename: selectedFile?.name || null,
      file_hash: null,
      file_size_bytes: selectedFile?.size || null,
      total_rows: importRows.length,
      column_mappings: columnMappings,
      date_format: 'yyyy-mm-dd',
      number_format: 'standard',
      invert_signs: false,
      treat_brackets_as_negative: true,
      validation_status: 'valid' as const,
      validation_errors: [],
      validation_warnings: [],
      source_total_debits: totals.debit,
      source_total_credits: totals.credit,
      source_balance_difference: totals.difference,
      posted_total_debits: 0,
      posted_total_credits: 0,
      status: 'validated' as const,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      posted_at: null,
      posted_by: null,
      reversed_at: null,
      reversed_by: null,
      reversal_reason: null,
      journal_entry_ids: [],
      reversal_journal_entry_ids: [],
    };
  };

  // Post the import
  const handlePost = async () => {
    if (!batchId) return;
    setIsProcessing(true);

    try {
      await postImportBatch.mutateAsync({ 
        batch: getCurrentBatch(),
        rows: importRows 
      });
      setStep('complete');
      toast.success('Import posted successfully');
    } catch (err: any) {
      toast.error('Failed to post import: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedFile(null);
    setParsedData([]);
    setSourceColumns([]);
    setColumnMappings([]);
    setBatchId(null);
    setErrors([]);
    setWarnings([]);
    onOpenChange(false);
    if (step === 'complete') {
      onImportComplete?.();
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = `Account Code,Account Name,Debit,Credit,Currency,Department,Cost Center,Project
1-01-101-0001,Cash - Operating,50000.00,0.00,CAD,,Main,
1-01-110-0001,Accounts Receivable,25000.00,0.00,CAD,,Main,
2-01-201-0001,Accounts Payable,0.00,15000.00,CAD,,Main,
3-01-301-0001,Share Capital,0.00,40000.00,CAD,,Main,
3-01-310-0001,Retained Earnings,0.00,20000.00,CAD,,Main,
4-01-401-0001,Sales Revenue,0.00,0.00,CAD,,Main,
5-01-501-0001,Cost of Goods Sold,0.00,0.00,CAD,,Main,`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'trial_balance_import_template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Template downloaded');
  };

  const updateColumnMapping = (mappingId: string, targetField: ImportTargetField | '') => {
    setColumnMappings(prev => 
      prev.map(m => m.id === mappingId ? { ...m, targetField: targetField as ImportTargetField } : m)
    );
  };

  const addColumnMapping = (sourceColumn: string, targetField: ImportTargetField) => {
    setColumnMappings(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sourceColumn,
        targetField,
        transform: 'none',
      },
    ]);
  };

  const removeColumnMapping = (mappingId: string) => {
    setColumnMappings(prev => prev.filter(m => m.id !== mappingId));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Trial Balance / Opening Balances
          </DialogTitle>
          <DialogDescription>
            Import balances from external accounting systems
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-4">
          {['select', 'upload', 'mapping', 'validation', 'preview', 'complete'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                step === s ? "bg-primary text-primary-foreground" :
                ['select', 'upload', 'mapping', 'validation', 'preview', 'complete'].indexOf(step) > i 
                  ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {i + 1}
              </div>
              {i < 5 && <div className="w-8 h-0.5 bg-border mx-1" />}
            </div>
          ))}
        </div>

        <ScrollArea className="flex-1 pr-4">
          {/* Step 1: Select Import Type */}
          {step === 'select' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Import Type</Label>
                  <Select value={importType} onValueChange={(v) => setImportType(v as ImportType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMPORT_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <div>
                            <div className="font-medium">{t.label}</div>
                            <div className="text-xs text-muted-foreground">{t.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Posting Mode</Label>
                  <Select value={postingMode} onValueChange={(v) => setPostingMode(v as PostingMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSTING_MODES.map(m => (
                        <SelectItem key={m.value} value={m.value}>
                          <div>
                            <div className="font-medium">{m.label}</div>
                            <div className="text-xs text-muted-foreground">{m.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Fiscal Year</Label>
                  <Input 
                    value={fiscalYear} 
                    onChange={(e) => setFiscalYear(e.target.value)}
                    placeholder="2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label>As of Date</Label>
                  <Input 
                    type="date"
                    value={asOfDate} 
                    onChange={(e) => setAsOfDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Source System</Label>
                  <Select value={sourceSystem} onValueChange={setSourceSystem}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_SYSTEMS.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Period Start (Optional)</Label>
                  <Input 
                    type="date"
                    value={periodStart} 
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period End (Optional)</Label>
                  <Input 
                    type="date"
                    value={periodEnd} 
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Base Currency</Label>
                  <Input 
                    value={baseCurrency} 
                    onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
                    placeholder="CAD"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Source Currency (if different)</Label>
                  <Input 
                    value={sourceCurrency} 
                    onChange={(e) => setSourceCurrency(e.target.value.toUpperCase())}
                    placeholder="USD"
                  />
                </div>
                <div className="space-y-2">
                  <Label>FX Source</Label>
                  <Select value={fxSource} onValueChange={(v) => setFxSource(v as FxSource)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FX_SOURCES.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {fxSource === 'manual' && (
                <div className="space-y-2">
                  <Label>Exchange Rate</Label>
                  <Input 
                    type="number"
                    step="0.0001"
                    value={exchangeRate} 
                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                  />
                </div>
              )}

            </div>
          )}

          {/* Step 2: Upload File */}
          {step === 'upload' && (
            <div className="space-y-6">
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

              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.txt"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-foreground font-medium mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-muted-foreground">
                  CSV, Excel, or TXT files (max 10MB, up to 10k rows)
                </p>
              </div>

            </div>
          )}

          {/* Step 3: Column Mapping */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  <span className="font-medium">{selectedFile?.name}</span>
                  <Badge variant="secondary">{parsedData.length} rows</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep('upload');
                    setSelectedFile(null);
                    setParsedData([]);
                    setSourceColumns([]);
                    setColumnMappings([]);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <Card className="p-4">
                <h3 className="font-medium mb-4">Column Mappings</h3>
                <div className="space-y-3">
                  {sourceColumns.map(col => {
                    const mapping = columnMappings.find(m => m.sourceColumn === col);
                    return (
                      <div key={col} className="flex items-center gap-3">
                        <div className="w-48 text-sm font-mono bg-muted/50 px-2 py-1 rounded">
                          {col}
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        <Select 
                          value={mapping?.targetField || '__skip__'} 
                          onValueChange={(v) => {
                            if (v === '__skip__') {
                              if (mapping) {
                                removeColumnMapping(mapping.id);
                              }
                            } else if (mapping) {
                              updateColumnMapping(mapping.id, v as ImportTargetField);
                            } else {
                              addColumnMapping(col, v as ImportTargetField);
                            }
                          }}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select field..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__skip__">— Skip —</SelectItem>
                            <SelectGroup>
                              <SelectLabel className="text-xs text-muted-foreground">Required</SelectLabel>
                              {IMPORT_TARGET_FIELDS.filter(f => f.group === 'required').map(f => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.label} {f.required && '*'}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel className="text-xs text-muted-foreground">Amounts (Double-Entry)</SelectLabel>
                              {IMPORT_TARGET_FIELDS.filter(f => f.group === 'amounts').map(f => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel className="text-xs text-muted-foreground">Integration</SelectLabel>
                              {IMPORT_TARGET_FIELDS.filter(f => f.group === 'integration').map(f => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel className="text-xs text-muted-foreground">Dimensions</SelectLabel>
                              {IMPORT_TARGET_FIELDS.filter(f => f.group === 'dimensions').map(f => (
                                <SelectItem key={f.id} value={f.id}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        {mapping && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeColumnMapping(mapping.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Preview first few rows */}
              <Card className="p-4">
                <h3 className="font-medium mb-4">Data Preview</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {sourceColumns.slice(0, 6).map(col => (
                          <TableHead key={col} className="text-xs">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          {sourceColumns.slice(0, 6).map(col => (
                            <TableCell key={col} className="text-xs">
                              {String(row[col] || '')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parsedData.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ...and {parsedData.length - 5} more rows
                  </p>
                )}
              </Card>

            </div>
          )}

          {/* Step 4: Validation Results */}
          {step === 'validation' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Total Rows</p>
                  <p className="text-2xl font-bold">{importRows.length}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Matched</p>
                  <p className="text-2xl font-bold text-success">{matchedRows.length}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Unmatched</p>
                  <p className="text-2xl font-bold text-warning">{unmatchedRows.length}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Errors</p>
                  <p className="text-2xl font-bold text-destructive">{invalidRows.length}</p>
                </Card>
              </div>

              {/* Balance Check */}
              <Card className={cn(
                "p-4 border-2",
                isBalanced ? "border-success/50 bg-success/5" : "border-destructive/50 bg-destructive/5"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isBalanced ? (
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-destructive" />
                    )}
                    <span className="font-medium">
                      {isBalanced ? 'Trial Balance is balanced' : 'Trial Balance is NOT balanced'}
                    </span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Debits:</span>{' '}
                      <span className="font-mono">{formatCurrency(totals.debit)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Credits:</span>{' '}
                      <span className="font-mono">{formatCurrency(totals.credit)}</span>
                    </div>
                    {!isBalanced && (
                      <div>
                        <span className="text-muted-foreground">Difference:</span>{' '}
                        <span className="font-mono text-destructive">{formatCurrency(totals.difference)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Unmatched accounts */}
              {unmatchedRows.length > 0 && (
                <Card className="p-4">
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center justify-between w-full">
                      <h3 className="font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning" />
                        Unmatched Accounts ({unmatchedRows.length})
                      </h3>
                      <ChevronDown className="w-4 h-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4">
                      <div className="max-h-48 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Row</TableHead>
                              <TableHead>Account Code</TableHead>
                              <TableHead>Account Name</TableHead>
                              <TableHead>Debit</TableHead>
                              <TableHead>Credit</TableHead>
                              <TableHead>Suggestions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unmatchedRows.slice(0, 10).map(row => (
                              <TableRow key={row.id}>
                                <TableCell>{row.row_number}</TableCell>
                                <TableCell className="font-mono">{row.account_code}</TableCell>
                                <TableCell>{row.account_name}</TableCell>
                                <TableCell>{formatCurrency(row.debit_amount)}</TableCell>
                                <TableCell>{formatCurrency(row.credit_amount)}</TableCell>
                                <TableCell>
                                  {row.match_suggestions.length > 0 ? (
                                    <Badge variant="secondary">
                                      {row.match_suggestions.length} suggestions
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">None</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )}

            </div>
          )}

          {/* Step 5: Preview & Post */}
          {step === 'preview' && (
            <div className="space-y-6">
              <Card className="p-4">
                <h3 className="font-medium mb-4">Import Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Import Type:</span>{' '}
                    <span className="font-medium">{IMPORT_TYPES.find(t => t.value === importType)?.label}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Posting Mode:</span>{' '}
                    <span className="font-medium">{POSTING_MODES.find(m => m.value === postingMode)?.label}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fiscal Year:</span>{' '}
                    <span className="font-medium">{fiscalYear}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">As of Date:</span>{' '}
                    <span className="font-medium">{asOfDate}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Rows:</span>{' '}
                    <span className="font-medium">{importRows.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Currency:</span>{' '}
                    <span className="font-medium">{baseCurrency}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4 bg-success/5 border-success/20">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <h3 className="font-medium">Ready to Post</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Debits:</span>{' '}
                    <span className="font-mono font-medium">{formatCurrency(totals.debit)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Credits:</span>{' '}
                    <span className="font-mono font-medium">{formatCurrency(totals.credit)}</span>
                  </div>
                </div>
              </Card>

            </div>
          )}

          {/* Step 6: Complete */}
          {step === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 mx-auto text-success mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Import Complete!
              </h3>
              <p className="text-muted-foreground mb-6">
                Successfully imported {importRows.length} account balances
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button onClick={() => {
                  handleClose();
                  onImportComplete?.();
                }}>
                  View Trial Balance
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Fixed Footer Navigation */}
        {step !== 'complete' && (
          <div className="flex justify-between items-center pt-4 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => {
                if (step === 'select') {
                  handleClose();
                } else if (step === 'upload') {
                  setStep('select');
                } else if (step === 'mapping') {
                  setStep('upload');
                  setSelectedFile(null);
                  setParsedData([]);
                  setSourceColumns([]);
                  setColumnMappings([]);
                } else if (step === 'validation') {
                  setStep('mapping');
                } else if (step === 'preview') {
                  setStep('validation');
                }
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {step === 'select' ? 'Cancel' : 'Back'}
            </Button>
            
            {step === 'select' && (
              <Button onClick={() => setStep('upload')}>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            
            {step === 'upload' && (
              <Button disabled>
                Upload a file to continue
              </Button>
            )}
            
            {step === 'mapping' && (
              <Button 
                onClick={processImport}
                disabled={!columnMappings.some(m => m.targetField === 'account_code') || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Validate & Match
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}
            
            {step === 'validation' && (
              <Button 
                onClick={() => setStep('preview')}
                disabled={!isBalanced || unmatchedRows.length > 0}
              >
                Review & Post
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            
            {step === 'preview' && (
              <Button 
                onClick={handlePost}
                disabled={isProcessing}
                className="bg-success hover:bg-success/90"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Post Import
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
