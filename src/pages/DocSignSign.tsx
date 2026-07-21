import { useEffect, useMemo, useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function DocSignSign() {
  const location = useLocation();
  const signerId = useMemo(() => new URLSearchParams(location.search).get('sign') || '', [location.search]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signerId) return;
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
        const msg = e instanceof Error ? e.message : 'Unable to open signing page';
        console.error('Signing redirect failed:', e);
        setError(msg);
        toast.error(msg);
      }
    })();
    return () => { cancelled = true; };
  }, [signerId]);

  if (!signerId) return <Navigate to="/landing" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md text-center space-y-3 px-6">
        {error ? (
          <>
            <div className="text-lg font-semibold">Unable to open signing page</div>
            <div className="text-sm text-muted-foreground">{error}</div>
            <div className="text-xs text-muted-foreground">Please contact the sender for a new link.</div>
          </>
        ) : (
          <>
            <div className="text-lg font-semibold">Opening secure signing page…</div>
            <div className="text-sm text-muted-foreground">Redirecting you to eFinSign.</div>
          </>
        )}
      </div>
    </div>
  );
}
