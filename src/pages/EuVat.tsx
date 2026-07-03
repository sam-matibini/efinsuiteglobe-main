/**
 * Phase 13 — EU VAT OSS / MOSS + Reverse Charge dashboard.
 *
 * Tabs:
 *  - Overview & Calculator (resolve scenario + VAT for a sample sale)
 *  - OSS Registrations
 *  - OSS Returns (quarterly XML packets)
 *  - VIES Validations + Reverse Charge log
 *  - VAT Rates reference
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  useEuVatRates, useOssRegistrations, useViesValidate,
  useEuVatCalculator, useOssReturns, useReverseChargeLog,
} from '@/hooks/useEuVat';
import { EU_COUNTRIES } from '@/lib/euVat/types';
import { Globe, FileCode, ShieldCheck, Calculator as CalcIcon, BookOpen } from 'lucide-react';

export default function EuVat() {
  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="h-7 w-7" /> EU VAT — OSS / MOSS &amp; Reverse Charge
        </h1>
        <p className="text-muted-foreground mt-1">
          Cross-border digital services and B2B EU sales: One Stop Shop quarterly returns, VIES VAT-ID validation,
          and reverse-charge audit trail.
        </p>
      </header>

      <Tabs defaultValue="calculator" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="calculator"><CalcIcon className="h-4 w-4 mr-1" />Calculator</TabsTrigger>
          <TabsTrigger value="registrations"><ShieldCheck className="h-4 w-4 mr-1" />Registrations</TabsTrigger>
          <TabsTrigger value="returns"><FileCode className="h-4 w-4 mr-1" />OSS Returns</TabsTrigger>
          <TabsTrigger value="vies">VIES &amp; Reverse Charge</TabsTrigger>
          <TabsTrigger value="rates"><BookOpen className="h-4 w-4 mr-1" />Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="calculator"><CalculatorTab /></TabsContent>
        <TabsContent value="registrations"><RegistrationsTab /></TabsContent>
        <TabsContent value="returns"><ReturnsTab /></TabsContent>
        <TabsContent value="vies"><ViesTab /></TabsContent>
        <TabsContent value="rates"><RatesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Calculator ----------
function CalculatorTab() {
  const { calculate } = useEuVatCalculator();
  const vies = useViesValidate();
  const [supplier, setSupplier] = useState('IE');
  const [customer, setCustomer] = useState('DE');
  const [vatNumber, setVatNumber] = useState('');
  const [supplyType, setSupplyType] = useState<'services' | 'goods'>('services');
  const [amount, setAmount] = useState(100);
  const [validated, setValidated] = useState(false);

  const result = useMemo(() => calculate({
    organizationId: '', supplierCountry: supplier, customerCountry: customer,
    customerVatNumber: vatNumber, supplyType, netAmount: amount,
  }, validated), [supplier, customer, vatNumber, supplyType, amount, validated, calculate]);

  const onValidate = async () => {
    if (!vatNumber || vatNumber.length < 4) return;
    const cc = vatNumber.slice(0, 2).toUpperCase();
    const num = vatNumber.slice(2);
    const r = await vies.mutateAsync({ countryCode: cc, vatNumber: num });
    setValidated(r.isValid);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>EU VAT Scenario Calculator</CardTitle>
        <CardDescription>Determine domestic vs OSS B2C vs B2B reverse charge in real time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Supplier country</Label>
            <CountrySelect value={supplier} onChange={setSupplier} />
          </div>
          <div>
            <Label>Customer country</Label>
            <CountrySelect value={customer} onChange={setCustomer} includeOutside />
          </div>
          <div>
            <Label>Supply type</Label>
            <Select value={supplyType} onValueChange={(v) => setSupplyType(v as 'services' | 'goods')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="services">Services (digital)</SelectItem>
                <SelectItem value="goods">Goods</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Net amount (EUR)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
          </div>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label>Customer VAT number (optional, B2B)</Label>
            <Input placeholder="e.g. DE123456789" value={vatNumber}
              onChange={(e) => { setVatNumber(e.target.value); setValidated(false); }} />
          </div>
          <Button variant="outline" onClick={onValidate} disabled={!vatNumber || vies.isPending}>
            {vies.isPending ? 'Checking VIES…' : 'Validate via VIES'}
          </Button>
        </div>

        <div className="border rounded-lg p-4 bg-muted/40 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Scenario: {result.scenario.replace(/_/g, ' ')}</Badge>
            {result.reverseCharge && <Badge>Reverse charge</Badge>}
            {result.vatCountry && <Badge variant="outline">VAT country: {result.vatCountry}</Badge>}
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm pt-2">
            <div><div className="text-muted-foreground">Net</div><div className="font-semibold">€{result.netAmount.toFixed(2)}</div></div>
            <div><div className="text-muted-foreground">VAT @ {result.vatRate}%</div><div className="font-semibold">€{result.vatAmount.toFixed(2)}</div></div>
            <div><div className="text-muted-foreground">Gross</div><div className="font-semibold">€{result.grossAmount.toFixed(2)}</div></div>
          </div>
          <ul className="text-sm text-muted-foreground list-disc pl-5 pt-2">
            {result.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function CountrySelect({ value, onChange, includeOutside }: { value: string; onChange: (v: string) => void; includeOutside?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {EU_COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        {includeOutside && (
          <>
            <SelectItem value="GB">GB (non-EU)</SelectItem>
            <SelectItem value="US">US (non-EU)</SelectItem>
            <SelectItem value="CA">CA (non-EU)</SelectItem>
            <SelectItem value="CH">CH (non-EU)</SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}

// ---------- Registrations ----------
function RegistrationsTab() {
  const { registrations, upsert } = useOssRegistrations();
  const [scheme, setScheme] = useState<'union' | 'non_union' | 'import_ioss'>('union');
  const [msi, setMsi] = useState('IE');
  const [number, setNumber] = useState('');
  const [effective, setEffective] = useState(new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Add OSS / IOSS registration</CardTitle>
          <CardDescription>Register the Member State of Identification where you submit OSS returns.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label>Scheme</Label>
              <Select value={scheme} onValueChange={(v) => setScheme(v as typeof scheme)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="union">Union (EU established)</SelectItem>
                  <SelectItem value="non_union">Non-Union</SelectItem>
                  <SelectItem value="import_ioss">Import (IOSS)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Identification State</Label>
              <CountrySelect value={msi} onChange={setMsi} />
            </div>
            <div className="md:col-span-2">
              <Label>OSS registration number</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="EU372…" />
            </div>
            <div>
              <Label>Effective date</Label>
              <Input type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
            </div>
          </div>
          <div className="pt-3">
            <Button onClick={() => upsert.mutate({
              scheme, member_state_of_identification: msi,
              oss_registration_number: number, effective_date: effective, is_active: true,
            })} disabled={!number || upsert.isPending}>
              Save registration
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active registrations</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Scheme</TableHead><TableHead>MSI</TableHead><TableHead>Number</TableHead><TableHead>Effective</TableHead><TableHead>Status</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.scheme}</TableCell>
                  <TableCell>{r.member_state_of_identification}</TableCell>
                  <TableCell className="font-mono text-xs">{r.oss_registration_number}</TableCell>
                  <TableCell>{r.effective_date}</TableCell>
                  <TableCell>{r.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                </TableRow>
              ))}
              {registrations.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No registrations yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Returns ----------
function ReturnsTab() {
  const { registrations } = useOssRegistrations();
  const { returns, generate, markSubmitted } = useOssReturns();
  const [regId, setRegId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(((Math.floor(new Date().getMonth() / 3) + 1) as 1|2|3|4));
  const [confirm, setConfirm] = useState<Record<string, string>>({});

  const reg = registrations.find(r => r.id === regId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Generate OSS quarterly return</CardTitle>
          <CardDescription>Builds a draft XML packet for the selected period and registration.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Registration</Label>
            <Select value={regId} onValueChange={setRegId}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {registrations.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.scheme} · {r.member_state_of_identification} · {r.oss_registration_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Year</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <Label>Quarter</Label>
            <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v) as 1|2|3|4)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[1,2,3,4].map(q => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4">
            <Button disabled={!reg || generate.isPending} onClick={() => reg && generate.mutate({
              registrationId: reg.id, scheme: reg.scheme as 'union'|'non_union'|'import_ioss',
              memberStateOfIdentification: reg.member_state_of_identification,
              ossRegistrationNumber: reg.oss_registration_number,
              year, quarter,
            })}>
              Generate draft return
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>OSS returns history</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead><TableHead>Scheme</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Total VAT</TableHead><TableHead>Confirmation</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.period_year} Q{r.period_quarter}</TableCell>
                  <TableCell>{r.scheme}</TableCell>
                  <TableCell><Badge variant={r.status === 'submitted' || r.status === 'accepted' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">€{(Number(r.total_vat_cents) / 100).toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.confirmation_number ?? '—'}</TableCell>
                  <TableCell className="space-x-2">
                    {r.xml_payload && (
                      <Button size="sm" variant="outline" onClick={() => downloadXml(`oss_${r.period_year}Q${r.period_quarter}_${r.scheme}.xml`, r.xml_payload!)}>
                        Download XML
                      </Button>
                    )}
                    {r.status === 'generated' && (
                      <span className="inline-flex items-center gap-1">
                        <Input className="h-8 w-32" placeholder="Confirmation #"
                          value={confirm[r.id] ?? ''} onChange={(e) => setConfirm(s => ({ ...s, [r.id]: e.target.value }))} />
                        <Button size="sm" onClick={() => markSubmitted.mutate({ id: r.id, confirmation_number: confirm[r.id] })}>
                          Mark submitted
                        </Button>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {returns.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No returns generated yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function downloadXml(filename: string, xml: string) {
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ---------- VIES & Reverse charge ----------
function ViesTab() {
  const vies = useViesValidate();
  const { entries, log } = useReverseChargeLog();
  const [cc, setCc] = useState('DE');
  const [vn, setVn] = useState('');
  const [last, setLast] = useState<{ isValid: boolean; traderName?: string } | null>(null);
  const [docRef, setDocRef] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(0);
  const [supplyType, setSupplyType] = useState<'services'|'goods'|'triangulation'>('services');
  const [notes, setNotes] = useState('');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>VIES VAT-number validation</CardTitle>
          <CardDescription>Real-time check against the EU VIES service. Results cached for 24 hours.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div><Label>Country</Label><CountrySelect value={cc} onChange={setCc} /></div>
          <div className="md:col-span-2"><Label>VAT number (without country)</Label>
            <Input value={vn} onChange={(e) => setVn(e.target.value)} placeholder="123456789" /></div>
          <Button onClick={async () => {
            const r = await vies.mutateAsync({ countryCode: cc, vatNumber: vn });
            setLast({ isValid: r.isValid, traderName: r.traderName });
          }} disabled={!vn || vies.isPending}>
            {vies.isPending ? 'Checking…' : 'Validate'}
          </Button>
          {last && (
            <div className="md:col-span-4 text-sm">
              {last.isValid
                ? <span className="text-green-600">✓ Valid{last.traderName ? ` — ${last.traderName}` : ''}</span>
                : <span className="text-destructive">✗ Not valid</span>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log a reverse-charge sale</CardTitle>
          <CardDescription>For EC Sales List reporting. Use after confirming the customer's VAT ID via VIES.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div><Label>Document ref</Label><Input value={docRef} onChange={(e) => setDocRef(e.target.value)} /></div>
          <div><Label>Document date</Label><Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} /></div>
          <div><Label>Customer country</Label><CountrySelect value={cc} onChange={setCc} /></div>
          <div><Label>VAT number</Label><Input value={vn} onChange={(e) => setVn(e.target.value)} /></div>
          <div><Label>Supply type</Label>
            <Select value={supplyType} onValueChange={(v) => setSupplyType(v as typeof supplyType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="services">Services</SelectItem>
                <SelectItem value="goods">Goods</SelectItem>
                <SelectItem value="triangulation">Triangulation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Taxable amount (EUR)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} /></div>
          <div className="md:col-span-2"><Label>Notes</Label>
            <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="md:col-span-4">
            <Button disabled={!docRef || !vn || amount <= 0 || log.isPending} onClick={() => log.mutate({
              document_reference: docRef, document_date: docDate,
              customer_country_code: cc, customer_vat_number: vn,
              supply_type: supplyType, taxable_amount: amount, notes,
            })}>Add to reverse-charge log</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Reverse-charge log (recent)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Ref</TableHead><TableHead>Customer</TableHead>
              <TableHead>Supply</TableHead><TableHead className="text-right">Amount</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.document_date}</TableCell>
                  <TableCell>{e.document_reference ?? '—'}</TableCell>
                  <TableCell>{e.customer_country_code} {e.customer_vat_number}</TableCell>
                  <TableCell>{e.supply_type}</TableCell>
                  <TableCell className="text-right">€{(Number(e.taxable_amount_cents) / 100).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No entries yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- Rates ----------
function RatesTab() {
  const { data: rates = [], isLoading } = useEuVatRates();
  return (
    <Card>
      <CardHeader>
        <CardTitle>EU VAT standard rates (current)</CardTitle>
        <CardDescription>Reference data used by the OSS calculator. Updated as member states change rates.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Country</TableHead><TableHead>Code</TableHead>
              <TableHead className="text-right">Standard</TableHead><TableHead>Effective from</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.country_name}</TableCell>
                  <TableCell className="font-mono">{r.country_code}</TableCell>
                  <TableCell className="text-right">{Number(r.standard_rate).toFixed(2)}%</TableCell>
                  <TableCell>{r.effective_from}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
