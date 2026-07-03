import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, Download } from 'lucide-react';
import { useComplianceExports, DEFAULT_SCOPE, type SoC2ExportScope } from '@/hooks/useComplianceExports';

const LABELS: Record<keyof SoC2ExportScope, string> = {
  audit_log: 'CRA audit log',
  approvals: 'Approval decisions',
  pad_agreements: 'PAD agreements',
  reconciliation: 'Reconciliation review history',
  fintrac: 'FINTRAC LCTR reports',
  delegations: 'Accountant delegation history',
  webhooks: 'Webhook event counts',
};

export default function ComplianceExports() {
  const { generate } = useComplianceExports();
  const yearStart = new Date().getFullYear() + '-01-01';
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(yearStart);
  const [end, setEnd] = useState(today);
  const [scope, setScope] = useState<SoC2ExportScope>(DEFAULT_SCOPE);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Compliance Exports</h1>
        <p className="text-muted-foreground">Generate SOC-2-friendly evidence packs covering treasury, approvals and FINTRAC activity.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> SOC-2 evidence pack</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Period start</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>Period end</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            {(Object.keys(LABELS) as Array<keyof SoC2ExportScope>).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Checkbox checked={scope[k]} onCheckedChange={(v) => setScope((s) => ({ ...s, [k]: !!v }))} />
                {LABELS[k]}
              </label>
            ))}
          </div>

          <Button onClick={() => generate.mutate({ period_start: start, period_end: end, scope })} disabled={generate.isPending}>
            <Download className="mr-1 h-4 w-4" /> Generate evidence pack
          </Button>
          <p className="text-xs text-muted-foreground">Stored privately for 30 days. A signed download link opens automatically.</p>
        </CardContent>
      </Card>
    </div>
  );
}
