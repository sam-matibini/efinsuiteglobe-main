import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSignature, Send, Sparkles, Download } from 'lucide-react';
import { useVendorSlips } from '@/hooks/useVendorSlips';
import { useCurrencyFormatter } from '@/hooks/useCurrencyFormatter';

const SLIP_TYPES = ['T4A', 'T5018', '1099-NEC', '1099-MISC'];

function statusBadge(status: string) {
  const map: Record<string, any> = {
    draft: 'outline',
    issued: 'secondary',
    amended: 'default',
    void: 'destructive',
  };
  return <Badge variant={map[status] ?? 'outline'}>{status}</Badge>;
}

export default function VendorSlips() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear - 1);
  const [slipType, setSlipType] = useState<string>('T4A');
  const { slips, isLoading, generate, efile } = useVendorSlips(year);
  const fmt = useCurrencyFormatter();

  const filtered = useMemo(() => slips.filter((s) => s.slip_type === slipType), [slips, slipType]);
  const totals = useMemo(() => ({
    count: filtered.length,
    amount: filtered.reduce((s, x) => s + Number(x.total_amount ?? 0), 0),
    issued: filtered.filter((s) => s.status === 'issued').length,
  }), [filtered]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendor Tax Slips</h1>
          <p className="text-muted-foreground">Year-end T4A, T5018, 1099-NEC and 1099-MISC issuance.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue/></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={slipType} onValueChange={setSlipType}>
            <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
            <SelectContent>{SLIP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => generate.mutate({ tax_year: year, slip_type: slipType as any })} disabled={generate.isPending}>
            <Sparkles className="mr-2 h-4 w-4"/>Aggregate slips
          </Button>
          <Button onClick={() => efile.mutate({ tax_year: year, slip_type: slipType })} disabled={efile.isPending || totals.count === 0}>
            <Send className="mr-2 h-4 w-4"/>E-file batch
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Slips</div><div className="text-2xl font-bold">{totals.count}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Total amount</div><div className="text-2xl font-bold">{fmt.formatWithSymbol(totals.amount)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase text-muted-foreground">Issued</div><div className="text-2xl font-bold">{totals.issued} / {totals.count}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5"/>{slipType} — {year}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead className="text-right">XML</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.vendor_id.slice(0, 8)}</TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell className="text-right">{fmt.formatWithSymbol(s.total_amount)}</TableCell>
                    <TableCell>{s.currency}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.issued_at ? new Date(s.issued_at).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="text-right">
                      {s.xml_url ? (
                        <Button asChild size="sm" variant="ghost">
                          <a href={s.xml_url} target="_blank" rel="noopener noreferrer"><Download className="h-3 w-3"/></a>
                        </Button>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No slips. Click <strong>Aggregate slips</strong> to generate from posted AP.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
