import { useState } from 'react';
import { Sparkles, Loader2, Wand2, Copy, Check, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface FinancialSummary {
  vendor_or_payer?: string | null;
  document_date?: string | null;
  document_reference?: string | null;
  currency?: string | null;
  subtotal?: number | null;
  tax_total?: number | null;
  grand_total?: number | null;
  tax_breakdown?: Array<{ label: string; amount: number }>;
  je_debit_total?: number;
  je_credit_total?: number;
  variance_vs_je?: number | null;
  reconciliation_status?: 'matches' | 'minor_variance' | 'mismatch' | 'unknown';
  notes?: string | null;
}

interface Props {
  journalEntryId?: string | null;
  currentNotes?: string | null;
  hasAttachments: boolean;
  readOnly?: boolean;
  onNotesUpdated?: (notes: string) => void;
}

const money = (n?: number | null, cur?: string | null) =>
  n == null || Number.isNaN(Number(n))
    ? '—'
    : `${cur ? cur + ' ' : ''}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const reconBadge = (status?: string) => {
  switch (status) {
    case 'matches':
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Matches JE</Badge>;
    case 'minor_variance':
      return <Badge className="bg-amber-500 hover:bg-amber-500">Minor variance</Badge>;
    case 'mismatch':
      return <Badge variant="destructive">Mismatch</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
};

export function JournalAIAnalyzer({
  journalEntryId,
  currentNotes,
  hasAttachments,
  readOnly,
  onNotesUpdated,
}: Props) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [narrative, setNarrative] = useState<string>('');
  const [financial, setFinancial] = useState<FinancialSummary | null>(null);
  const [formatted, setFormatted] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  if (!journalEntryId || !hasAttachments) return null;

  const analyze = async () => {
    setLoading(true);
    setSummary('');
    setNarrative('');
    setFinancial(null);
    setFormatted('');
    setWarnings([]);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-je-attachments', {
        body: { journal_entry_id: journalEntryId },
      });
      if (error) {
        let serverMsg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) serverMsg = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(serverMsg);
      }
      const d: any = data;
      if (d?.error) throw new Error(d.error);
      setSummary(d.summary || '');
      setNarrative(d.narrative || '');
      setFinancial(d.financial_summary || null);
      setFormatted(d.formatted || '');
      setWarnings(d.warnings || []);
      toast.success(`Analyzed ${d.files_analyzed} document(s)`);
    } catch (e: any) {
      toast.error(e.message || 'AI analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const persist = async (mode: 'append' | 'replace') => {
    if (!formatted) return;
    const nextNotes =
      mode === 'append' && currentNotes?.trim()
        ? `${currentNotes.trim()}\n\n${formatted}`
        : formatted;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('journal_entries')
        .update({ notes: nextNotes })
        .eq('id', journalEntryId);
      if (error) throw error;
      onNotesUpdated?.(nextNotes);
      qc.invalidateQueries({ queryKey: ['journal-entries'] });
      qc.invalidateQueries({ queryKey: ['journal-entry', journalEntryId] });
      toast.success(mode === 'append' ? 'Summary appended to notes' : 'Notes replaced with AI summary');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(formatted || summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-md border bg-gradient-to-br from-primary/5 to-transparent p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Document Analyzer
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={analyze} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              {summary ? 'Re-analyze' : 'Analyze attachments'}
            </>
          )}
        </Button>
      </div>

      {!summary && !loading && (
        <p className="text-xs text-muted-foreground">
          Extracts vendor, amounts, taxes, and a reconciliation check from the attached receipts,
          invoices, or statements — then adds a summary to this JE's notes.
        </p>
      )}

      {financial && (
        <div className="rounded-md border bg-background p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Receipt className="h-4 w-4 text-primary" />
              Financial Summary
            </div>
            {reconBadge(financial.reconciliation_status)}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-muted-foreground">Vendor / Payer</div>
              <div className="font-medium">{financial.vendor_or_payer || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Document Date</div>
              <div className="font-medium">{financial.document_date || '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Reference</div>
              <div className="font-medium">{financial.document_reference || '—'}</div>
            </div>
          </div>

          <div className="rounded border divide-y text-xs">
            <div className="flex justify-between px-2 py-1">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{money(financial.subtotal, financial.currency)}</span>
            </div>
            <div className="flex justify-between px-2 py-1">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-mono">{money(financial.tax_total, financial.currency)}</span>
            </div>
            <div className="flex justify-between px-2 py-1 bg-muted/40">
              <span className="font-semibold">Grand Total</span>
              <span className="font-mono font-semibold">{money(financial.grand_total, financial.currency)}</span>
            </div>
            <div className="flex justify-between px-2 py-1">
              <span className="text-muted-foreground">JE Debit / Credit</span>
              <span className="font-mono">
                {money(financial.je_debit_total)} / {money(financial.je_credit_total)}
              </span>
            </div>
            {financial.variance_vs_je != null && (
              <div className="flex justify-between px-2 py-1">
                <span className="text-muted-foreground">Variance vs JE</span>
                <span className="font-mono">{money(financial.variance_vs_je, financial.currency)}</span>
              </div>
            )}
          </div>

          {financial.tax_breakdown && financial.tax_breakdown.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {financial.tax_breakdown.map((t, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {t.label}: {money(t.amount, financial.currency)}
                </Badge>
              ))}
            </div>
          )}

          {financial.notes && (
            <p className="text-xs text-muted-foreground italic">{financial.notes}</p>
          )}
        </div>
      )}

      {(summary || narrative) && (
        <>
          <Textarea
            value={formatted}
            onChange={(e) => setFormatted(e.target.value)}
            rows={8}
            className="text-xs font-mono"
          />
          {warnings.length > 0 && (
            <div className="text-xs text-amber-600">
              {warnings.map((w, i) => (
                <div key={i}>⚠ {w}</div>
              ))}
            </div>
          )}
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => persist('append')} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Append to Notes
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => persist('replace')} disabled={saving}>
                Replace Notes
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={copy}>
                {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                Copy
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
