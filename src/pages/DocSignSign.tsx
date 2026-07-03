import { useEffect, useMemo, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DocumentEditor } from '@/components/docsign/DocumentEditor';
import type { Document, DocumentField, DocumentSigner } from '@/hooks/useDocuments';
import { toast } from 'sonner';

type PortalPayload = {
  document: Document;
  signer: DocumentSigner;
  signers: DocumentSigner[];
  fields: DocumentField[];
};

export default function DocSignSign() {
  const location = useLocation();
  const signerId = useMemo(() => new URLSearchParams(location.search).get('sign') || '', [location.search]);

  const [data, setData] = useState<PortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!signerId) return;

      console.log('[DocSignSign] Loading signer portal for signerId:', signerId);
      setLoading(true);
      try {
        const { data: res, error } = await supabase.functions.invoke('docsign-signer-portal', {
          body: { action: 'get', signerId },
        });

        if (!mounted) return;

        if (error) {
          console.error('Signer portal load error:', error);
          toast.error('Unable to load signing session');
          setData(null);
        } else {
          setData(res as PortalPayload);
          // Check if already signed
          if ((res as PortalPayload)?.signer?.status === 'signed') {
            setSubmitted(true);
          }
        }
      } catch (err) {
        console.error('Signer portal fetch error:', err);
        if (mounted) toast.error('Unable to load signing session');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [signerId]);

  if (!signerId) {
    return <Navigate to="/landing" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading signing session...</div>
      </div>
    );
  }

  if (!data?.document || !data?.signer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-2">
          <div className="text-lg font-semibold">Signing link is invalid or expired</div>
          <div className="text-sm text-muted-foreground">
            Please request a new signing email from the sender.
          </div>
        </div>
      </div>
    );
  }

  // Show success screen if already submitted
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-3">
          <div className="text-3xl">✅</div>
          <div className="text-lg font-semibold">Signature submitted!</div>
          <div className="text-sm text-muted-foreground">
            Thank you for signing "{data.document.title}". You may close this page.
          </div>
        </div>
      </div>
    );
  }

  // Use resolved signer id from portal payload (supports legacy links where ?sign= may be document id)
  const activeSignerId = data.signer.id || signerId;

  const handleSubmit = async (placedFields: { id: string; value?: string; assignedSignerId?: string; isRequired: boolean }[]) => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const myUpdates = placedFields
        .filter((f) => f.assignedSignerId === activeSignerId)
        .map((f) => ({ id: f.id, filled_value: f.value || null }));

      console.log('[DocSignSign] Submitting', myUpdates.length, 'field updates for signer', activeSignerId);

      const { data: res, error } = await supabase.functions.invoke('docsign-signer-portal', {
        body: { action: 'submit', signerId: activeSignerId, fields: myUpdates },
      });

      if (error) {
        let msg = 'Failed to submit signature';
        try {
          const body = typeof error === 'object' && 'context' in error ? await (error as any).context.json() : null;
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        console.error('Signer portal submit error:', error);
        toast.error(msg);
        return;
      }

      if (res?.success) {
        toast.success('Thanks — your signature was submitted.');
        setSubmitted(true);
      } else {
        console.error('Unexpected response:', res);
        toast.error('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Unexpected submit error:', err);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // In sign mode, the "Back" button should NOT trigger submission
  const handleBack = () => {
    window.location.href = '/landing';
  };


  return (
    <div className="fixed inset-0 bg-background">
      <DocumentEditor
        documentId={data.document.id}
        documentTitle={data.document.title}
        fileUrl={data.document.file_url}
        mimeType={data.document.mime_type}
        metadata={(data.document.metadata as Record<string, unknown>) || null}
        signers={data.signers}
        fields={data.fields}
        onSaveFields={handleSubmit as never}
        onBack={handleBack}
        mode="sign"
        currentSignerId={activeSignerId}
        currentUserEmail={data.signer.email}
        currentUserName={data.signer.name || data.signer.email.split('@')[0]}
        isSubmitting={submitting}
      />
    </div>
  );
}
