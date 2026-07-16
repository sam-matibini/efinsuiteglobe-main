import { useState, useCallback, useRef } from 'react';
import { 
  FileUp, FileText, FileSpreadsheet, X, Upload, Loader2,
  CheckCircle, AlertCircle, FileSearch, Zap, Settings2,
  Building2, CreditCard, RefreshCw, ChevronRight, Brain,
  FolderOpen, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { usePdfToSpreadsheet } from '@/hooks/usePdfToSpreadsheet';
import { useMappingTemplates, MappingTemplate } from '@/hooks/useMappingTemplates';
import * as XLSX from 'xlsx';
import { AdvancedMappingEngine, MappingConfig, ColumnMappingAdvanced } from './AdvancedMappingEngine';
import { MappingPreviewDialog } from './MappingPreviewDialog';
import {
  useAliceSheetsWorkbooks,
  downloadAliceSheetsWorkbook,
} from '@/hooks/useAliceSheetsWorkbooks';

type ExtractionStep = 'upload' | 'extracting' | 'mapping' | 'preview' | 'complete';

interface UploadedFile {
  file: File;
  name: string;
  type: 'pdf' | 'csv' | 'xlsx' | 'xls';
  size: number;
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
  extractedRows?: number;
  extractedColumns?: string[];
  data?: Record<string, unknown>[];
  error?: string;
}

interface StatementExtractionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statementType: 'bank' | 'creditcard';
  onImport: (data: Record<string, unknown>[]) => void;
  bankAccountId?: string;
  creditCardId?: string;
}

export function StatementExtractionDialog({
  open,
  onOpenChange,
  statementType,
  onImport,
  bankAccountId,
  creditCardId,
}: StatementExtractionDialogProps) {
  const [step, setStep] = useState<ExtractionStep>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [useAI, setUseAI] = useState(true);
  const [maxPages, setMaxPages] = useState(500);
  const [extractedData, setExtractedData] = useState<Record<string, unknown>[]>([]);
  const [extractedColumns, setExtractedColumns] = useState<string[]>([]);
  const [mappingConfig, setMappingConfig] = useState<MappingConfig | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [sourceMode, setSourceMode] = useState<'file' | 'aisheets'>('file');
  const [selectedWorkbookPath, setSelectedWorkbookPath] = useState<string | null>(null);
  const [loadingWorkbook, setLoadingWorkbook] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { convertPdfToSpreadsheet, isConverting, progress } = usePdfToSpreadsheet();
  const { data: aliceWorkbooks = [], isLoading: workbooksLoading } =
    useAliceSheetsWorkbooks(open && sourceMode === 'aisheets');
  
  // Load templates from database
  const { 
    templates: dbTemplates, 
    isLoading: templatesLoading,
    createTemplate,
    deleteTemplate,
  } = useMappingTemplates(statementType);
  
  // Convert database templates to AdvancedMappingEngine format
  const engineTemplates = dbTemplates.map(t => {
    const normalizedMappings = (t.mappings || []).map((m: any) => {
      const targetField = m?.targetField;
      if (targetField === 'merchant_name' || targetField === 'merchant') {
        return { ...m, targetField: 'payee_payor' };
      }
      if (targetField === 'posting_date') {
        return { ...m, targetField: 'posted_date' };
      }
      return m;
    });

    return {
      id: t.id,
      name: t.name,
      statementType: t.statement_type,
      bankName: t.bank_name || undefined,
      mappings: normalizedMappings,
      dateFormat: t.date_format,
      numberFormat: t.number_format,
      invertSign: t.invert_sign,
      treatBracketsAsNegative: t.treat_brackets_as_negative,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      organizationId: t.organization_id,
    };
  });
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    const newFiles: UploadedFile[] = selectedFiles.map(file => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let type: UploadedFile['type'] = 'pdf';
      if (ext === 'csv') type = 'csv';
      else if (ext === 'xlsx') type = 'xlsx';
      else if (ext === 'xls') type = 'xls';
      
      return {
        file,
        name: file.name,
        type,
        size: file.size,
        status: 'pending',
        progress: 0,
      };
    });
    
    setFiles(prev => [...prev, ...newFiles]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);
  
  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  const processFiles = useCallback(async () => {
    setStep('extracting');
    
    const allData: Record<string, unknown>[] = [];
    let allColumns: Set<string> = new Set();
    
    for (let i = 0; i < files.length; i++) {
      const uploadedFile = files[i];
      
      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'processing', progress: 0 } : f
      ));
      
      try {
        let data: Record<string, unknown>[] = [];
        let columns: string[] = [];
        
        if (uploadedFile.type === 'pdf') {
          const result = await convertPdfToSpreadsheet(uploadedFile.file, { 
            maxPages, 
            useAI,
            extractTables: true,
          });
          
          if (result?.success && result.rows.length > 0) {
            data = result.rows as Record<string, unknown>[];
            columns = result.columns;
            if (result.validationWarnings?.length) {
              toast.warning(`${uploadedFile.name}: ${result.validationWarnings.length} extraction warning(s)`, {
                description: result.validationWarnings.slice(0, 3).join(' • '),
              });
            }
            if (result.reconciled === false && result.summary) {
              toast.error(`${uploadedFile.name}: totals don't reconcile to statement summary`, {
                description: `Printed debits ${result.summary.totalDebits ?? '?'} / credits ${result.summary.totalCredits ?? '?'} — please review extracted rows before importing.`,
              });
            } else if (result.reconciled === true) {
              toast.success(`${uploadedFile.name}: reconciled to statement totals ✓`);
            }
          } else {
            throw new Error(result?.message || 'No data extracted');
          }
        } else {
          // Excel/CSV
          const arrayBuffer = await uploadedFile.file.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer);
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
          
          if (jsonData.length > 0) {
            data = jsonData;
            columns = Object.keys(jsonData[0]);
          } else {
            throw new Error('No data found in file');
          }
        }
        
        // Add source file tracking
        data = data.map(row => ({ ...row, _sourceFile: uploadedFile.name }));
        
        allData.push(...data);
        columns.forEach(c => allColumns.add(c));
        
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { 
            ...f, 
            status: 'complete', 
            progress: 100,
            extractedRows: data.length,
            extractedColumns: columns,
            data,
          } : f
        ));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Extraction failed';
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error', error: errorMsg } : f
        ));
        toast.error(`Failed to process ${uploadedFile.name}`, { description: errorMsg });
      }
    }
    
    if (allData.length > 0) {
      setExtractedData(allData);
      setExtractedColumns(Array.from(allColumns));
      setStep('mapping');
      toast.success(`Extracted ${allData.length} rows from ${files.length} file(s)`);
    } else {
      toast.error('No data could be extracted');
      setStep('upload');
    }
  }, [files, maxPages, useAI, convertPdfToSpreadsheet]);

  const loadFromAliceSheets = useCallback(async () => {
    if (!selectedWorkbookPath) {
      toast.error('Select an AI Sheets workbook first');
      return;
    }
    const wb = aliceWorkbooks.find((w) => w.path === selectedWorkbookPath);
    if (!wb) return;
    setLoadingWorkbook(true);
    try {
      const buf = await downloadAliceSheetsWorkbook(selectedWorkbookPath);
      const workbook = XLSX.read(buf);
      const allData: Record<string, unknown>[] = [];
      const allColumns = new Set<string>();
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
        for (const row of json) {
          allData.push({ ...row, _sourceFile: `AI Sheets: ${wb.name}` });
          Object.keys(row).forEach((k) => allColumns.add(k));
        }
      }
      if (allData.length === 0) {
        toast.error('Workbook has no data rows');
        return;
      }
      setExtractedData(allData);
      setExtractedColumns(Array.from(allColumns));
      setStep('mapping');
      toast.success(`Loaded ${allData.length} rows from ${wb.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load workbook';
      toast.error(msg);
    } finally {
      setLoadingWorkbook(false);
    }
  }, [selectedWorkbookPath, aliceWorkbooks]);


  
  const handleMappingComplete = useCallback((config: MappingConfig) => {
    setMappingConfig(config);
    setShowPreview(true);
  }, []);
  
  const handlePreviewConfirm = useCallback((normalizedData: Record<string, unknown>[]) => {
    onImport(normalizedData);
    toast.success(`Imported ${normalizedData.length} transactions`);
    onOpenChange(false);
    
    // Reset state
    setStep('upload');
    setFiles([]);
    setExtractedData([]);
    setExtractedColumns([]);
    setMappingConfig(null);
    setShowPreview(false);
  }, [onImport, onOpenChange]);
  
  const handleBack = useCallback(() => {
    setShowPreview(false);
  }, []);
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const totalRows = files.reduce((sum, f) => sum + (f.extractedRows || 0), 0);
  const completedFiles = files.filter(f => f.status === 'complete').length;
  const processingFile = files.find(f => f.status === 'processing');
  
  return (
    <>
      <Dialog open={open && !showPreview} onOpenChange={onOpenChange}>
        <DialogContent className={cn(
          "flex flex-col p-0 gap-0",
          step === 'mapping' ? "max-w-[95vw] max-h-[95vh]" : "max-w-2xl max-h-[85vh]"
        )}>
          {step === 'upload' && (
            <>
              <DialogHeader className="p-6 pb-4">
                <DialogTitle className="flex items-center gap-2">
                  {statementType === 'bank' ? (
                    <Building2 className="h-5 w-5" />
                  ) : (
                    <CreditCard className="h-5 w-5" />
                  )}
                  Import {statementType === 'bank' ? 'Bank' : 'Credit Card'} Statement
                </DialogTitle>
                <DialogDescription>
                  Upload PDF, Excel, or CSV files. AI will extract and map transaction data.
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 p-6 pt-0 space-y-6 overflow-y-auto">
                {/* Source mode toggle */}
                <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
                  <button
                    type="button"
                    onClick={() => setSourceMode('file')}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5',
                      sourceMode === 'file'
                        ? 'bg-background shadow-sm font-medium'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <FileUp className="h-4 w-4" />
                    File upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceMode('aisheets')}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5',
                      sourceMode === 'aisheets'
                        ? 'bg-background shadow-sm font-medium'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    From AI Sheets
                  </button>
                </div>

                {sourceMode === 'aisheets' && (
                  <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      <h4 className="font-medium text-sm">Load from Alice AI Sheets</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Feed rows from an AI Sheets workbook you already extracted or cleaned up, and skip re-uploading the PDF.
                    </p>
                    <Select
                      value={selectedWorkbookPath ?? ''}
                      onValueChange={(v) => setSelectedWorkbookPath(v || null)}
                      disabled={workbooksLoading || aliceWorkbooks.length === 0}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue
                          placeholder={
                            workbooksLoading
                              ? 'Loading workbooks…'
                              : aliceWorkbooks.length === 0
                                ? 'No AI Sheets workbooks found'
                                : 'Select a workbook…'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {aliceWorkbooks.map((wb) => (
                          <SelectItem key={wb.path} value={wb.path}>
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                              <span className="truncate max-w-[320px]">{wb.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(wb.uploaded_at).toLocaleDateString()}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={loadFromAliceSheets}
                      disabled={!selectedWorkbookPath || loadingWorkbook}
                      className="w-full"
                    >
                      {loadingWorkbook ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading workbook…
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Load rows into mapper
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {sourceMode === 'file' && (
                  <>
                {/* Upload Zone */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.csv,.xlsx,.xls"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                    "hover:border-primary hover:bg-primary/5",
                    files.length > 0 ? "border-primary/30" : "border-border"
                  )}
                >
                  <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h4 className="font-medium mb-1">Drop files here or click to browse</h4>
                  <p className="text-sm text-muted-foreground">
                    Supports PDF (up to 500 pages), Excel, and CSV files
                  </p>
                </div>
                
                {/* File List */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Files ({files.length})</Label>
                    <ScrollArea className="max-h-[200px]">
                      <div className="space-y-2">
                        {files.map((file, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border",
                              file.status === 'error' 
                                ? "border-destructive/50 bg-destructive/5"
                                : file.status === 'complete'
                                  ? "border-green-500/50 bg-green-500/5"
                                  : "border-border bg-card"
                            )}
                          >
                            <div className="p-2 rounded bg-muted">
                              {file.type === 'pdf' ? (
                                <FileText className="h-5 w-5 text-red-500" />
                              ) : (
                                <FileSpreadsheet className="h-5 w-5 text-green-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.size)}
                                {file.extractedRows && ` • ${file.extractedRows} rows extracted`}
                                {file.error && (
                                  <span className="text-destructive"> • {file.error}</span>
                                )}
                              </p>
                            </div>
                            {file.status === 'complete' && (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            )}
                            {file.status === 'error' && (
                              <AlertCircle className="h-5 w-5 text-destructive" />
                            )}
                            {file.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
                
                {/* Saved Templates */}
                {dbTemplates.length > 0 && (
                  <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-primary" />
                      Saved Templates
                    </h4>
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedTemplateId || '__none__'}
                        onValueChange={(v) => setSelectedTemplateId(v === '__none__' ? null : v)}
                      >
                        <SelectTrigger className="flex-1 h-9">
                          <SelectValue placeholder="Select a saved template..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No template (AI auto-map)</SelectItem>
                          {dbTemplates.map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                              {template.bank_name && ` (${template.bank_name})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTemplateId && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (selectedTemplateId) {
                                  deleteTemplate.mutate(selectedTemplateId);
                                  setSelectedTemplateId(null);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Template
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    {selectedTemplateId && (
                      <p className="text-xs text-muted-foreground">
                        This template will be applied after extraction to auto-map columns.
                      </p>
                    )}
                  </div>
                )}

                {/* Extraction Settings */}
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Extraction Settings
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs mb-1 block">Max Pages (PDF)</Label>
                      <Select 
                        value={String(maxPages)} 
                        onValueChange={(v) => setMaxPages(Number(v))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50 pages</SelectItem>
                          <SelectItem value="100">100 pages</SelectItem>
                          <SelectItem value="250">250 pages</SelectItem>
                          <SelectItem value="500">500 pages</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="use-ai"
                          checked={useAI}
                          onCheckedChange={setUseAI}
                        />
                        <Label htmlFor="use-ai" className="text-sm cursor-pointer flex items-center gap-1">
                          <Brain className="h-4 w-4" />
                          AI Extraction
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
                  </>
                )}
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-between p-6 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                {sourceMode === 'file' && (
                  <Button 
                    onClick={processFiles}
                    disabled={files.length === 0 || files.every(f => f.status !== 'pending')}
                  >
                    <FileSearch className="h-4 w-4 mr-1" />
                    Extract Data
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </>
          )}
          
          {step === 'extracting' && (
            <>
              <DialogHeader className="p-6 pb-4">
                <DialogTitle className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Extracting Data...
                </DialogTitle>
                <DialogDescription>
                  AI is analyzing your files and extracting transaction data.
                </DialogDescription>
              </DialogHeader>
              
              <div className="flex-1 p-6 pt-0 space-y-4">
                <div className="text-center py-8">
                  <Zap className="h-16 w-16 mx-auto mb-4 text-primary animate-pulse" />
                  <h4 className="font-semibold text-lg mb-2">
                    Processing {files.length} file{files.length > 1 ? 's' : ''}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    {processingFile 
                      ? `Currently processing: ${processingFile.name}`
                      : `Completed: ${completedFiles}/${files.length} files`
                    }
                  </p>
                  
                  <div className="max-w-sm mx-auto space-y-2">
                    <Progress 
                      value={progress?.current || (completedFiles / files.length) * 100} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {totalRows > 0 && `${totalRows} rows extracted so far`}
                    </p>
                  </div>
                </div>
                
                {/* File progress list */}
                <div className="space-y-2">
                  {files.map((file, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg",
                        file.status === 'processing' && "bg-primary/5"
                      )}
                    >
                      {file.status === 'complete' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : file.status === 'processing' ? (
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      ) : file.status === 'error' ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                      )}
                      <span className="text-sm flex-1 truncate">{file.name}</span>
                      {file.extractedRows && (
                        <Badge variant="outline" className="text-xs">
                          {file.extractedRows} rows
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {step === 'mapping' && (
            <AdvancedMappingEngine
              sourceColumns={extractedColumns}
              sampleData={extractedData}
              statementType={statementType}
              onMappingsChange={() => {}}
              onComplete={handleMappingComplete}
              onCancel={() => {
                setStep('upload');
                setFiles([]);
                setExtractedData([]);
                setExtractedColumns([]);
              }}
              existingTemplates={engineTemplates}
              onSaveTemplate={(template) => {
                // Save template to database
                createTemplate.mutate({
                  name: template.name,
                  statement_type: template.statementType,
                  bank_name: template.bankName,
                  mappings: template.mappings,
                  date_format: template.dateFormat,
                  number_format: template.numberFormat,
                  invert_sign: template.invertSign,
                  treat_brackets_as_negative: template.treatBracketsAsNegative,
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Preview Dialog */}
      {mappingConfig && (
        <MappingPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          sourceData={extractedData}
          mappingConfig={mappingConfig}
          statementType={statementType}
          onConfirm={handlePreviewConfirm}
          onBack={handleBack}
        />
      )}
    </>
  );
}
