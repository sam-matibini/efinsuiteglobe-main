import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Upload, FileCheck2, AlertTriangle, CheckCircle2, XCircle, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { generateEmployeeTemplate } from '@/lib/employeeImport/template';
import { parseEmployeeFile } from '@/lib/employeeImport/parser';
import { validateImport, ValidationResult, ValidatedRow } from '@/lib/employeeImport/validate';
import { COUNTRY_IMPORT_RULES, MAX_FILE_SIZE_BYTES } from '@/lib/employeeImport/rules';
import { useEmployeeImport } from '@/hooks/useEmployeeImport';
import { useEmployees } from '@/hooks/useEmployees';
import * as XLSX from 'xlsx';

type Step = 'config' | 'upload' | 'preview' | 'confirm' | 'done';

export default function BulkEmployeeUpload() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('config');
  const [mode, setMode] = useState<'create' | 'update' | 'upsert'>('create');
  const [countryCode, setCountryCode] = useState<string>('CA');
  const [replaceBlanks, setReplaceBlanks] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [parsedFile, setParsedFile] = useState<Awaited<ReturnType<typeof parseEmployeeFile>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [postResult, setPostResult] = useState<{ created: number; updated: number; skipped: number; failed: number } | null>(null);

  const { loadExistingIndex, createBatch, postBatch } = useEmployeeImport();
  const { departments } = useEmployees();

  const downloadTemplate = () => {
    const blob = generateEmployeeTemplate({ countryCode, departments });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee-bulk-upload-template-${countryCode}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFileChosen = async (f: File) => {
    if (f.size > MAX_FILE_SIZE_BYTES) {
      toast.error('File exceeds 10 MB limit');
      return;
    }
    setFile(f);
    setBusy(true);
    try {
      const parsed = await parseEmployeeFile(f);
      setParsedFile(parsed);
      const existing = await loadExistingIndex();
      const result = validateImport(parsed, {
        mode,
        countryCode,
        existing,
        departments: new Set(departments),
        divisions: new Set(),
      });
      setValidation(result);
      setStep('preview');
    } catch (e) {
      toast.error(`Failed to parse file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const downloadErrorReport = () => {
    if (!validation || !parsedFile) return;
    const wb = XLSX.utils.book_new();
    const build = (name: string, rows: ValidatedRow[]) => {
      const data = rows
        .filter((r) => r.errors.length > 0 || r.warnings.length > 0)
        .map((r) => ({
          Row: r.rowNumber,
          'Employee ID': r.employeeNumber ?? '',
          Errors: r.errors.map((e) => e.message).join('; '),
          Warnings: r.warnings.map((e) => e.message).join('; '),
          ...(r.raw as Record<string, unknown>),
        }));
      if (data.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name);
    };
    build('Employees', validation.employees);
    build('Compensation', validation.compensation);
    build('Deductions', validation.deductions);
    build('Payment', validation.payment);
    if (wb.SheetNames.length === 0) {
      toast.info('No errors to export');
      return;
    }
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${file?.name ?? 'report'}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const proceed = async () => {
    if (!parsedFile || !validation || !file) return;
    setBusy(true);
    try {
      const batch = await createBatch.mutateAsync({ parsed: parsedFile, validation, mode, countryCode, replaceBlanks, file });
      setBatchId(batch.id);
      const res = (await postBatch.mutateAsync(batch.id)) as { created: number; updated: number; skipped: number; failed: number };
      setPostResult(res);
      setStep('done');
    } catch (e) {
      // toasts handled by mutations
    } finally {
      setBusy(false);
    }
  };

  const rowBadge = (r: ValidatedRow) =>
    r.errors.length > 0 ? (
      <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Error</Badge>
    ) : r.warnings.length > 0 ? (
      <Badge className="gap-1 bg-warning/10 text-warning border-warning/20"><AlertTriangle className="w-3 h-3" />Warning</Badge>
    ) : (
      <Badge className="gap-1 bg-success/10 text-success border-success/20"><CheckCircle2 className="w-3 h-3" />Valid</Badge>
    );

  const renderRowsTable = (rows: ValidatedRow[]) => (
    <div className="overflow-auto max-h-[420px] border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Row</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-40">Employee ID</TableHead>
            <TableHead>Issues</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 500).map((r) => (
            <TableRow key={`${r.rowNumber}-${r.employeeNumber ?? ''}`}>
              <TableCell>{r.rowNumber}</TableCell>
              <TableCell>{rowBadge(r)}</TableCell>
              <TableCell className="font-mono text-xs">{r.employeeNumber ?? '—'}</TableCell>
              <TableCell className="text-xs">
                {[...r.errors, ...r.warnings].map((i, idx) => (
                  <div key={idx} className={i.severity === 'error' ? 'text-destructive' : 'text-warning'}>
                    {i.message}
                  </div>
                ))}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No rows</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
      {rows.length > 500 && (
        <div className="p-2 text-xs text-muted-foreground text-center">Showing first 500 of {rows.length} rows.</div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/payroll/employees/list')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Bulk Employee Upload</h1>
            <p className="text-muted-foreground text-sm">Import employees, compensation, deductions and payment information from CSV or Excel.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/payroll/employees/bulk-upload/history')}>
          <History className="w-4 h-4 mr-2" /> Import History
        </Button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {(['config', 'upload', 'preview', 'confirm', 'done'] as Step[]).map((s, i) => (
          <div key={s} className={`px-3 py-1 rounded-full border ${step === s ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground'}`}>
            {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
          </div>
        ))}
      </div>

      {step === 'config' && (
        <Card className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Country / Jurisdiction</Label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(COUNTRY_IMPORT_RULES).map((r) => (
                    <SelectItem key={r.countryCode} value={r.countryCode}>{r.countryName} ({r.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Country determines required identifiers, currency and statutory deductions.</p>
            </div>
            <div className="space-y-2">
              <Label>Import Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">Create — new employees only</SelectItem>
                  <SelectItem value="update">Update — existing employees only</SelectItem>
                  <SelectItem value="upsert">Upsert — create or update by Employee ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 border rounded-md">
            <Switch checked={replaceBlanks} onCheckedChange={setReplaceBlanks} id="rb" />
            <div>
              <Label htmlFor="rb" className="cursor-pointer">Replace existing values with blanks</Label>
              <p className="text-xs text-muted-foreground">Off by default. Blank cells in Update mode preserve existing values.</p>
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" /> Download Template
            </Button>
            <Button onClick={() => setStep('upload')}>Continue</Button>
          </div>
        </Card>
      )}

      {step === 'upload' && (
        <Card className="p-6 space-y-4">
          <Label>Upload CSV or Excel file</Label>
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">Maximum 10 MB · 5,000 rows</p>
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFileChosen(e.target.files[0])} disabled={busy} />
          </div>
          {busy && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Parsing and validating…</p>}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('config')}>Back</Button>
          </div>
        </Card>
      )}

      {step === 'preview' && validation && (
        <>
          <Card className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Stat label="Total rows" value={validation.summary.totalRows} />
              <Stat label="New employees" value={validation.summary.newEmployees} tone="info" />
              <Stat label="Updates" value={validation.summary.updates} tone="info" />
              <Stat label="Warnings" value={validation.summary.warningRows} tone="warn" />
              <Stat label="Errors" value={validation.summary.errorRows} tone="error" />
            </div>
            {validation.fileErrors.length > 0 && (
              <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                {validation.fileErrors.map((e) => <div key={e.code}>{e.message}</div>)}
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <Tabs defaultValue="employees">
              <TabsList>
                <TabsTrigger value="employees">Employees ({validation.employees.length})</TabsTrigger>
                <TabsTrigger value="compensation">Compensation ({validation.compensation.length})</TabsTrigger>
                <TabsTrigger value="deductions">Deductions ({validation.deductions.length})</TabsTrigger>
                <TabsTrigger value="payment">Payment ({validation.payment.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="employees">{renderRowsTable(validation.employees)}</TabsContent>
              <TabsContent value="compensation">{renderRowsTable(validation.compensation)}</TabsContent>
              <TabsContent value="deductions">{renderRowsTable(validation.deductions)}</TabsContent>
              <TabsContent value="payment">{renderRowsTable(validation.payment)}</TabsContent>
            </Tabs>
            <div className="flex justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
                <Button variant="outline" onClick={downloadErrorReport}>
                  <Download className="w-4 h-4 mr-2" /> Download Error Report
                </Button>
              </div>
              <Button onClick={() => setStep('confirm')} disabled={validation.summary.validRows === 0 || validation.fileErrors.length > 0}>
                <FileCheck2 className="w-4 h-4 mr-2" /> Continue with {validation.summary.validRows} valid rows
              </Button>
            </div>
          </Card>
        </>
      )}

      {step === 'confirm' && validation && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Confirm Import</h2>
          <p className="text-sm text-muted-foreground">
            {validation.summary.validRows} rows will be posted. {validation.summary.errorRows} error rows will be skipped.
            The import runs as a single controlled transaction and can be rolled back from the Import History page.
          </p>
          <ul className="text-sm space-y-1 list-disc pl-5">
            <li>New employees: <strong>{validation.summary.newEmployees}</strong></li>
            <li>Updates: <strong>{validation.summary.updates}</strong></li>
            <li>Country: <strong>{COUNTRY_IMPORT_RULES[countryCode].countryName}</strong></li>
            <li>Mode: <strong>{mode}</strong></li>
            <li>Replace blanks: <strong>{replaceBlanks ? 'Yes' : 'No'}</strong></li>
          </ul>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep('preview')}>Back</Button>
            <Button onClick={proceed} disabled={busy}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Posting…</> : 'Confirm and Post'}
            </Button>
          </div>
        </Card>
      )}

      {step === 'done' && postResult && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-success" />
            <h2 className="text-lg font-semibold">Import Completed</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Created" value={postResult.created} tone="ok" />
            <Stat label="Updated" value={postResult.updated} tone="info" />
            <Stat label="Skipped" value={postResult.skipped} tone="warn" />
            <Stat label="Failed" value={postResult.failed} tone={postResult.failed > 0 ? 'error' : 'info'} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/payroll/employees/list')}>View Employees</Button>
            <Button variant="outline" onClick={() => navigate('/payroll/employees/bulk-upload/history')}>Import History</Button>
            {batchId && <Button variant="ghost" onClick={downloadErrorReport}>Download Error Report</Button>}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' | 'error' | 'info' }) {
  const color =
    tone === 'ok' ? 'text-success' :
    tone === 'warn' ? 'text-warning' :
    tone === 'error' ? 'text-destructive' :
    tone === 'info' ? 'text-primary' : 'text-foreground';
  return (
    <div className="p-3 border rounded-md">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// small local import for Input to avoid extra imports at top
import { Input } from '@/components/ui/input';
