import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, EyeOff, FileSpreadsheet, History, Loader2, Lock, Undo2, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEmployeeUpload, sha256 } from '@/hooks/useEmployeeUpload';
import { useEmployees } from '@/hooks/useEmployees';
import { parseUploadFile, ParsedUpload } from '@/lib/employeeUpload/parse';
import { allIgnorableKeys, applyIgnores, buildPlan, issueKey, RowPlan, UploadMode, UploadPlan } from '@/lib/employeeUpload/plan';
import { CommitResult, RowResult } from '@/lib/employeeUpload/commit';
import { buildTemplateBlob } from '@/lib/employeeUpload/template';
import { COLUMN_BY_KEY, MAX_FILE_SIZE_BYTES, availableCountries, getCountryRule } from '@/lib/employeeUpload/schema';

type Step = 'setup' | 'review' | 'importing' | 'done';
type Filter = 'all' | 'errors' | 'warnings' | 'ready' | 'ignored';

const STEPS: { key: Step; label: string }[] = [
  { key: 'setup', label: 'Upload' },
  { key: 'review', label: 'Review' },
  { key: 'importing', label: 'Import' },
  { key: 'done', label: 'Results' },
];

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function workbookBlob(sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) if (s.rows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows), s.name);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Original columns back under their template headers, so a fixed file can be re-uploaded. */
function rowWithHeaders(raw: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[COLUMN_BY_KEY.get(k)?.header ?? k] = v;
  return out;
}

export default function BulkEmployeeUpload() {
  const navigate = useNavigate();
  const { orgCountryCode, orgJurisdiction, loadContext, commit, organization } = useEmployeeUpload();
  const { departments } = useEmployees();

  const [step, setStep] = useState<Step>('setup');
  const [countryCode, setCountryCode] = useState<string>(orgCountryCode ?? 'NG');
  const [mode, setMode] = useState<UploadMode>('create');
  const [replaceBlanks, setReplaceBlanks] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedUpload | null>(null);
  const [basePlan, setPlan] = useState<UploadPlan | null>(null);
  // Issues the user chose to ignore (keys from issueKey). The plan shown and
  // imported is the base plan with those issues set aside.
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const plan = useMemo(() => (basePlan ? applyIgnores(basePlan, ignored) : null), [basePlan, ignored]);
  const pendingIgnorable = useMemo(() => (plan ? allIgnorableKeys(plan) : []), [plan]);
  const ignoredCount = useMemo(() => (plan ? plan.rows.reduce((n, r) => n + r.ignored.length, 0) : 0), [plan]);
  const ignoreKeys = (keys: string[]) => setIgnored((prev) => new Set([...prev, ...keys]));
  const unignoreKey = (key: string) => setIgnored((prev) => { const next = new Set(prev); next.delete(key); return next; });
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<CommitResult | null>(null);

  useEffect(() => { if (orgCountryCode) setCountryCode(orgCountryCode); }, [orgCountryCode]);

  const countries = useMemo(() => availableCountries().map((c) => ({ value: c.code, label: `${c.name} (${c.currency})` })), []);
  const rule = useMemo(() => getCountryRule(countryCode), [countryCode]);

  const analyse = useCallback(async (f: File, opts?: { mode?: UploadMode; country?: string; replaceBlanks?: boolean; keepIgnores?: boolean }) => {
    if (!organization?.id) { toast.error('Select an organization first.'); return; }
    if (f.size > MAX_FILE_SIZE_BYTES) { toast.error('File exceeds the 10 MB limit.'); return; }
    setBusy(true);
    try {
      const p = parsed && file === f ? parsed : await parseUploadFile(f);
      const ctx = await loadContext();
      const next = buildPlan(p, {
        organizationId: organization.id,
        countryCode: opts?.country ?? countryCode,
        mode: opts?.mode ?? mode,
        replaceBlanks: opts?.replaceBlanks ?? replaceBlanks,
        orgJurisdiction,
        existing: ctx.existing,
        jobSites: ctx.jobSites,
      });
      setFile(f);
      setParsed(p);
      setPlan(next);
      if (!opts?.keepIgnores) setIgnored(new Set());
      setFilter(next.summary.withErrors ? 'errors' : 'all');
      setStep('review');
    } catch (e) {
      toast.error(`Could not read the file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [organization?.id, parsed, file, loadContext, countryCode, mode, replaceBlanks, orgJurisdiction]);

  const onPick = (f?: File | null) => { if (f) { setParsed(null); void analyse(f); } };

  const downloadTemplate = async () => {
    let jobSites: { name: string; code: string | null }[] = [];
    try { jobSites = (await loadContext()).jobSites; } catch { /* template still useful without them */ }
    downloadBlob(buildTemplateBlob({ countryCode, jobSites, departments }), `employee-upload-template-${countryCode}.xlsx`);
  };

  const runImport = async () => {
    if (!plan || !file) return;
    setStep('importing');
    setProgress({ done: 0, total: plan.summary.ready });
    try {
      const res = await commit.mutateAsync({
        plan, mode, replaceBlanks,
        file: { name: file.name, size: file.size, hash: await sha256(file) },
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult(res);
      setStep('done');
      if (res.created + res.updated > 0) toast.success(`Imported ${res.created + res.updated} employee${res.created + res.updated === 1 ? '' : 's'}.`);
      else toast.error('No employees were imported.');
    } catch {
      setStep('review');
    }
  };

  const reset = () => {
    setStep('setup'); setFile(null); setParsed(null); setPlan(null); setIgnored(new Set()); setResult(null); setProgress({ done: 0, total: 0 });
  };

  const visibleRows = useMemo(() => {
    if (!plan) return [];
    return plan.rows.filter((r) =>
      filter === 'all' ? true :
      filter === 'errors' ? r.errors.length > 0 :
      filter === 'warnings' ? r.errors.length === 0 && r.warnings.length > 0 :
      filter === 'ignored' ? r.ignored.length > 0 :
      r.errors.length === 0);
  }, [plan, filter]);

  const downloadIssues = () => {
    if (!plan) return;
    const rows = plan.rows.filter((r) => r.errors.length || r.warnings.length || r.ignored.length).map((r) => ({
      Row: r.rowNumber,
      Errors: r.errors.map((e) => e.message).join(' | '),
      Warnings: r.warnings.map((e) => e.message).join(' | '),
      Ignored: r.ignored.map((e) => e.message).join(' | '),
      ...rowWithHeaders(r.raw),
    }));
    if (!rows.length) { toast.info('No issues to export.'); return; }
    downloadBlob(workbookBlob([{ name: 'Issues', rows }]), `upload-issues-${file?.name ?? 'employees'}.xlsx`);
  };

  const downloadResults = () => {
    if (!result || !plan) return;
    const planByRow = new Map(plan.rows.map((r) => [r.rowNumber, r]));
    const rows = result.results.map((r) => ({ Row: r.rowNumber, Result: r.status, Message: r.message ?? '', ...rowWithHeaders(planByRow.get(r.rowNumber)?.raw ?? {}) }));
    const failed = rows.filter((r) => r.Result === 'failed' || r.Result === 'skipped').map(({ Row, Result, Message, ...rest }) => ({ ...rest, 'Upload Error': `${Result}: ${Message}`, 'Source Row': Row }));
    downloadBlob(workbookBlob([{ name: 'Results', rows }, { name: 'Employees', rows: failed }]), `upload-results-${file?.name ?? 'employees'}.xlsx`);
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/payroll/employees/list')}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">Bulk Employee Upload</h1>
            <p className="text-muted-foreground text-sm">Add or update many employees at once from an Excel or CSV file.</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/payroll/employees/bulk-upload/history')}>
          <History className="w-4 h-4 mr-2" /> Import History
        </Button>
      </div>

      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s.key} className={`px-3 py-1 rounded-full border ${i === stepIndex ? 'bg-primary text-primary-foreground border-primary' : i < stepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>

      {step === 'setup' && (
        <Card className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Country</Label>
              <SearchableSelect options={countries} value={countryCode} onValueChange={setCountryCode} placeholder="Select country" />
              <p className="text-xs text-muted-foreground">
                Sets the {rule.jurisdictionLabel.toLowerCase()} list, date order and required IDs
                {rule.requireNin11 ? ' — Nigeria requires an 11-digit NIN for every employee.' : '.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>What should the upload do?</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as UploadMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">Add new employees only</SelectItem>
                  <SelectItem value="update">Update existing employees (matched by Employee ID)</SelectItem>
                  <SelectItem value="upsert">Add new and update existing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {mode !== 'create' && (
            <div className="flex items-center gap-3 p-3 border rounded-md">
              <Switch checked={replaceBlanks} onCheckedChange={setReplaceBlanks} id="rb" />
              <div>
                <Label htmlFor="rb" className="cursor-pointer">Clear fields left blank</Label>
                <p className="text-xs text-muted-foreground">Off: blank cells keep the employee's current value. Required fields are never cleared.</p>
              </div>
            </div>
          )}

          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); onPick(e.dataTransfer.files?.[0]); }}
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
          >
            {busy ? <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /> : <Upload className="w-8 h-8 text-muted-foreground" />}
            <span className="font-medium">{busy ? 'Reading and checking the file…' : 'Drop your file here or click to choose'}</span>
            <span className="text-xs text-muted-foreground">.xlsx, .xls or .csv · up to 10 MB · 5,000 employees</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
          </label>

          <div className="flex items-center justify-between rounded-md bg-muted/40 p-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-muted-foreground" />
              <div className="text-sm">
                <div className="font-medium">Need the template?</div>
                <div className="text-muted-foreground text-xs">One row per employee. Includes {rule.jurisdictionLabel.toLowerCase()} codes{rule.requireNin11 ? ', NIN, TIN and pension columns' : ''} and your job sites.</div>
              </div>
            </div>
            <Button variant="outline" onClick={downloadTemplate}><Download className="w-4 h-4 mr-2" /> Download template</Button>
          </div>
        </Card>
      )}

      {step === 'review' && plan && (
        <>
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <span className="font-medium">{file?.name}</span>
                <span className="text-muted-foreground"> · sheet “{parsed?.sheetName}” · {plan.country.name} · {mode === 'create' ? 'add new' : mode === 'update' ? 'update existing' : 'add & update'}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>Choose another file</Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Stat label="Rows" value={plan.summary.total} />
              <Stat label="Ready to import" value={plan.summary.ready} tone="ok" />
              <Stat label="New" value={plan.summary.creates} tone="info" />
              <Stat label="Updates" value={plan.summary.updates} tone="info" />
              <Stat label="With errors" value={plan.summary.withErrors} tone={plan.summary.withErrors ? 'error' : undefined} />
            </div>
            {plan.fileErrors.length > 0 && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm space-y-1">
                {plan.fileErrors.map((e) => <div key={e}>{e}</div>)}
              </div>
            )}
            {plan.fileWarnings.length > 0 && (
              <div className="p-3 rounded-md bg-warning/10 text-warning text-xs space-y-1">
                {plan.fileWarnings.map((e) => <div key={e}>{e}</div>)}
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList>
                  <TabsTrigger value="all">All ({plan.rows.length})</TabsTrigger>
                  <TabsTrigger value="errors">Errors ({plan.summary.withErrors})</TabsTrigger>
                  <TabsTrigger value="warnings">Warnings ({plan.summary.withWarnings})</TabsTrigger>
                  <TabsTrigger value="ready">Ready ({plan.rows.length - plan.summary.withErrors})</TabsTrigger>
                  <TabsTrigger value="ignored">Ignored ({plan.rows.filter((r) => r.ignored.length > 0).length})</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex gap-2">
                {ignoredCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setIgnored(new Set())}>
                    <Undo2 className="w-4 h-4 mr-2" /> Undo all ignores
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => ignoreKeys(pendingIgnorable)} disabled={pendingIgnorable.length === 0}
                  title="Ignore every warning and every error on an optional field. Must-fix errors are not affected.">
                  <EyeOff className="w-4 h-4 mr-2" /> Ignore all{pendingIgnorable.length ? ` (${pendingIgnorable.length})` : ''}
                </Button>
                <Button variant="outline" size="sm" onClick={downloadIssues}><Download className="w-4 h-4 mr-2" /> Download issues</Button>
              </div>
            </div>
            <ReviewTable rows={visibleRows} onIgnore={(key) => ignoreKeys([key])} onUndo={unignoreKey} />
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                {plan.summary.withErrors > 0
                  ? `${plan.summary.withErrors} row(s) with errors will be skipped. Errors on optional fields can be ignored; errors marked "Must fix" need a corrected file.`
                  : 'All rows are ready.'}
              </p>
              <div className="flex gap-2">
                {file && <Button variant="outline" onClick={() => analyse(file, { country: countryCode, mode, replaceBlanks, keepIgnores: true })} disabled={busy}>Re-check</Button>}
                <Button onClick={runImport} disabled={plan.summary.ready === 0 || busy}>
                  Import {plan.summary.ready} employee{plan.summary.ready === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      {step === 'importing' && (
        <Card className="p-8 space-y-4">
          <div className="flex items-center gap-3"><Loader2 className="w-5 h-5 animate-spin" /><h2 className="text-lg font-semibold">Importing employees…</h2></div>
          <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
          <p className="text-sm text-muted-foreground">{progress.done} of {progress.total} processed. Keep this page open.</p>
        </Card>
      )}

      {step === 'done' && result && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            {result.created + result.updated === 0 ? <XCircle className="w-6 h-6 text-destructive" />
              : result.failed + result.skipped > 0 ? <AlertTriangle className="w-6 h-6 text-warning" />
              : <CheckCircle2 className="w-6 h-6 text-success" />}
            <h2 className="text-lg font-semibold">
              {result.created + result.updated === 0 ? 'No employees were imported' : result.failed + result.skipped > 0 ? 'Import finished with some rows not imported' : 'Import complete'}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Added" value={result.created} tone="ok" />
            <Stat label="Updated" value={result.updated} tone="info" />
            <Stat label="Failed" value={result.failed} tone={result.failed ? 'error' : undefined} />
            <Stat label="Skipped (errors)" value={result.skipped} tone={result.skipped ? 'warn' : undefined} />
          </div>
          <ResultsTable rows={result.results.filter((r) => r.status === 'failed' || r.status === 'skipped')} />
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => navigate('/payroll/employees/list')}>View employees</Button>
            <Button variant="outline" onClick={downloadResults}><Download className="w-4 h-4 mr-2" /> Download results</Button>
            <Button variant="outline" onClick={reset}>Upload another file</Button>
          </div>
          {result.failed + result.skipped > 0 && (
            <p className="text-xs text-muted-foreground">The results file has an Employees sheet with only the rows that were not imported — fix them there and upload it again.</p>
          )}
        </Card>
      )}
    </div>
  );
}

function IgnoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="ml-2 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
      <EyeOff className="w-3 h-3" /> Ignore
    </button>
  );
}

function ReviewTable({ rows, onIgnore, onUndo }: { rows: RowPlan[]; onIgnore: (key: string) => void; onUndo: (key: string) => void }) {
  return (
    <div className="overflow-auto max-h-[460px] border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Row</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-44">Employee</TableHead>
            <TableHead className="w-36">Employee ID</TableHead>
            <TableHead className="w-20">Action</TableHead>
            <TableHead>Issues</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 1000).map((r) => (
            <TableRow key={r.rowNumber}>
              <TableCell className="text-xs">{r.rowNumber}</TableCell>
              <TableCell>
                {r.errors.length ? <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{r.errors.some((e) => !e.ignorable) ? 'Must fix' : 'Error'}</Badge>
                  : r.warnings.length ? <Badge className="gap-1 bg-warning/10 text-warning border-warning/20"><AlertTriangle className="w-3 h-3" />Check</Badge>
                  : <Badge className="gap-1 bg-success/10 text-success border-success/20"><CheckCircle2 className="w-3 h-3" />Ready</Badge>}
              </TableCell>
              <TableCell className="text-xs"><div className="font-medium">{r.name || '—'}</div><div className="text-muted-foreground">{r.email}</div></TableCell>
              <TableCell className="font-mono text-xs">{r.employeeNumber || '—'}</TableCell>
              <TableCell className="text-xs capitalize">{r.action === 'create' ? 'Add' : 'Update'}</TableCell>
              <TableCell className="text-xs space-y-0.5">
                {r.errors.map((e, i) => (
                  <div key={`e${i}`} className="text-destructive">
                    {e.message}
                    {e.ignorable
                      ? <IgnoreButton onClick={() => onIgnore(issueKey(r.rowNumber, e))} />
                      : <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="Required field or a rule the database enforces. Fix it in the file."><Lock className="w-3 h-3" />Must fix</span>}
                    {e.ignorable && e.ifIgnored && <div className="text-[11px] text-muted-foreground">If ignored: {e.ifIgnored}</div>}
                  </div>
                ))}
                {r.warnings.map((e, i) => (
                  <div key={`w${i}`} className="text-warning">
                    {e.message}
                    <IgnoreButton onClick={() => onIgnore(issueKey(r.rowNumber, e))} />
                  </div>
                ))}
                {r.ignored.map((e, i) => (
                  <div key={`i${i}`} className="text-muted-foreground">
                    <span className="line-through">Ignored: {e.message}</span>
                    <button type="button" onClick={() => onUndo(issueKey(r.rowNumber, e))} className="ml-2 inline-flex items-center gap-1 text-[11px] hover:underline">
                      <Undo2 className="w-3 h-3" /> Undo
                    </button>
                  </div>
                ))}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nothing here.</TableCell></TableRow>}
        </TableBody>
      </Table>
      {rows.length > 1000 && <div className="p-2 text-xs text-muted-foreground text-center">Showing the first 1,000 of {rows.length}. Download the issues file for the full list.</div>}
    </div>
  );
}

function ResultsTable({ rows }: { rows: RowResult[] }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-auto max-h-[360px] border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14">Row</TableHead>
            <TableHead className="w-44">Employee</TableHead>
            <TableHead className="w-36">Employee ID</TableHead>
            <TableHead className="w-24">Result</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.rowNumber}>
              <TableCell className="text-xs">{r.rowNumber}</TableCell>
              <TableCell className="text-xs">{r.name || '—'}</TableCell>
              <TableCell className="font-mono text-xs">{r.employeeNumber || '—'}</TableCell>
              <TableCell><Badge variant={r.status === 'failed' ? 'destructive' : 'outline'}>{r.status}</Badge></TableCell>
              <TableCell className="text-xs">{r.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' | 'error' | 'info' }) {
  const color = tone === 'ok' ? 'text-success' : tone === 'warn' ? 'text-warning' : tone === 'error' ? 'text-destructive' : tone === 'info' ? 'text-primary' : 'text-foreground';
  return (
    <div className="p-3 border rounded-md">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
    </div>
  );
}
