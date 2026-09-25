import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Loader2, Download, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  VALID_ROLES,
  isValidEmail,
  isValidRole,
  parseFile,
  parsePasted,
  downloadTemplate,
  exportFailedCsv,
  type ParsedRow,
} from './bulkInviteTemplate';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RowStatus = 'valid' | 'invalid' | 'skipped';

interface PreviewRow {
  email: string;
  role: string;
  status: RowStatus;
  reason?: string;
}

interface SendResult {
  email: string;
  role: string;
  outcome: 'sent' | 'skipped' | 'failed';
  error?: string;
}

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'finance_manager', label: 'Finance Manager' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'payroll_officer', label: 'Payroll Officer' },
  { value: 'auditor', label: 'Auditor (Read-only)' },
  { value: 'member', label: 'Member' },
];

export function BulkInviteDialog({ open, onOpenChange }: Props) {
  const { organization } = useCurrentOrganization();
  const { isAdmin } = useAuth();
  const { maxUsers, userCount } = useUsageLimits();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'upload' | 'paste'>('upload');
  const [defaultRole, setDefaultRole] = useState('accountant');
  const [pastedText, setPastedText] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SendResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing members & pending invites for de-dup
  const { data: existingEmails } = useQuery({
    queryKey: ['bulk-invite-existing', organization?.id],
    queryFn: async () => {
      if (!organization?.id) return { members: new Set<string>(), pending: new Set<string>() };
      const [membersRes, invitesRes] = await Promise.all([
        supabase.rpc('get_org_member_details', { p_organization_id: organization.id }),
        supabase
          .from('organization_invitations')
          .select('email')
          .eq('organization_id', organization.id)
          .eq('status', 'pending'),
      ]);
      const members = new Set<string>(
        ((membersRes.data ?? []) as { email: string | null }[])
          .map((m) => m.email?.toLowerCase())
          .filter((e): e is string => Boolean(e))
      );
      const pending = new Set<string>(
        ((invitesRes.data ?? []) as { email: string }[]).map((i) => i.email.toLowerCase())
      );
      return { members, pending };
    },
    enabled: open && !!organization?.id,
  });

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setRows([]);
      setPastedText('');
      setResults(null);
      setProgress(0);
      setSending(false);
    }
  }, [open]);

  const validate = (parsed: ParsedRow[]): PreviewRow[] => {
    const seen = new Set<string>();
    return parsed.map<PreviewRow>((r) => {
      if (!isValidEmail(r.email)) {
        return { ...r, status: 'invalid', reason: 'Invalid email format' };
      }
      if (seen.has(r.email)) {
        return { ...r, status: 'invalid', reason: 'Duplicate in batch' };
      }
      seen.add(r.email);
      if (!isValidRole(r.role)) {
        return { ...r, status: 'invalid', reason: `Unknown role: ${r.role}` };
      }
      if (existingEmails?.members.has(r.email)) {
        return { ...r, status: 'skipped', reason: 'Already a member' };
      }
      if (existingEmails?.pending.has(r.email)) {
        return { ...r, status: 'skipped', reason: 'Invitation already pending' };
      }
      return { ...r, status: 'valid' };
    });
  };

  const handleFile = async (file: File) => {
    try {
      const parsed = await parseFile(file, defaultRole);
      if (parsed.length === 0) {
        toast.error('No rows found in file');
        return;
      }
      setRows(validate(parsed));
    } catch (err) {
      toast.error('Failed to parse file: ' + (err as Error).message);
    }
  };

  const handleParsePaste = () => {
    const parsed = parsePasted(pastedText, defaultRole);
    if (parsed.length === 0) {
      toast.error('No emails found');
      return;
    }
    setRows(validate(parsed));
  };

  const updateRowRole = (index: number, role: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], role };
      // re-validate this row's role only
      if (!isValidRole(role)) {
        next[index].status = 'invalid';
        next[index].reason = `Unknown role: ${role}`;
      } else if (next[index].reason?.startsWith('Unknown role') || next[index].status === 'invalid') {
        // Try full re-validate for this single row
        const single = validate([{ email: next[index].email, role }]);
        next[index] = single[0];
      }
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const validCount = rows.filter((r) => r.status === 'valid').length;
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;
  const skippedCount = rows.filter((r) => r.status === 'skipped').length;

  const remainingSeats =
    !isAdmin && maxUsers !== null ? Math.max(0, maxUsers - userCount) : Infinity;
  const exceedsCap = validCount > remainingSeats;

  const canSend = validCount > 0 && !exceedsCap && !sending;

  const handleSend = async () => {
    if (!organization?.id) return;
    setSending(true);
    setProgress(0);
    const toSend = rows.filter((r) => r.status === 'valid');
    const skippedResults: SendResult[] = rows
      .filter((r) => r.status === 'skipped')
      .map((r) => ({ email: r.email, role: r.role, outcome: 'skipped', error: r.reason }));

    const collected: SendResult[] = [...skippedResults];
    const concurrency = 3;
    let completed = 0;

    const worker = async (queue: PreviewRow[]) => {
      while (queue.length > 0) {
        const row = queue.shift();
        if (!row) break;
        try {
          const response = await supabase.functions.invoke('send-invitation', {
            body: {
              email: row.email,
              role: row.role,
              organizationId: organization.id,
              organizationName: organization.name,
            },
          });
          if (response.error) {
            collected.push({
              email: row.email,
              role: row.role,
              outcome: 'failed',
              error: response.error.message || 'Failed',
            });
          } else if (response.data?.error) {
            const err = response.data.error as string;
            const alreadyMember = err.includes('already a team member') || response.data?.code === 'ALREADY_MEMBER';
            collected.push({
              email: row.email,
              role: row.role,
              outcome: alreadyMember ? 'skipped' : 'failed',
              error: err,
            });
          } else {
            collected.push({ email: row.email, role: row.role, outcome: 'sent' });
          }
        } catch (err) {
          collected.push({
            email: row.email,
            role: row.role,
            outcome: 'failed',
            error: (err as Error).message,
          });
        }
        completed += 1;
        setProgress(Math.round((completed / toSend.length) * 100));
      }
    };

    const queue = [...toSend];
    await Promise.all(Array.from({ length: concurrency }, () => worker(queue)));

    setResults(collected);
    setSending(false);
    queryClient.invalidateQueries({ queryKey: ['organization-invitations', organization.id] });
    queryClient.invalidateQueries({ queryKey: ['bulk-invite-existing', organization.id] });

    const sent = collected.filter((r) => r.outcome === 'sent').length;
    if (sent > 0) toast.success(`Sent ${sent} invitation${sent === 1 ? '' : 's'}`);
  };

  const statusBadge = (status: RowStatus) => {
    switch (status) {
      case 'valid':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Valid</Badge>;
      case 'invalid':
        return <Badge variant="destructive">Invalid</Badge>;
      case 'skipped':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Skipped</Badge>;
    }
  };

  // Results view
  if (results) {
    const sent = results.filter((r) => r.outcome === 'sent');
    const skipped = results.filter((r) => r.outcome === 'skipped');
    const failed = results.filter((r) => r.outcome === 'failed');

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Invite Results</DialogTitle>
            <DialogDescription>
              {sent.length} sent · {skipped.length} skipped · {failed.length} failed
            </DialogDescription>
          </DialogHeader>

          {sent.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" /> Sent ({sent.length})
              </h4>
              <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto space-y-1">
                {sent.map((r) => <div key={r.email}>{r.email}</div>)}
              </div>
            </div>
          )}

          {skipped.length > 0 && (
            <div>
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Skipped ({skipped.length})
              </h4>
              <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto space-y-1">
                {skipped.map((r) => (
                  <div key={r.email}>{r.email} — {r.error}</div>
                ))}
              </div>
            </div>
          )}

          {failed.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <X className="w-4 h-4 text-destructive" /> Failed ({failed.length})
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    exportFailedCsv(
                      failed.map((r) => ({ email: r.email, role: r.role, error: r.error ?? '' }))
                    )
                  }
                >
                  <Download className="w-3 h-3 mr-1" /> Export CSV
                </Button>
              </div>
              <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto space-y-1">
                {failed.map((r) => (
                  <div key={r.email}>{r.email} — {r.error}</div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Invite Users</DialogTitle>
          <DialogDescription>
            Invite multiple users at once by uploading a file or pasting a list.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'upload' | 'paste')}>
            <TabsList>
              <TabsTrigger value="upload">Upload file</TabsTrigger>
              <TabsTrigger value="paste">Paste list</TabsTrigger>
            </TabsList>

            <div className="mt-4 mb-4 flex items-end gap-3">
              <div className="flex-1">
                <Label>Default role (used when not specified)</Label>
                <Select value={defaultRole} onValueChange={setDefaultRole}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value="upload" className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFile(file);
                }}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm">Click or drag a CSV / XLSX file</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Columns: <code>email</code>, <code>role</code> (optional)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = '';
                  }}
                />
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <FileText className="w-4 h-4 mr-2" />
                Download template
              </Button>
              <p className="text-xs text-muted-foreground">
                Valid roles: {VALID_ROLES.join(', ')}
              </p>
            </TabsContent>

            <TabsContent value="paste" className="space-y-4">
              <Textarea
                placeholder={'jane@example.com\njohn@example.com,admin\nalice@example.com,member'}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                One entry per line. Optional role after a comma. Otherwise the default role is used.
              </p>
              <Button onClick={handleParsePaste} disabled={!pastedText.trim()}>
                Preview
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                {validCount} valid
              </Badge>
              {skippedCount > 0 && (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                  {skippedCount} skipped
                </Badge>
              )}
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} invalid</Badge>}
              <Button size="sm" variant="ghost" onClick={() => setRows([])}>
                Clear & start over
              </Button>
            </div>

            {exceedsCap && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md p-3 text-sm flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  This batch would exceed your plan limit.{' '}
                  <strong>{remainingSeats}</strong> seat{remainingSeats === 1 ? '' : 's'} remaining,{' '}
                  <strong>{validCount}</strong> valid invite{validCount === 1 ? '' : 's'}.
                  Remove rows or upgrade your plan to continue.
                </div>
              </div>
            )}

            <div className="border rounded-md max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Email</th>
                    <th className="text-left p-2 font-medium">Role</th>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">
                        <span className={row.status === 'invalid' ? 'text-destructive' : ''}>
                          {row.email}
                        </span>
                        {row.reason && (
                          <div className="text-xs text-muted-foreground">{row.reason}</div>
                        )}
                      </td>
                      <td className="p-2">
                        <Select
                          value={isValidRole(row.role) ? row.role : ''}
                          onValueChange={(v) => updateRowRole(i, v)}
                        >
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue placeholder={row.role || 'Select role'} />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">{statusBadge(row.status)}</td>
                      <td className="p-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => removeRow(i)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sending && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground text-center">
                  Sending invitations… {progress}%
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          {rows.length > 0 && (
            <Button onClick={handleSend} disabled={!canSend}>
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                `Send ${validCount} invitation${validCount === 1 ? '' : 's'}`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
