import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, ArrowRight, Calendar } from 'lucide-react';
import { usePeriodClose, CLOSE_STATUSES, type CloseStatus, type PeriodCloseRow } from '@/hooks/usePeriodClose';

const STATUS_TONE: Record<CloseStatus, string> = {
  open: 'bg-muted text-muted-foreground',
  reconciled: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  filed: 'bg-purple-500/10 text-purple-700 dark:text-purple-300',
  paid: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  closed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};

const NEXT_STATUS: Record<CloseStatus, CloseStatus | null> = {
  open: 'reconciled',
  reconciled: 'filed',
  filed: 'paid',
  paid: 'closed',
  closed: null,
};

export default function PeriodClose() {
  const { rows, isLoading, dueSoon, byStatus, create, setStatus } = usePeriodClose();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    authority: 'CRA',
    program_code: '',
    period_start: '',
    period_end: '',
    statutory_due_date: '',
  });

  const summary = useMemo(() => ({
    open: byStatus('open').length,
    reconciled: byStatus('reconciled').length,
    filed: byStatus('filed').length,
    paid: byStatus('paid').length,
    closed: byStatus('closed').length,
  }), [rows]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Period Close</h1>
          <p className="text-muted-foreground">Track each remittance period from open through closed. Status auto-advances when payments post.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Add period</Button>
      </div>

      {dueSoon.length > 0 && (
        <Card className="border-l-4 border-l-amber-500 bg-amber-500/5">
          <CardContent className="py-3 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-amber-600" />
            <p className="text-sm">
              <strong>{dueSoon.length}</strong> period{dueSoon.length === 1 ? '' : 's'} due within 7 days and not yet closed.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-5">
        {CLOSE_STATUSES.map((s) => (
          <Card key={s}>
            <CardHeader className="pb-2"><CardTitle className="text-sm capitalize text-muted-foreground">{s}</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{summary[s]}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5 md:grid-cols-2">
        {CLOSE_STATUSES.map((s) => (
          <div key={s} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold capitalize">{s}</h3>
              <Badge variant="outline">{byStatus(s).length}</Badge>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {byStatus(s).map((r) => <PeriodCard key={r.id} row={r} onAdvance={setStatus.mutate} />)}
              {byStatus(s).length === 0 && (
                <p className="text-xs text-muted-foreground italic py-4 text-center">Empty</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add period</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Authority</label>
                <Select value={form.authority} onValueChange={(v) => setForm({ ...form, authority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRA">CRA</SelectItem>
                    <SelectItem value="Revenu Québec">Revenu Québec</SelectItem>
                    <SelectItem value="WSIB">WSIB</SelectItem>
                    <SelectItem value="EHT">EHT</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Program code</label>
                <Input value={form.program_code} onChange={(e) => setForm({ ...form, program_code: e.target.value })} placeholder="RP, RT, RC…" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Period start</label>
                <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Period end</label>
                <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Statutory due date</label>
                <Input type="date" value={form.statutory_due_date} onChange={(e) => setForm({ ...form, statutory_due_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.authority || !form.period_start || !form.period_end || create.isPending}
              onClick={() => create.mutate({
                authority: form.authority,
                program_code: form.program_code || null,
                period_start: form.period_start,
                period_end: form.period_end,
                statutory_due_date: form.statutory_due_date || null,
              } as any, { onSuccess: () => { setOpen(false); setForm({ authority: 'CRA', program_code: '', period_start: '', period_end: '', statutory_due_date: '' }); } })}
            >Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PeriodCard({ row, onAdvance }: { row: PeriodCloseRow; onAdvance: (input: { id: string; status: CloseStatus }) => void }) {
  const next = NEXT_STATUS[row.status];
  return (
    <Card className="text-xs">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center justify-between">
          <Badge className={STATUS_TONE[row.status]}>{row.authority}{row.program_code ? ` · ${row.program_code}` : ''}</Badge>
        </div>
        <p className="font-mono text-xs">{row.period_start} → {row.period_end}</p>
        {row.statutory_due_date && (
          <p className="text-muted-foreground">Due {row.statutory_due_date}</p>
        )}
        {next && (
          <Button size="sm" variant="outline" className="h-7 w-full text-xs" onClick={() => onAdvance({ id: row.id, status: next })}>
            <ArrowRight className="h-3 w-3 mr-1" />Mark {next}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
