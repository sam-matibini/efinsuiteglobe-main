import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Send, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useAccounts } from '@/hooks/useAccounts';
import { useDepartments } from '@/hooks/useDimensions';
import { useAuth } from '@/hooks/useAuth';
import { useCreateJournalEntry, usePostJournalEntry, JournalLineInput } from '@/hooks/useJournalEntries';
import { downloadJournalEntryTemplateCsv, downloadJournalEntryTemplateXlsx, JE_TEMPLATE_HEADERS } from '@/lib/journal-entry-template';

type RawRow = Record<string, string | number | undefined | null>;

interface ParsedLine {
  rowIndex: number; // 1-based file row
  entryNumber: string;
  entryDate: string;
  description: string;
  reference: string;
  lineNumber: number;
  accountCode: string;
  lineDescription: string;
  debit: number;
  credit: number;
  departmentCode: string;
  errors: string[];
}

interface GroupedEntry {
  entryNumber: string;
  entryDate: string;
  description: string;
  reference: string;
  lines: ParsedLine[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  errors: string[];
}

const norm = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export default function BulkJournalImportDialog({ open, onOpenChange, onComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState<ParsedLine[]>([]);
  const [postAfterCreate, setPostAfterCreate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<{ entry: string; status: 'created' | 'posted' | 'failed'; message?: string }[]>([]);

  const { organization } = useCurrentOrganization();
  const { user } = useAuth();
  const { data: accounts = [] } = useAccounts(organization?.id);
  const { data: departments = [] } = useDepartments();
  const createJE = useCreateJournalEntry();
  const postJE = usePostJournalEntry();

  const accountMap = useMemo(() => {
    const m = new Map<string, { id: string; code: string; name: string }>();
    accounts.forEach((a: any) => m.set(String(a.code).trim().toUpperCase(), a));
    return m;
  }, [accounts]);

  const departmentMap = useMemo(() => {
    const m = new Map<string, string>();
    departments.forEach((d: any) => m.set(String(d.code ?? '').trim().toUpperCase(), d.id));
    return m;
  }, [departments]);

  function reset() {
    setFileName('');
    setRawRows([]);
    setResults([]);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFile(file: File) {
    setResults([]);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const sheetName =
        wb.SheetNames.find((s) => s.toLowerCase().includes('journal')) ?? wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: '', raw: false });
      const parsed: ParsedLine[] = rows.map((r, i) => {
        const errors: string[] = [];
        const entryNumber = norm(r.entry_number);
        const entryDate = norm(r.entry_date);
        const accountCode = norm(r.account_code);
        const debit = num(r.debit);
        const credit = num(r.credit);

        if (!entryNumber) errors.push('entry_number required');
        if (!entryDate) errors.push('entry_date required');
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) errors.push('entry_date must be YYYY-MM-DD');
        if (!accountCode) errors.push('account_code required');
        else if (!accountMap.has(accountCode.toUpperCase())) errors.push(`unknown account_code ${accountCode}`);
        if (debit > 0 && credit > 0) errors.push('row has both debit and credit');
        if (debit === 0 && credit === 0) errors.push('row has zero amount');
        const deptCode = norm(r.department_code);
        if (deptCode && !departmentMap.has(deptCode.toUpperCase())) {
          errors.push(`unknown department_code ${deptCode}`);
        }
        return {
          rowIndex: i + 2,
          entryNumber,
          entryDate,
          description: norm(r.description),
          reference: norm(r.reference),
          lineNumber: Number(r.line_number) || i + 1,
          accountCode,
          lineDescription: norm(r.line_description),
          debit,
          credit,
          departmentCode: deptCode,
          errors,
        };
      });
      setRawRows(parsed);
    } catch (err) {
      console.error(err);
      toast.error('Could not parse file. Use the template format (CSV or XLSX).');
      reset();
    }
  }

  const groups = useMemo<GroupedEntry[]>(() => {
    const byKey = new Map<string, GroupedEntry>();
    for (const line of rawRows) {
      const key = line.entryNumber || `__row_${line.rowIndex}`;
      let g = byKey.get(key);
      if (!g) {
        g = {
          entryNumber: line.entryNumber,
          entryDate: line.entryDate,
          description: line.description,
          reference: line.reference,
          lines: [],
          totalDebit: 0,
          totalCredit: 0,
          balanced: false,
          errors: [],
        };
        byKey.set(key, g);
      }
      g.lines.push(line);
      g.totalDebit += line.debit;
      g.totalCredit += line.credit;
      if (!g.description && line.description) g.description = line.description;
      if (!g.reference && line.reference) g.reference = line.reference;
      if (!g.entryDate && line.entryDate) g.entryDate = line.entryDate;
    }
    const list = Array.from(byKey.values());
    for (const g of list) {
      const diff = Math.round((g.totalDebit - g.totalCredit) * 100);
      g.balanced = Math.abs(diff) <= 2;
      if (!g.balanced) g.errors.push(`Out of balance by ${(diff / 100).toFixed(2)}`);
      if (g.lines.length < 2) g.errors.push('Needs at least 2 lines');
      const rowErrs = g.lines.flatMap((l) => l.errors);
      if (rowErrs.length > 0) g.errors.push(`${rowErrs.length} row issue(s)`);
    }
    return list.sort((a, b) => a.entryNumber.localeCompare(b.entryNumber));
  }, [rawRows]);

  const summary = useMemo(() => {
    const total = groups.length;
    const valid = groups.filter((g) => g.errors.length === 0).length;
    const errorRows = rawRows.filter((r) => r.errors.length > 0).length;
    return { total, valid, invalid: total - valid, totalRows: rawRows.length, errorRows };
  }, [groups, rawRows]);

  async function handleImport() {
    if (!organization?.id || !user?.id) {
      toast.error('No active organization');
      return;
    }
    const valid = groups.filter((g) => g.errors.length === 0);
    if (valid.length === 0) {
      toast.error('No valid entries to import');
      return;
    }
    setBusy(true);
    setResults([]);
    setProgress({ done: 0, total: valid.length });
    const out: typeof results = [];
    for (let i = 0; i < valid.length; i++) {
      const g = valid[i];
      try {
        const lines: JournalLineInput[] = g.lines
          .sort((a, b) => a.lineNumber - b.lineNumber)
          .map((l, idx) => {
            const acc = accountMap.get(l.accountCode.toUpperCase())!;
            const deptId = l.departmentCode ? departmentMap.get(l.departmentCode.toUpperCase()) ?? null : null;
            return {
              account_id: acc.id,
              description: l.lineDescription || null,
              debit: l.debit,
              credit: l.credit,
              line_order: idx,
              ...(deptId ? { department_id: deptId } : {}),
            } as JournalLineInput;
          });
        const created = await createJE.mutateAsync({
          organizationId: organization.id,
          userId: user.id,
          entry: {
            reference: g.reference || g.entryNumber,
            entry_date: g.entryDate,
            description: g.description || `Imported ${g.entryNumber}`,
            journal_type: 'manual',
            lines,
          },
        });
        if (postAfterCreate) {
          await postJE.mutateAsync({
            id: (created as any).id,
            organizationId: organization.id,
            userId: user.id,
          });
          out.push({ entry: g.entryNumber, status: 'posted' });
        } else {
          out.push({ entry: g.entryNumber, status: 'created' });
        }
      } catch (err: any) {
        out.push({ entry: g.entryNumber, status: 'failed', message: err?.message ?? String(err) });
      }
      setProgress({ done: i + 1, total: valid.length });
      setResults([...out]);
    }
    setBusy(false);
    const posted = out.filter((r) => r.status !== 'failed').length;
    const failed = out.filter((r) => r.status === 'failed').length;
    if (failed === 0) toast.success(`${posted} ${postAfterCreate ? 'posted' : 'created'}`);
    else toast.warning(`${posted} succeeded, ${failed} failed`);
    onComplete?.();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Bulk Import Journal Entries
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or XLSX using the template. Each unique <code>entry_number</code> becomes one balanced journal entry.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Template + upload */}
          <Card className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-medium">1. Download the template</p>
              <p className="text-xs text-muted-foreground">
                Columns: {JE_TEMPLATE_HEADERS.slice(0, 6).join(', ')}…
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadJournalEntryTemplateCsv}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={downloadJournalEntryTemplateXlsx}>
              <Download className="w-4 h-4 mr-2" />
              XLSX
            </Button>
            <div className="w-full h-px bg-border my-1" />
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-medium">2. Upload your file</p>
              <p className="text-xs text-muted-foreground">{fileName || 'No file selected'}</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Choose file
            </Button>
            {fileName && (
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </Card>

          {/* Summary */}
          {rawRows.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Entries</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-success">{summary.valid}</p>
                <p className="text-xs text-muted-foreground">Valid &amp; balanced</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold text-warning">{summary.invalid}</p>
                <p className="text-xs text-muted-foreground">Needs fixes</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-2xl font-bold">{summary.totalRows}</p>
                <p className="text-xs text-muted-foreground">Lines ({summary.errorRows} bad)</p>
              </Card>
            </div>
          )}

          {/* Preview */}
          {groups.length > 0 && (
            <Card className="flex-1 min-h-0 flex flex-col">
              <ScrollArea className="h-[40vh]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Lines</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((g, i) => {
                      const result = results.find((r) => r.entry === g.entryNumber);
                      return (
                        <TableRow key={g.entryNumber + i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{g.entryNumber}</TableCell>
                          <TableCell>{g.entryDate}</TableCell>
                          <TableCell className="max-w-[280px] truncate">{g.description}</TableCell>
                          <TableCell className="text-right">{g.lines.length}</TableCell>
                          <TableCell className="text-right font-mono">{g.totalDebit.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">{g.totalCredit.toFixed(2)}</TableCell>
                          <TableCell>
                            {result?.status === 'posted' && (
                              <Badge className="bg-success/15 text-success border border-success/30">Posted</Badge>
                            )}
                            {result?.status === 'created' && (
                              <Badge className="bg-warning/15 text-warning border border-warning/30">Created (draft)</Badge>
                            )}
                            {result?.status === 'failed' && (
                              <Badge variant="destructive" title={result.message}>Failed</Badge>
                            )}
                            {!result && g.errors.length === 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-success">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            )}
                            {!result && g.errors.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs text-warning" title={g.errors.join(' • ')}>
                                <AlertTriangle className="w-3 h-3" /> {g.errors[0]}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t mt-2">
          <label className="flex items-center gap-2 text-sm mr-auto">
            <Checkbox checked={postAfterCreate} onCheckedChange={(v) => setPostAfterCreate(!!v)} />
            Post immediately after creating
          </label>
          {progress && (
            <span className="text-xs text-muted-foreground">
              {progress.done}/{progress.total}
            </span>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button onClick={handleImport} disabled={busy || summary.valid === 0}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Import {summary.valid} {summary.valid === 1 ? 'entry' : 'entries'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
