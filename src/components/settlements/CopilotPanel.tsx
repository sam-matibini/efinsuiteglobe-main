import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from '@/hooks/useOrganizationContext';
import { toast } from 'sonner';

type Skill = 'explain_variance' | 'suggest_matches' | 'draft_writeoff_memo' | 'draft_str_narrative' | 'summarise_audit_period';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  context?: { settlement_id?: string; transaction_id?: string };
}

const SKILL_LABEL: Record<Skill, string> = {
  explain_variance: 'Explain variance',
  suggest_matches: 'Suggest matches',
  draft_writeoff_memo: 'Draft write-off memo',
  draft_str_narrative: 'Draft FINTRAC STR narrative',
  summarise_audit_period: 'Summarise audit period',
};

export function CopilotPanel({ open, onOpenChange, context }: Props) {
  const { currentOrganization } = useOrganizationContext();
  const [skill, setSkill] = useState<Skill>(context?.settlement_id ? 'explain_variance' : 'summarise_audit_period');
  const [reason, setReason] = useState('');
  const [start, setStart] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!currentOrganization?.id) return;
    setBusy(true);
    setResult('');
    try {
      const { data, error } = await supabase.functions.invoke('reconciliation-copilot', {
        body: {
          skill,
          organization_id: currentOrganization.id,
          settlement_id: context?.settlement_id,
          transaction_id: context?.transaction_id,
          reason: reason || undefined,
          start: skill === 'summarise_audit_period' ? start : undefined,
          end: skill === 'summarise_audit_period' ? end : undefined,
        },
      });
      if (error) throw error;
      setResult((data as any)?.result ?? 'No output.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Copilot failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  const availableSkills: Skill[] = context?.settlement_id
    ? ['explain_variance', 'suggest_matches', 'draft_writeoff_memo', 'summarise_audit_period']
    : context?.transaction_id
      ? ['draft_str_narrative', 'summarise_audit_period']
      : ['summarise_audit_period'];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Reconciliation Copilot</SheetTitle>
          <SheetDescription>AI assistance powered by Lovable AI. Output is a draft for human review.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {availableSkills.map((s) => (
              <Button key={s} size="sm" variant={skill === s ? 'default' : 'outline'} onClick={() => setSkill(s)}>
                {SKILL_LABEL[s]}
              </Button>
            ))}
          </div>

          {skill === 'draft_writeoff_memo' && (
            <Textarea placeholder="Reason for write-off…" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          )}
          {skill === 'summarise_audit_period' && (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs">Start</label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" /></div>
              <div><label className="text-xs">End</label><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" /></div>
            </div>
          )}

          <Button onClick={run} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Run {SKILL_LABEL[skill]}
          </Button>

          {result && (
            <Card>
              <CardContent className="p-4 whitespace-pre-wrap text-sm leading-relaxed">{result}</CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
