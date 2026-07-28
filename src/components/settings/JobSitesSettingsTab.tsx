import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Plus, Trash2, Pencil, Check, X, Upload, Download, FileUp } from 'lucide-react';
import { useJobSites, type JobSite } from '@/hooks/useJobSites';
import {
  downloadJobSitesTemplate,
  parseJobSitesFile,
  parsePastedJobSites,
  exportFailedJobSitesCsv,
  validateRows,
  type ValidatedRow,
} from '@/lib/jobSitesBulk';
import { toast } from 'sonner';
import { useCountryScope, normalizeCountryCode } from '@/hooks/useCountryFilter';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { getCountryLocalization } from '@/data/countryLocalizations';

const NONE = '__none__';

export function JobSitesSettingsTab() {
  const { jobSites, isLoading, createSite, updateSite, deleteSite, bulkCreateSites } = useJobSites();
  const { country: scopedCountry } = useCountryScope();
  const { organization } = useCurrentOrganization();

  const countryCode =
    scopedCountry || normalizeCountryCode(organization?.country) || 'CA';
  const loc = getCountryLocalization(countryCode);
  const jurisdictions = loc.jurisdictions;
  const jurisdictionLabel = loc.jurisdictionLabel || 'State/Province';
  const jurNameByCode = useMemo(() => {
    const m = new Map<string, string>();
    jurisdictions.forEach((j) => m.set(j.code.toUpperCase(), j.name));
    return m;
  }, [jurisdictions]);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [stateProv, setStateProv] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editState, setEditState] = useState<string>('');

  const [pasted, setPasted] = useState('');
  const [parsed, setParsed] = useState<ValidatedRow[]>([]);
  const [failed, setFailed] = useState<
    { name: string; code: string | null; state_province: string | null; is_active: boolean; error: string }[]
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const existingNames = useMemo(() => jobSites.map((s) => s.name), [jobSites]);
  const jurisdictionCodes = useMemo(() => jurisdictions.map((j) => j.code), [jurisdictions]);

  const validCount = parsed.filter((r) => !r.error).length;

  const handleFile = async (file: File | null) => {
    if (!file) return;
    try {
      const rows = await parseJobSitesFile(file);
      setParsed(validateRows(rows, existingNames, jurisdictionCodes));
      setFailed([]);
    } catch (e) {
      toast.error(`Failed to parse file: ${(e as Error).message}`);
    }
  };

  const handleParsePasted = () => {
    const rows = parsePastedJobSites(pasted);
    if (rows.length === 0) {
      toast.error('No rows detected');
      return;
    }
    setParsed(validateRows(rows, existingNames, jurisdictionCodes));
    setFailed([]);
  };

  const handleImport = async () => {
    const valid = parsed.filter((r) => !r.error);
    if (valid.length === 0) return;
    try {
      await bulkCreateSites.mutateAsync(
        valid.map((r) => ({
          name: r.name,
          code: r.code,
          state_province: r.state_province,
          is_active: r.is_active,
        })),
      );
      const invalid = parsed.filter((r) => r.error);
      setFailed(
        invalid.map((r) => ({
          name: r.name,
          code: r.code,
          state_province: r.state_province,
          is_active: r.is_active,
          error: r.error!,
        })),
      );
      setParsed([]);
      setPasted('');
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      // toast handled in mutation
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    await createSite.mutateAsync({
      name,
      code: code || null,
      state_province: stateProv || null,
    });
    setName('');
    setCode('');
    setStateProv('');
  };

  const startEdit = (site: JobSite) => {
    setEditingId(site.id);
    setEditName(site.name);
    setEditCode(site.code || '');
    setEditState(site.state_province || '');
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    await updateSite.mutateAsync({
      id,
      name: editName.trim(),
      code: editCode.trim() || null,
      state_province: editState || null,
    });
    setEditingId(null);
  };

  const renderState = (val: string | null | undefined) => {
    if (!val) return <span className="text-muted-foreground">—</span>;
    const name = jurNameByCode.get(val.toUpperCase());
    return name ? `${val} — ${name}` : val;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Job Sites / Locations
          </CardTitle>
          <CardDescription>
            Manage the list of physical job sites or work locations. Employees must be assigned
            to a site during onboarding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add new */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="site-name">Site name *</Label>
              <Input
                id="site-name"
                placeholder="e.g. Head Office, Lagos Branch, Site A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-code">Code (optional)</Label>
              <Input
                id="site-code"
                placeholder="e.g. HQ"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-state">{jurisdictionLabel} (optional)</Label>
              <Select value={stateProv || NONE} onValueChange={(v) => setStateProv(v === NONE ? '' : v)}>
                <SelectTrigger id="site-state">
                  <SelectValue placeholder={`Select ${jurisdictionLabel.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— None —</SelectItem>
                  {jurisdictions.map((j) => (
                    <SelectItem key={j.code} value={j.code}>
                      {j.code} — {j.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={!name.trim() || createSite.isPending}>
              <Plus className="w-4 h-4 mr-2" />
              Add site
            </Button>
          </div>

          {/* List */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead className="w-48">{jurisdictionLabel}</TableHead>
                  <TableHead className="w-32">Active</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : jobSites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                      No job sites yet. Add one above to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  jobSites.map((site) => {
                    const editing = editingId === site.id;
                    return (
                      <TableRow key={site.id}>
                        <TableCell>
                          {editing ? (
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              maxLength={120}
                            />
                          ) : (
                            <span className="font-medium">{site.name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editing ? (
                            <Input
                              value={editCode}
                              onChange={(e) => setEditCode(e.target.value)}
                              maxLength={20}
                            />
                          ) : (
                            site.code || <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editing ? (
                            <Select
                              value={editState || NONE}
                              onValueChange={(v) => setEditState(v === NONE ? '' : v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>— None —</SelectItem>
                                {jurisdictions.map((j) => (
                                  <SelectItem key={j.code} value={j.code}>
                                    {j.code} — {j.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            renderState(site.state_province)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={site.is_active}
                              onCheckedChange={(v) =>
                                updateSite.mutate({ id: site.id, is_active: v })
                              }
                            />
                            {site.is_active ? (
                              <Badge variant="secondary">Active</Badge>
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {editing ? (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => saveEdit(site.id)}>
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => startEdit(site)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Delete "${site.name}"? Employees assigned to this site must be reassigned first.`,
                                    )
                                  ) {
                                    deleteSite.mutate(site.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Bulk import job sites
          </CardTitle>
          <CardDescription>
            Upload a CSV/XLSX file or paste rows to add multiple sites at once. State/Province is
            validated against {loc.name}'s {jurisdictionLabel.toLowerCase()} list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={downloadJobSitesTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download template
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <FileUp className="w-4 h-4 mr-2" />
              Choose file (.csv, .xlsx)
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-paste">
              Or paste rows (one per line: name, code, state_province, is_active)
            </Label>
            <Textarea
              id="bulk-paste"
              rows={4}
              placeholder={'Head Office, HQ, LA, true\nLagos Branch, LAG, LA'}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <Button variant="secondary" size="sm" onClick={handleParsePasted} disabled={!pasted.trim()}>
              Preview pasted rows
            </Button>
          </div>

          {parsed.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {validCount} valid / {parsed.length - validCount} with issues
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setParsed([])}>
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={validCount === 0 || bulkCreateSites.isPending}
                  >
                    Import {validCount} site{validCount === 1 ? '' : 's'}
                  </Button>
                </div>
              </div>
              <div className="rounded-md border max-h-80 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-20">Code</TableHead>
                      <TableHead className="w-32">{jurisdictionLabel}</TableHead>
                      <TableHead className="w-20">Active</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((r, idx) => (
                      <TableRow key={idx} className={r.error ? 'bg-destructive/5' : ''}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.code || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          {r.state_province || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>{r.is_active ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          {r.error ? (
                            <Badge variant="destructive">{r.error}</Badge>
                          ) : r.warning ? (
                            <Badge variant="outline">{r.warning}</Badge>
                          ) : (
                            <Badge variant="secondary">Ready</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {failed.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-center justify-between">
              <div className="text-sm">
                {failed.length} row{failed.length === 1 ? '' : 's'} were skipped due to validation issues.
              </div>
              <Button variant="outline" size="sm" onClick={() => exportFailedJobSitesCsv(failed)}>
                <Download className="w-4 h-4 mr-2" />
                Download failed rows
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default JobSitesSettingsTab;
