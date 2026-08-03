import { useState, useEffect, useMemo } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SignaturePad } from '@/components/docsign/SignaturePad';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Loader2, CheckCircle2, PenLine, Calendar, Type,
  AlignLeft, SquareCheck, ShieldCheck, FileText, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SignerRow {
  id: string;
  document_id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  signing_token: string;
  signer_expires_at: string | null;
  consent_given: boolean;
}

interface DocumentRow {
  id: string;
  title: string;
  status: string;
  file_url: string | null;
}

interface FieldRow {
  id: string;
  document_id: string;
  field_type: 'signature' | 'initial' | 'full_name' | 'date' | 'checkbox' | 'text' | 'stamp' | 'seal';
  label: string | null;
  page_number: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  is_required: boolean;
  assigned_signer_id: string | null;
  filled_value: string | null;
  filled_at: string | null;
}

type Phase = 'loading' | 'already_signed' | 'expired' | 'review' | 'signing' | 'submitting' | 'submitted' | 'error';

// ─── Signer-scoped Supabase client ───────────────────────────────────────────
// Uses anon key + x-signer-token header so RLS signer policies apply.

function makeSignerClient(token: string) {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    { global: { headers: { 'x-signer-token': token } } },
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fieldDisplayLabel(type: FieldRow['field_type'], label: string | null) {
  if (label) return label;
  const map: Record<FieldRow['field_type'], string> = {
    signature: 'Signature', initial: 'Initials', date: 'Date',
    full_name: 'Full Name', text: 'Text', checkbox: 'Checkbox',
    stamp: 'Stamp', seal: 'Seal',
  };
  return map[type] ?? 'Field';
}

function fieldIcon(type: FieldRow['field_type']) {
  switch (type) {
    case 'signature': case 'initial': return PenLine;
    case 'date': return Calendar;
    case 'text': case 'full_name': return Type;
    case 'checkbox': return SquareCheck;
    default: return AlignLeft;
  }
}

// ─── Root: dispatch between legacy eFinSign and first-party flow ─────────────

export default function DocSignSign() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const signerId = params.get('sign'); // legacy eFinSign link

  if (!token && signerId) return <LegacyEfinSignRedirect signerId={signerId} />;
  if (!token) return <Navigate to="/landing" replace />;
  return <FirstPartySigningPage token={token} />;
}

// ─── Legacy: redirect to eFinSign (keeps old ?sign= links working) ────────────

function LegacyEfinSignRedirect({ signerId }: { signerId: string }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('efinsign-proxy', {
          body: { action: 'get_signing_url', payload: { signer_id: signerId } },
        });
        if (cancelled) return;
        if (error) throw new Error(error.message || 'Unable to resolve signing URL');
        const url = (data as { data?: { signing_url?: string; url?: string } })?.data;
        const target = url?.signing_url || url?.url;
        if (!target) throw new Error('eFinSign did not return a signing URL');
        window.location.replace(target);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : 'Unable to open signing page';
          setError(msg);
          toast.error(msg);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [signerId]);

  return (
    <TerminalScreen
      icon={error
        ? <X className="w-12 h-12 text-destructive" />
        : <Loader2 className="w-12 h-12 animate-spin text-accent" />}
      title={error ? 'Unable to open signing page' : 'Opening secure signing page…'}
      message={error ?? 'Redirecting you to eFinSign.'}
    />
  );
}

// ─── First-party signing page ─────────────────────────────────────────────────

function FirstPartySigningPage({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [signer, setSigner] = useState<SignerRow | null>(null);
  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Signing state
  const [consented, setConsented] = useState(false);
  const [fieldIndex, setFieldIndex] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signatureImages, setSignatureImages] = useState<Record<string, string>>({});
  const [sigPadOpen, setSigPadOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  // Free signature — used when no fields were pre-assigned to this signer
  const [freeSignature, setFreeSignature] = useState<string | null>(null);
  const [freeSigPadOpen, setFreeSigPadOpen] = useState(false);

  const signerClient = useMemo(() => makeSignerClient(token), [token]);

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: signerRow, error: sErr } = await signerClient
          .from('document_signers')
          .select('id,document_id,email,name,role,status,signing_token,signer_expires_at,consent_given')
          .eq('signing_token', token)
          .maybeSingle();

        if (cancelled) return;
        if (sErr) throw new Error(`Could not load signer: ${sErr.message}`);
        if (!signerRow) {
          setErrorMsg('This signing link is invalid or has expired.');
          setPhase('error');
          return;
        }

        const s = signerRow as unknown as SignerRow;

        if (s.status === 'signed') { setSigner(s); setPhase('already_signed'); return; }
        if (s.status === 'declined') { setErrorMsg('This signing request has been declined.'); setPhase('error'); return; }
        if (s.signer_expires_at && new Date(s.signer_expires_at) < new Date()) { setSigner(s); setPhase('expired'); return; }

        setSigner(s);

        const [docResult, fieldResult, pdfResult] = await Promise.all([
          signerClient.from('documents').select('id,title,status,file_url').eq('id', s.document_id).single(),
          signerClient.from('document_fields').select('*').eq('document_id', s.document_id).order('page_number'),
          signerClient.functions.invoke('get-signing-pdf', { body: { document_id: s.document_id } }),
        ]);

        if (cancelled) return;

        if (docResult.error || !docResult.data) throw new Error('Could not load the document.');
        setDoc(docResult.data as unknown as DocumentRow);

        if (fieldResult.error) throw new Error('Could not load document fields.');
        setFields((fieldResult.data ?? []) as unknown as FieldRow[]);

        if (pdfResult.error || !pdfResult.data?.url) throw new Error('Could not load the document PDF.');
        setPdfUrl(pdfResult.data.url as string);

        setPhase('review');
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : 'Failed to load signing page');
          setPhase('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [token, signerClient]);

  // ── My fields: signed-to-me OR unassigned, sorted page→y→x ─────────────
  const myFields = useMemo(() => {
    if (!signer) return [];
    return (fields as FieldRow[])
      .filter(f => f.assigned_signer_id === signer.id || f.assigned_signer_id === null)
      .sort((a, b) =>
        a.page_number - b.page_number ||
        a.position_y - b.position_y ||
        a.position_x - b.position_x
      );
  }, [fields, signer]);

  const currentField = myFields[fieldIndex];
  const allDone = fieldIndex >= myFields.length;

  // ── Auto-advance through date/full_name fields ───────────────────────────
  // Builds up `values` accumulator through recursive calls so final
  // setFieldValues has the full set regardless of React batching.
  function advanceToField(index: number, values: Record<string, string>) {
    if (index >= myFields.length) {
      setFieldValues(values);
      setFieldIndex(index);
      return;
    }
    const f = myFields[index];
    if (f.field_type === 'date') {
      const v = { ...values, [f.id]: new Date().toLocaleDateString('en-CA') };
      advanceToField(index + 1, v);
    } else if (f.field_type === 'full_name' && signer?.name) {
      const v = { ...values, [f.id]: signer.name };
      advanceToField(index + 1, v);
    } else {
      setFieldValues(values);
      setFieldIndex(index);
      if (f.field_type === 'text') setTextInput(f.filled_value || '');
    }
  }

  function handleStartSigning() {
    if (!consented) return;
    setPhase('signing');
    advanceToField(0, {});
  }

  function handleSignatureSave(dataUrl: string) {
    if (!currentField) return;
    const newValues = { ...fieldValues, [currentField.id]: dataUrl };
    const newImages = { ...signatureImages, [currentField.id]: dataUrl };
    setSignatureImages(newImages);
    advanceToField(fieldIndex + 1, newValues);
  }

  function handleTextSave() {
    if (!currentField) return;
    advanceToField(fieldIndex + 1, { ...fieldValues, [currentField.id]: textInput });
  }

  function handleCheckboxSet(fieldId: string, value: string) {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  }

  function handleCheckboxNext() {
    if (!currentField) return;
    advanceToField(fieldIndex + 1, fieldValues);
  }

  function handleSkip() {
    if (!currentField) return;
    advanceToField(fieldIndex + 1, fieldValues);
  }

  // ── Final submit ─────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!signer || !doc) return;
    setPhase('submitting');
    try {
      const now = new Date().toISOString();

      await Promise.all([
        // Update filled fields
        ...Object.entries(fieldValues).map(([id, value]) =>
          signerClient.from('document_fields')
            .update({ filled_value: value, filled_at: now })
            .eq('id', id)
        ),
        // Insert signature audit rows (strip data-URL prefix for storage)
        ...Object.entries(signatureImages).map(([id, dataUrl]) =>
          signerClient.from('document_signatures').insert({
            document_id: doc.id,
            signer_id: signer.id,
            field_id: id,
            image_base64: dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl,
          })
        ),
        // Free signature (no pre-assigned fields) — stored with field_id null
        ...(freeSignature ? [
          signerClient.from('document_signatures').insert({
            document_id: doc.id,
            signer_id: signer.id,
            field_id: null,
            image_base64: freeSignature.includes(',') ? freeSignature.split(',')[1] : freeSignature,
          })
        ] : []),
      ]);

      const { error } = await signerClient.from('document_signers').update({
        status: 'signed',
        signed_at: now,
        consent_given: true,
        consent_timestamp: now,
      }).eq('id', signer.id);

      if (error) throw new Error(`Could not submit: ${error.message}`);

      // Fire-and-forget: notify owner + check completion.
      // The signer sees "submitted" regardless of email delivery outcome.
      signerClient.functions.invoke('on-sign-complete', {
        body: { document_id: doc.id },
      }).catch(e => console.warn('on-sign-complete:', e));

      setPhase('submitted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submission failed');
      setPhase('signing');
    }
  }

  const requiredUnfilled = myFields.filter(f => f.is_required && !fieldValues[f.id]).length;

  // ── Render ───────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <TerminalScreen
        icon={<Loader2 className="w-12 h-12 animate-spin text-accent" />}
        title="Loading signing page…"
        message="Please wait while we prepare your document."
      />
    );
  }

  if (phase === 'already_signed') {
    return (
      <TerminalScreen
        icon={<CheckCircle2 className="w-12 h-12 text-green-500" />}
        title="Already signed"
        message="You have already signed this document. Thank you!"
      />
    );
  }

  if (phase === 'expired') {
    return (
      <TerminalScreen
        icon={<X className="w-12 h-12 text-destructive" />}
        title="Link expired"
        message="This signing link has expired. Please contact the sender for a new one."
      />
    );
  }

  if (phase === 'error') {
    return (
      <TerminalScreen
        icon={<X className="w-12 h-12 text-destructive" />}
        title="Unable to open signing page"
        message={errorMsg}
      />
    );
  }

  if (phase === 'submitted') {
    return (
      <TerminalScreen
        icon={<CheckCircle2 className="w-12 h-12 text-green-500" />}
        title="Signature submitted"
        message={`Thank you, ${signer?.name || signer?.email}! Your signature has been recorded. You'll receive a copy once all parties have signed.`}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-5 h-5 text-accent shrink-0" />
          <span className="font-semibold text-sm truncate">{doc?.title ?? 'Document'}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {phase === 'signing' && myFields.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {Object.keys(fieldValues).length} / {myFields.length}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-green-500" />
            <span className="hidden sm:inline">Secure signing</span>
          </div>
        </div>
      </header>

      {/* Body: PDF + panel */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* PDF */}
        <div className="flex-1 bg-muted/20 flex items-stretch min-h-[50vh] lg:min-h-0">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title="Document to sign"
              style={{ border: 'none', minHeight: '50vh' }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Signing panel */}
        <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l flex flex-col bg-background overflow-y-auto">
          {phase === 'review' && (
            <ReviewPanel
              signer={signer}
              doc={doc}
              fieldCount={myFields.length}
              consented={consented}
              onConsentChange={setConsented}
              onStart={handleStartSigning}
            />
          )}
          {(phase === 'signing' || phase === 'submitting') && (
            <SigningPanel
              fields={myFields}
              fieldIndex={fieldIndex}
              fieldValues={fieldValues}
              currentField={currentField ?? null}
              allDone={allDone}
              requiredUnfilled={requiredUnfilled}
              isSubmitting={phase === 'submitting'}
              textInput={textInput}
              onTextInputChange={setTextInput}
              onOpenSigPad={() => setSigPadOpen(true)}
              onTextSave={handleTextSave}
              onCheckboxSet={handleCheckboxSet}
              onCheckboxNext={handleCheckboxNext}
              onSkip={handleSkip}
              onSubmit={handleSubmit}
              freeSignature={freeSignature}
              onOpenFreeSigPad={() => setFreeSigPadOpen(true)}
            />
          )}
        </div>
      </div>

      {phase === 'signing' && (
        <SignaturePad
          open={sigPadOpen}
          onOpenChange={setSigPadOpen}
          onSave={handleSignatureSave}
          signerName={signer?.name ?? ''}
          fieldType={currentField?.field_type === 'initial' ? 'initial' : 'signature'}
        />
      )}
      {phase === 'signing' && (
        <SignaturePad
          open={freeSigPadOpen}
          onOpenChange={setFreeSigPadOpen}
          onSave={(dataUrl) => setFreeSignature(dataUrl)}
          signerName={signer?.name ?? ''}
          fieldType="signature"
        />
      )}
    </div>
  );
}

// ─── Terminal screen (loading / signed / error / expired) ────────────────────

function TerminalScreen({
  icon, title, message,
}: {
  icon: React.ReactNode; title: string; message: string;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
        {icon}
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
        <p className="text-xs text-muted-foreground mt-2">Powered by eFinsuite DocSign</p>
      </div>
    </div>
  );
}

// ─── Review panel ─────────────────────────────────────────────────────────────

function ReviewPanel({
  signer, doc, fieldCount, consented, onConsentChange, onStart,
}: {
  signer: SignerRow | null;
  doc: DocumentRow | null;
  fieldCount: number;
  consented: boolean;
  onConsentChange: (v: boolean) => void;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div>
        <h2 className="font-semibold">Review &amp; Sign</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {signer?.name || signer?.email} · {doc?.title}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Please read the document on the left before signing.
        {fieldCount > 0 && (
          <> You have <strong>{fieldCount}</strong> field{fieldCount !== 1 ? 's' : ''} to complete.</>
        )}
      </p>
      <div className="mt-auto space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
          <Checkbox
            id="consent"
            checked={consented}
            onCheckedChange={v => onConsentChange(!!v)}
          />
          <Label htmlFor="consent" className="text-xs leading-relaxed cursor-pointer">
            I have read this document and agree to sign it electronically. I understand my electronic signature is legally binding.
          </Label>
        </div>
        <Button
          className="w-full bg-accent hover:bg-accent/90"
          disabled={!consented}
          onClick={onStart}
        >
          <PenLine className="w-4 h-4 mr-2" />
          {fieldCount > 0 ? 'Start Signing' : 'Confirm & Sign'}
        </Button>
      </div>
    </div>
  );
}

// ─── Signing panel ────────────────────────────────────────────────────────────

function SigningPanel({
  fields, fieldIndex, fieldValues, currentField, allDone, requiredUnfilled,
  isSubmitting, textInput, onTextInputChange, onOpenSigPad, onTextSave,
  onCheckboxSet, onCheckboxNext, onSkip, onSubmit,
  freeSignature, onOpenFreeSigPad,
}: {
  fields: FieldRow[];
  fieldIndex: number;
  fieldValues: Record<string, string>;
  currentField: FieldRow | null;
  allDone: boolean;
  requiredUnfilled: number;
  isSubmitting: boolean;
  textInput: string;
  onTextInputChange: (v: string) => void;
  onOpenSigPad: () => void;
  onTextSave: () => void;
  onCheckboxSet: (id: string, v: string) => void;
  onCheckboxNext: () => void;
  onSkip: () => void;
  onSubmit: () => void;
  freeSignature: string | null;
  onOpenFreeSigPad: () => void;
}) {
  // No pre-placed fields — require a free signature before submitting
  if (fields.length === 0) {
    return (
      <div className="flex flex-col p-4 gap-4 h-full">
        <div>
          <p className="font-semibold text-sm">Your signature is required</p>
          <p className="text-xs text-muted-foreground mt-1">
            Draw your signature below to confirm your intent to sign this document.
          </p>
        </div>
        {freeSignature ? (
          <div className="space-y-2">
            <div className="border rounded-lg p-3 bg-muted/30 flex items-center justify-center">
              <img src={freeSignature} alt="Your signature" className="max-h-16 max-w-full" />
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={onOpenFreeSigPad}>
              Redo Signature
            </Button>
          </div>
        ) : (
          <div
            className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-3 text-muted-foreground cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors"
            onClick={onOpenFreeSigPad}
          >
            <PenLine className="w-8 h-8" />
            <p className="text-sm font-medium">Tap to sign</p>
          </div>
        )}
        <Button
          className="w-full bg-accent hover:bg-accent/90 mt-auto"
          onClick={!freeSignature ? onOpenFreeSigPad : onSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
            : !freeSignature
              ? <><PenLine className="w-4 h-4 mr-2" />Sign Here</>
              : <><CheckCircle2 className="w-4 h-4 mr-2" />Submit Signature</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 gap-4 h-full">
      {/* Progress bar */}
      {fields.length > 0 && (
        <div className="flex gap-1">
          {fields.map((f, i) => (
            <div
              key={f.id}
              className={cn(
                'h-1.5 rounded-full flex-1 transition-colors',
                fieldValues[f.id] ? 'bg-green-500' : i === fieldIndex ? 'bg-accent' : 'bg-muted',
              )}
            />
          ))}
        </div>
      )}

      {allDone ? (
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium text-sm">All fields complete</span>
          </div>
          {requiredUnfilled > 0 && (
            <p className="text-xs text-destructive">
              {requiredUnfilled} required field{requiredUnfilled !== 1 ? 's' : ''} still need attention.
            </p>
          )}
          <div className="mt-auto">
            <Button
              className="w-full bg-accent hover:bg-accent/90"
              onClick={onSubmit}
              disabled={isSubmitting || requiredUnfilled > 0}
            >
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
                : <><CheckCircle2 className="w-4 h-4 mr-2" />Submit Signature</>}
            </Button>
          </div>
        </div>
      ) : currentField ? (
        <div className="flex flex-col gap-3 flex-1">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Field {fieldIndex + 1} of {fields.length}
            </p>
            <p className="font-semibold text-sm mt-0.5">
              {fieldDisplayLabel(currentField.field_type, currentField.label)}
              {currentField.is_required && <span className="text-destructive ml-1">*</span>}
            </p>
            <p className="text-xs text-muted-foreground">Page {currentField.page_number}</p>
          </div>

          <FieldWidget
            field={currentField}
            fieldValues={fieldValues}
            textInput={textInput}
            onTextInputChange={onTextInputChange}
            onOpenSigPad={onOpenSigPad}
            onTextSave={onTextSave}
            onCheckboxSet={onCheckboxSet}
            onCheckboxNext={onCheckboxNext}
          />

          {!currentField.is_required && (
            <Button variant="ghost" size="sm" onClick={onSkip} className="text-xs text-muted-foreground mt-auto">
              Skip (optional)
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
          No fields to complete.
        </div>
      )}
    </div>
  );
}

// ─── Per-field widget ─────────────────────────────────────────────────────────

function FieldWidget({
  field, fieldValues, textInput, onTextInputChange,
  onOpenSigPad, onTextSave, onCheckboxSet, onCheckboxNext,
}: {
  field: FieldRow;
  fieldValues: Record<string, string>;
  textInput: string;
  onTextInputChange: (v: string) => void;
  onOpenSigPad: () => void;
  onTextSave: () => void;
  onCheckboxSet: (id: string, v: string) => void;
  onCheckboxNext: () => void;
}) {
  const Icon = fieldIcon(field.field_type);
  const savedDataUrl = fieldValues[field.id];

  switch (field.field_type) {
    case 'signature':
    case 'initial':
      return (
        <div className="space-y-2">
          {savedDataUrl ? (
            <div className="border rounded-lg p-2 bg-muted/30">
              <img src={savedDataUrl} alt="signature" className="max-h-16 mx-auto" />
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 text-muted-foreground">
              <Icon className="w-6 h-6" />
              <p className="text-xs">
                {field.field_type === 'initial' ? 'Initials required' : 'Signature required'}
              </p>
            </div>
          )}
          <Button onClick={onOpenSigPad} className="w-full bg-accent hover:bg-accent/90" size="sm">
            <PenLine className="w-4 h-4 mr-2" />
            {savedDataUrl
              ? (field.field_type === 'initial' ? 'Redo Initials' : 'Redo Signature')
              : (field.field_type === 'initial' ? 'Add Initials' : 'Sign Here')}
          </Button>
        </div>
      );

    case 'text':
    case 'full_name':
      return (
        <div className="space-y-2">
          <Input
            value={textInput}
            onChange={e => onTextInputChange(e.target.value)}
            placeholder={field.label || (field.field_type === 'full_name' ? 'Your full name' : 'Enter text…')}
            onKeyDown={e => { if (e.key === 'Enter') onTextSave(); }}
          />
          <Button
            onClick={onTextSave}
            className="w-full bg-accent hover:bg-accent/90"
            size="sm"
            disabled={field.is_required && !textInput.trim()}
          >
            Next
          </Button>
        </div>
      );

    case 'checkbox': {
      const checked = fieldValues[field.id] === 'checked';
      return (
        <div className="space-y-3">
          <div
            className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => onCheckboxSet(field.id, checked ? '' : 'checked')}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={v => onCheckboxSet(field.id, v ? 'checked' : '')}
            />
            <span className="text-sm select-none">{field.label || 'I agree'}</span>
          </div>
          <Button
            onClick={onCheckboxNext}
            className="w-full bg-accent hover:bg-accent/90"
            size="sm"
            disabled={field.is_required && !checked}
          >
            Next
          </Button>
        </div>
      );
    }

    default:
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm p-3 border rounded-lg">
          <Icon className="w-4 h-4" />
          <span>Auto-filling…</span>
        </div>
      );
  }
}
