import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CraModule } from '@/components/cra/CraModule';
import { useCraTaxCentre } from '@/hooks/useCraTaxCentre';
import {
  BANK_NAMES,
  PAYEE_EXAMPLES,
  PAYEE_TYPE_LABEL,
  balanceIsStale,
  cancelInstruction,
  createPaymentInstruction,
  informationReturnDueDate,
  noteSeenOnCraAccount,
  payrollDueDate,
  prepareGstFiling,
  prepareInformationReturnBatch,
  recordBankBillPay,
  recordClientBalance,
  recordFunding,
  refreshUnresolved,
  setRacAuthorization,
  type BankName,
  type CraPayeeType,
  type ClientBalance,
  type GstFilingAttempt,
  type PaymentInstruction,
  type ProgramSuffix,
  type RacAuthorization,
  type RemitterType,
  type TaxpayerKind,
} from '@/lib/cra/nonedi/engine';
import { readNonEdiBook, writeNonEdiBook, type NonEdiBook } from '@/lib/cra/nonedi/store';

const PAYEE_TYPES: CraPayeeType[] = ['taxowing', 'instalment', 'payroll', 'gst_hst'];

export default function CraBillPay() {
  const cra = useCraTaxCentre();
  const [book, setBook] = useState<NonEdiBook>({ instructions: [], balances: [], authorizations: [], gstFilings: [] });
  const [payeeType, setPayeeType] = useState<CraPayeeType | ''>('');
  const [bankName, setBankName] = useState<BankName | ''>('');
  const [taxpayerKind, setTaxpayerKind] = useState<TaxpayerKind>('business');
  const [clientId, setClientId] = useState('');
  const [sin, setSin] = useState('');
  const [programAccount, setProgramAccount] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [payeeNameConfirmed, setPayeeNameConfirmed] = useState(false);
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()));
  const [period, setPeriod] = useState('');
  const [amount, setAmount] = useState('');
  const [valueDate, setValueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [safeguardedAccount, setSafeguardedAccount] = useState('');
  const [kycCleared, setKycCleared] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [fundingRef, setFundingRef] = useState('');
  const [bankRef, setBankRef] = useState('');
  const [craNote, setCraNote] = useState('');
  const [balanceProgram, setBalanceProgram] = useState<ProgramSuffix>('RC');
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceAsOf, setBalanceAsOf] = useState('');
  const [authLevel, setAuthLevel] = useState<'1' | '2' | '3'>('1');
  const [authStatus, setAuthStatus] = useState<'pending' | 'active' | 'revoked'>('pending');
  const [remitter, setRemitter] = useState<RemitterType>('regular');
  const [periodEnd, setPeriodEnd] = useState('');
  const [payDate, setPayDate] = useState('');
  const [gstPath, setGstPath] = useState<'rac' | 'netfile' | 'edi'>('rac');
  const [gstPeriod, setGstPeriod] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [t4Type, setT4Type] = useState<'T4' | 'T4A'>('T4');
  const [transmitter, setTransmitter] = useState('');
  const [repId, setRepId] = useState('');
  const [slipClient, setSlipClient] = useState('');
  const [slipAmount, setSlipAmount] = useState('');
  const [slips, setSlips] = useState<{ clientId: string; returnType: 'T4' | 'T4A'; amount: number }[]>([]);

  useEffect(() => {
    if (!cra.orgId) return;
    const loaded = readNonEdiBook(cra.orgId);
    setBook({ ...loaded, instructions: loaded.instructions.map((row) => refreshUnresolved(row)) });
  }, [cra.orgId]);

  const save = (next: NonEdiBook) => {
    setBook(next);
    if (cra.orgId) writeNonEdiBook(cra.orgId, next);
  };

  const duePreview = useMemo(() => {
    if (!periodEnd) return '';
    return payrollDueDate(remitter, periodEnd, payDate || undefined);
  }, [remitter, periodEnd, payDate]);

  const prepare = () => {
    const result = createPaymentInstruction({
      clientId: clientId || cra.orgName,
      taxpayerKind,
      sin,
      programAccount,
      payeeType,
      bankName,
      payeeName,
      payeeNameConfirmed,
      taxYear,
      period,
      amount: Number(amount),
      valueDate,
      dueDate,
      safeguardedAccount,
      kycCleared,
    });
    if (result.ok === false) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setSin('');
    setAccessCode('');
    save({ ...book, instructions: [result.instruction, ...book.instructions] });
    toast.success('Bill-pay instruction saved. No money has moved.');
  };

  const patch = (id: string, next: PaymentInstruction | null) => {
    if (!next) return;
    save({ ...book, instructions: book.instructions.map((row) => (row.id === id ? next : row)) });
  };

  const addBalance = () => {
    const result = recordClientBalance({
      clientId: clientId || cra.orgName,
      program: balanceProgram,
      amount: Number(balanceAmount),
      asOf: balanceAsOf,
    });
    if (result.ok === false) {
      toast.error(result.error);
      return;
    }
    save({ ...book, balances: [result.balance, ...book.balances] });
    toast.success('Balance saved as client-provided. CRA has not verified it.');
  };

  const addAuth = () => {
    const result = setRacAuthorization({
      clientId: clientId || cra.orgName,
      status: authStatus,
      level: Number(authLevel) as 1 | 2 | 3,
      method: 'represent_a_client',
    });
    if (result.ok === false) {
      toast.error(result.error);
      return;
    }
    save({ ...book, authorizations: [result.authorization, ...book.authorizations.filter((row) => row.clientId !== result.authorization.clientId)] });
    toast.success('Represent a Client status saved. This is not a CRA confirmation.');
  };

  const addGst = () => {
    const active = book.authorizations.some((row) => row.clientId === (clientId || cra.orgName) && row.status === 'active');
    const result = prepareGstFiling({
      clientId: clientId || cra.orgName,
      path: gstPath,
      period: gstPeriod,
      authorizationActive: active,
      accessCode,
    });
    setAccessCode('');
    if (result.ok === false) {
      toast.error(result.error);
      if (result.filing) save({ ...book, gstFilings: [result.filing, ...book.gstFilings] });
      return;
    }
    save({ ...book, gstFilings: [result.filing, ...book.gstFilings] });
    toast.success(result.filing.message);
  };

  const downloadT4 = () => {
    const result = prepareInformationReturnBatch({
      returnType: t4Type,
      transmitterNumber: transmitter,
      repId,
      taxYear: Number(taxYear) || new Date().getFullYear(),
      slips,
    });
    if (result.ok === false) {
      toast.error(result.error);
      return;
    }
    const blob = new Blob([result.xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t4Type}-${taxYear}-ift.xml`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`XML prepared for Internet File Transfer. Due ${result.dueDate}. CRA has not accepted it.`);
  };

  return (
    <CraModule
      title="CRA bill pay"
      description="Payments use the firm's corporate bill pay with the client's CRA identifiers. There is no CRA developer API, and this screen does not sign in to Represent a Client."
    >
      <Card>
        <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
          <p>A bill payment is not paid until you record the bank's confirmation. A balance entered here is the client's figure, not a CRA pull. Form AUT-01 is not used. A GST/HST NETFILE access code is checked and then discarded.</p>
          <p>Client funds stay in the RPAA trust account. They are not deposited to the operating account.</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="pay">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="pay">Bill pay</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="auth">Authorization</TabsTrigger>
          <TabsTrigger value="payroll">Payroll due dates</TabsTrigger>
          <TabsTrigger value="gst">GST/HST filing</TabsTrigger>
          <TabsTrigger value="t4">T4 / T4A</TabsTrigger>
        </TabsList>

        <TabsContent value="pay" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Payment instruction</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field label="Client">
                <Input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder={cra.orgName || 'Client name'} />
              </Field>
              <Field label="Taxpayer">
                <Select value={taxpayerKind} onValueChange={(value) => setTaxpayerKind(value as TaxpayerKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {taxpayerKind === 'individual' ? (
                <Field label="SIN">
                  <Input value={sin} onChange={(event) => setSin(event.target.value)} placeholder="9 digits" autoComplete="off" />
                </Field>
              ) : (
                <Field label="Program account">
                  <Input value={programAccount} onChange={(event) => setProgramAccount(event.target.value)} placeholder="123456789RP0001" />
                </Field>
              )}
              <Field label="CRA payee type">
                <Select value={payeeType || undefined} onValueChange={(value) => {
                  const next = value as CraPayeeType;
                  setPayeeType(next);
                  setPayeeName(PAYEE_EXAMPLES[next]);
                  setPayeeNameConfirmed(false);
                }}>
                  <SelectTrigger><SelectValue placeholder="Choose a payee type" /></SelectTrigger>
                  <SelectContent>
                    {PAYEE_TYPES.map((type) => <SelectItem key={type} value={type}>{PAYEE_TYPE_LABEL[type]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Bank">
                <Select value={bankName || undefined} onValueChange={(value) => { setBankName(value as BankName); setPayeeNameConfirmed(false); }}>
                  <SelectTrigger><SelectValue placeholder="Choose the bank" /></SelectTrigger>
                  <SelectContent>
                    {BANK_NAMES.map((bank) => <SelectItem key={bank} value={bank}>{bank}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Payee name on that bank">
                <Input value={payeeName} onChange={(event) => { setPayeeName(event.target.value); setPayeeNameConfirmed(false); }} placeholder="Match the bank's bill-pay list" />
              </Field>
              <Field label="Tax year"><Input value={taxYear} onChange={(event) => setTaxYear(event.target.value)} /></Field>
              <Field label="Period"><Input value={period} onChange={(event) => setPeriod(event.target.value)} placeholder="August 2026" /></Field>
              <Field label="Amount"><Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /></Field>
              <Field label="Value date"><Input type="date" value={valueDate} onChange={(event) => setValueDate(event.target.value)} /></Field>
              <Field label="CRA due date"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
              <Field label="Safeguarded account"><Input value={safeguardedAccount} onChange={(event) => setSafeguardedAccount(event.target.value)} placeholder="RPAA trust account" /></Field>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <Checkbox checked={payeeNameConfirmed} onCheckedChange={(value) => setPayeeNameConfirmed(value === true)} />
                I compared this payee name to the bank's bill-pay list.
              </label>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <Checkbox checked={kycCleared} onCheckedChange={(value) => setKycCleared(value === true)} />
                FINTRAC identity verification is complete for this client.
              </label>
              {errors.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-destructive md:col-span-2">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
              <div className="md:col-span-2">
                <Button onClick={prepare} disabled={!cra.can('prepare_payment')}>Save instruction</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Remittance records</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {book.instructions.length === 0 ? <p className="text-sm text-muted-foreground">No bill-pay instructions yet.</p> : null}
              {book.instructions.map((row) => (
                <InstructionCard
                  key={row.id}
                  row={row}
                  fundingRef={fundingRef}
                  bankRef={bankRef}
                  craNote={craNote}
                  onFundingRef={setFundingRef}
                  onBankRef={setBankRef}
                  onCraNote={setCraNote}
                  onFunding={() => {
                    const result = recordFunding(row, fundingRef);
                    if (result.ok === false) toast.error(result.error);
                    else patch(row.id, result.instruction);
                  }}
                  onBank={() => {
                    const result = recordBankBillPay(row, bankRef);
                    if (result.ok === false) toast.error(result.error);
                    else {
                      patch(row.id, result.instruction);
                      toast.success('Bank confirmation recorded. CRA has not confirmed the payment.');
                    }
                  }}
                  onCra={() => {
                    const result = noteSeenOnCraAccount(row, craNote);
                    if (result.ok === false) toast.error(result.error);
                    else patch(row.id, result.instruction);
                  }}
                  onCancel={() => {
                    const result = cancelInstruction(row);
                    if (result.ok === false) toast.error(result.error);
                    else patch(row.id, result.instruction);
                  }}
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances">
          <Card>
            <CardHeader><CardTitle>Client-provided balances</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Enter the figure from the client's notice or CRA account. There is no public balance API, and this amount is not verified by CRA.</p>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Program">
                  <Select value={balanceProgram} onValueChange={(value) => setBalanceProgram(value as ProgramSuffix)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RC">RC corporate tax</SelectItem>
                      <SelectItem value="RP">RP payroll</SelectItem>
                      <SelectItem value="RT">RT GST/HST</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Amount"><Input value={balanceAmount} onChange={(event) => setBalanceAmount(event.target.value)} /></Field>
                <Field label="As of"><Input type="date" value={balanceAsOf} onChange={(event) => setBalanceAsOf(event.target.value)} /></Field>
              </div>
              <Button onClick={addBalance}>Save balance</Button>
              <BalanceList rows={book.balances} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth">
          <Card>
            <CardHeader><CardTitle>Represent a Client</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">The client authorizes the firm in My Account or My Business Account. Level 1 can view balances. This record does not open the CRA portal and is not confirmed by a CRA service.</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Status">
                  <Select value={authStatus} onValueChange={(value) => setAuthStatus(value as 'pending' | 'active' | 'revoked')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="revoked">Revoked</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Level">
                  <Select value={authLevel} onValueChange={(value) => setAuthLevel(value as '1' | '2' | '3')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Level 1 — view</SelectItem>
                      <SelectItem value="2">Level 2</SelectItem>
                      <SelectItem value="3">Level 3 — business delegate</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Button onClick={addAuth} disabled={!cra.can('manage_authorization')}>Save authorization status</Button>
              <AuthList rows={book.authorizations} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card>
            <CardHeader><CardTitle>Source-deduction due date</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">The remittance is still a bill payment to the RP account. There is no payroll EDI program. Threshold 2 is three business days after the pay date.</p>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Remitter">
                  <Select value={remitter} onValueChange={(value) => setRemitter(value as RemitterType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular — 15th of the next month</SelectItem>
                      <SelectItem value="quarterly">Quarterly — 15th after quarter end</SelectItem>
                      <SelectItem value="threshold_1">Threshold 1 — 25th / 10th</SelectItem>
                      <SelectItem value="threshold_2">Threshold 2 — 3 business days</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Period end"><Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></Field>
                <Field label="Pay date"><Input type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} /></Field>
              </div>
              {duePreview ? <p className="text-sm">CRA due date: <span className="font-medium">{duePreview}</span>. Use that date on the bill-pay instruction and schedule at least three business days earlier.</p> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gst">
          <Card>
            <CardHeader><CardTitle>GST/HST filing path</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Path">
                  <Select value={gstPath} onValueChange={(value) => setGstPath(value as 'rac' | 'netfile' | 'edi')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rac">Represent a Client — File a return</SelectItem>
                      <SelectItem value="netfile">NETFILE — owner access code</SelectItem>
                      <SelectItem value="edi">EDI — not approved</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Reporting period"><Input value={gstPeriod} onChange={(event) => setGstPeriod(event.target.value)} placeholder="2026-Q2" /></Field>
              </div>
              {gstPath === 'netfile' ? (
                <Field label="4-digit access code">
                  <Input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} maxLength={4} autoComplete="off" />
                </Field>
              ) : null}
              <p className="text-sm text-muted-foreground">Represent a Client does not show the access code. The owner provides it, and it is not saved. EDI stays blocked until CRA approves the provider. The return is not filed by saving this form.</p>
              <Button onClick={addGst}>Prepare filing note</Button>
              <GstList rows={book.gstFilings} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="t4">
          <Card>
            <CardHeader><CardTitle>T4 / T4A Internet File Transfer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">One file contains one return type. The T619 uses the firm's transmitter account and representative ID. The employer remains responsible. Due {informationReturnDueDate(Number(taxYear) || new Date().getFullYear())}. CRA has not accepted the file.</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Return type">
                  <Select value={t4Type} onValueChange={(value) => setT4Type(value as 'T4' | 'T4A')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="T4">T4</SelectItem>
                      <SelectItem value="T4A">T4A</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Firm transmitter account"><Input value={transmitter} onChange={(event) => setTransmitter(event.target.value)} placeholder="123456789RZ0001" /></Field>
                <Field label="Firm representative ID"><Input value={repId} onChange={(event) => setRepId(event.target.value)} /></Field>
                <Field label="Slip client"><Input value={slipClient} onChange={(event) => setSlipClient(event.target.value)} /></Field>
                <Field label="Slip amount"><Input value={slipAmount} onChange={(event) => setSlipAmount(event.target.value)} /></Field>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  if (!slipClient || !(Number(slipAmount) > 0)) return;
                  setSlips([...slips, { clientId: slipClient, returnType: t4Type, amount: Number(slipAmount) }]);
                  setSlipClient('');
                  setSlipAmount('');
                }}>Add slip</Button>
                <Button onClick={downloadT4} disabled={!slips.length}>Download XML</Button>
              </div>
              <ul className="text-sm">{slips.map((slip, index) => <li key={`${slip.clientId}-${index}`}>{slip.returnType} · {slip.clientId} · {slip.amount.toFixed(2)}</li>)}</ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </CraModule>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1 text-sm"><Label>{label}</Label>{children}</label>;
}

function InstructionCard({
  row, fundingRef, bankRef, craNote, onFundingRef, onBankRef, onCraNote, onFunding, onBank, onCra, onCancel,
}: {
  row: PaymentInstruction;
  fundingRef: string;
  bankRef: string;
  craNote: string;
  onFundingRef: (value: string) => void;
  onBankRef: (value: string) => void;
  onCraNote: (value: string) => void;
  onFunding: () => void;
  onBank: () => void;
  onCra: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{row.clientId}</span>
        <Badge variant="outline">{row.status.replace(/_/g, ' ')}</Badge>
        <span>{PAYEE_TYPE_LABEL[row.payeeType]} · {row.bankName}</span>
      </div>
      <p className="text-muted-foreground">{row.payeeName} · {row.programAccount || row.sinMasked} · ${row.amount.toFixed(2)} · value {row.valueDate} · due {row.dueDate}</p>
      <p className="text-muted-foreground">Held in {row.safeguardedAccount}. Keep until {row.retainUntil.slice(0, 10)}.</p>
      {row.status === 'draft' ? (
        <div className="flex flex-wrap gap-2">
          <Input value={fundingRef} onChange={(event) => onFundingRef(event.target.value)} placeholder="Safeguarded deposit reference" className="max-w-xs" />
          <Button size="sm" variant="outline" onClick={onFunding}>Record funding</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      ) : null}
      {row.status === 'funding_received' ? (
        <div className="flex flex-wrap gap-2">
          <Input value={bankRef} onChange={(event) => onBankRef(event.target.value)} placeholder="Bank confirmation" className="max-w-xs" />
          <Button size="sm" onClick={onBank}>Record bank confirmation</Button>
        </div>
      ) : null}
      {row.status === 'submitted_to_bank' || row.status === 'unresolved' ? (
        <div className="flex flex-wrap gap-2">
          <Input value={craNote} onChange={(event) => onCraNote(event.target.value)} placeholder="What was seen on the CRA account" className="max-w-sm" />
          <Button size="sm" variant="outline" onClick={onCra}>Note CRA account</Button>
        </div>
      ) : null}
      {row.bankConfirmation ? <p>Bank reference {row.bankConfirmation}. CRA has not confirmed this payment.</p> : null}
    </div>
  );
}

function BalanceList({ rows }: { rows: ClientBalance[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No client balances yet.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap gap-2">
          <span>{row.program} ${row.amount.toFixed(2)} as of {row.asOf}</span>
          <Badge variant="outline">Not verified by CRA</Badge>
          {balanceIsStale(row) ? <Badge variant="secondary">Ask the client for a current figure</Badge> : null}
        </li>
      ))}
    </ul>
  );
}

function AuthList({ rows }: { rows: RacAuthorization[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No Represent a Client status recorded.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((row) => (
        <li key={row.id}>{row.clientId} · {row.status} · level {row.level} · not confirmed by CRA</li>
      ))}
    </ul>
  );
}

function GstList({ rows }: { rows: GstFilingAttempt[] }) {
  if (!rows.length) return null;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((row) => <li key={row.id}>{row.path} · {row.period} · {row.status} · {row.message}</li>)}
    </ul>
  );
}
