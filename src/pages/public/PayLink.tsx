import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2, XCircle, ShieldCheck, PartyPopper, Calendar, Banknote, Receipt, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import PaymentStatus from '@/pages/PaymentStatus';

interface PublicLink {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  description: string | null;
  status: string;
  payment_method: string;
  hosted_url: string | null;
  instant_payment?: boolean;
  instant_method?: 'interac_etransfer' | 'card_instant_funding' | null;
  card_provider?: 'paysafe' | 'square' | null;
  square_checkout_url?: string | null;
}

type PaysafeCheckoutInstance = {
  close: () => void;
  isOpen?: () => boolean;
  showSuccessScreen?: (message?: string) => void;
  showFailureScreen?: (message?: string) => void;
};

type PaysafeCheckoutError = {
  message?: string;
  detailedMessage?: string;
  correlationId?: string;
};

type PaysafeCheckoutResult = {
  paymentHandleToken?: string;
  paymentMethod?: string;
  customerOperation?: string;
  amount?: number;
};

type PaysafeCheckoutSdk = {
  checkout: {
    setup: (
      key: string,
      opts: Record<string, unknown>,
      resultCb: (
        instance: PaysafeCheckoutInstance,
        err: PaysafeCheckoutError | null,
        result: PaysafeCheckoutResult | null,
      ) => void,
      closeCb?: (stage?: string, expired?: boolean) => void,
      riskCb?: (instance: { accept: () => void; decline: (message?: string) => void }, amount: number, paymentMethod: string) => void,
    ) => void;
  };
};

const PAYSAFE_SDK_ID = 'paysafe-checkout-sdk';
const PAYSAFE_SDK_SRC = 'https://hosted.paysafe.com/checkout/v2/paysafe.checkout.min.js';

const getPaysafeSdk = (): PaysafeCheckoutSdk | null => {
  const candidate = (window as unknown as { paysafe?: Partial<PaysafeCheckoutSdk> }).paysafe;
  return typeof candidate?.checkout?.setup === 'function' ? candidate as PaysafeCheckoutSdk : null;
};

const hasPaysafeOverlay = () => Array.from(document.querySelectorAll('iframe, div, section, dialog, [role="dialog"]')).some((el) => {
  if (el.id === PAYSAFE_SDK_ID || el.tagName.toLowerCase() === 'script') return false;
  const htmlEl = el as HTMLElement & { src?: string };
  const marker = `${htmlEl.id || ''} ${htmlEl.className || ''} ${htmlEl.src || ''}`.toLowerCase();
  return marker.includes('paysafe') || marker.includes('hosted.paysafe.com');
});

const safelyCloseCheckout = (instance: PaysafeCheckoutInstance, delayMs = 0) => {
  window.setTimeout(() => {
    try {
      if (!instance.isOpen || instance.isOpen()) instance.close();
    } catch (err) {
      console.warn('[Paysafe Checkout] close failed', err);
    }
  }, delayMs);
};

const safelyShowCheckoutScreen = (
  instance: PaysafeCheckoutInstance,
  type: 'success' | 'failure',
  message: string,
) => {
  try {
    if (type === 'success') instance.showSuccessScreen?.(message);
    else instance.showFailureScreen?.(message);
  } catch (err) {
    console.warn(`[Paysafe Checkout] could not show ${type} screen`, err);
  }
};

const formatPaysafeError = (err: PaysafeCheckoutError) => {
  const base = err.detailedMessage || err.message || 'Payment was not completed.';
  return err.correlationId ? `${base} Reference: ${err.correlationId}` : base;
};

const addBusinessDays = (start: Date, days: number): Date => {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
};

const getFundingEta = (
  method: string,
  instantMethod: string | null,
  instantPayment?: boolean,
): { copy: string; etaDate: Date | null } => {
  const now = new Date();
  if (instantPayment && instantMethod === 'card_instant_funding') {
    return { copy: 'Funds arrive in the recipient\'s bank account within minutes (instant funding enabled).', etaDate: now };
  }
  if (instantPayment && instantMethod === 'interac_etransfer') {
    return { copy: 'Interac e-Transfer typically deposits within 30 minutes, and at most by the next business day.', etaDate: addBusinessDays(now, 1) };
  }
  if (method === 'eft') {
    return { copy: 'EFT settlements typically arrive in the recipient\'s bank account in 3–5 business days.', etaDate: addBusinessDays(now, 5) };
  }
  // card / debit / visa_debit / any_card / all
  return { copy: 'Card payments typically arrive in the recipient\'s bank account in 1–2 business days.', etaDate: addBusinessDays(now, 2) };
};

const Confetti = () => {
  const pieces = Array.from({ length: 40 });
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2.5 + Math.random() * 1.8;
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 6;
        const rotate = Math.random() * 360;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: '-10px',
              left: `${left}%`,
              width: size,
              height: size * 0.4,
              background: color,
              transform: `rotate(${rotate}deg)`,
              animation: `paylink-confetti-fall ${duration}s ${delay}s ease-in forwards`,
              borderRadius: 1,
              opacity: 0.9,
            }}
          />
        );
      })}
      <style>{`
        @keyframes paylink-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

const fetchJsonWithTimeout = async (url: string, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const payload = await response.json().catch(() => null);
    return { response, payload };
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

export default function PayLink() {
  const { linkId } = useParams<{ linkId: string }>();
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status');
  const [link, setLink] = useState<PublicLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEftForm, setShowEftForm] = useState(false);
  const [eft, setEft] = useState({
    holder_name: '',
    institution: '',
    transit: '',
    account_number: '',
    account_type: 'CHECKING' as 'CHECKING' | 'SAVINGS',
    street: '',
    city: '',
    zip: '',
    consent: false,
  });


  const submitEft = async () => {
    if (!linkId) return;
    if (!eft.consent) { toast.error('Please authorize the one-time debit (PAD).'); return; }
    if (!/^\d{3}$/.test(eft.institution)) { toast.error('Institution number must be 3 digits.'); return; }
    if (!/^\d{5}$/.test(eft.transit)) { toast.error('Transit number must be 5 digits.'); return; }
    if (!/^\d{5,17}$/.test(eft.account_number)) { toast.error('Account number must be 5–17 digits.'); return; }
    if (!eft.holder_name.trim()) { toast.error('Account holder name is required.'); return; }
    if (!eft.street.trim() || !eft.city.trim()) { toast.error('Billing street and city are required.'); return; }
    setPaying(true);
    try {
      const { data, error: invErr } = await supabase.functions.invoke('paysafe-eft-debit', {
        body: {
          payment_link_id: linkId,
          account: {
            holder_name: eft.holder_name.trim(),
            institution: eft.institution,
            transit: eft.transit,
            account_number: eft.account_number,
            account_type: eft.account_type,
            street: eft.street.trim(),
            city: eft.city.trim(),
            zip: eft.zip.trim() || undefined,
          },
          consent: true,
        },
      });

      let serverMsg: string | undefined = (data as { error?: string } | null)?.error;
      if (!serverMsg && invErr) {
        const ctx = (invErr as unknown as { context?: Response }).context;
        try { serverMsg = (await ctx?.clone().json())?.error; } catch { /* ignore */ }
      }
      if (serverMsg || invErr) throw new Error(serverMsg || invErr!.message);
      window.location.href = `${window.location.pathname}?status=success&method=eft`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, { duration: 12000 });
      setPaying(false);
    }
  };

  useEffect(() => {
    if (!linkId) return;
    (async () => {
      const { data, error } = await supabase.rpc('get_public_payment_link' as never, { p_id: linkId } as never);
      if (error) {
        setError(error.message);
      } else if (!data || ((data as unknown[]).length === 0)) {
        setError('This payment link is no longer available.');
      } else {
        const arr = data as unknown as PublicLink[];
        const row = Array.isArray(arr) ? arr[0] : (arr as unknown as PublicLink);
        setLink(row);
      }
      setLoading(false);
    })();
  }, [linkId]);

  const loadPaysafeSdk = (timeoutMs = 15000): Promise<PaysafeCheckoutSdk> => new Promise((resolve, reject) => {
    const ready = getPaysafeSdk();
    if (ready) return resolve(ready);

    let script = document.getElementById(PAYSAFE_SDK_ID) as HTMLScriptElement | null;
    if (script?.dataset.failed === 'true' || script?.dataset.loaded === 'true') {
      script.remove();
      script = null;
    }

    let settled = false;
    const finish = (next: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      script?.removeEventListener('load', handleLoad);
      script?.removeEventListener('error', handleError);
      next();
    };
    const handleLoad = () => {
      if (script) script.dataset.loaded = 'true';
      const loaded = getPaysafeSdk();
      finish(() => {
        if (loaded) resolve(loaded);
        else reject(new Error('Paysafe Checkout loaded but did not initialize. Please refresh and try again.'));
      });
    };
    const handleError = () => {
      script?.setAttribute('data-failed', 'true');
      finish(() => reject(new Error('Paysafe Checkout could not load. Please check your connection and try again.')));
    };
    const timeoutId = window.setTimeout(() => {
      script?.setAttribute('data-failed', 'true');
      script?.remove();
      finish(() => reject(new Error('Paysafe Checkout did not respond. Please refresh and try again.')));
    }, timeoutMs);

    let appendScript = false;
    if (!script) {
      console.info('[Paysafe Checkout] loading SDK');
      script = document.createElement('script');
      script.id = PAYSAFE_SDK_ID;
      script.src = PAYSAFE_SDK_SRC;
      script.async = true;
      appendScript = true;
    }
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    if (appendScript) document.body.appendChild(script);
  });

  /** Square hosted checkout: create (or reuse) the payment link and redirect. */
  const startSquarePayment = async () => {
    if (!linkId) return;
    setPaying(true);
    try {
      const { data, error: invErr } = await supabase.functions.invoke('square-create-payment-link', {
        body: {
          payment_link_id: linkId,
          redirect_url: `${window.location.origin}${window.location.pathname}?status=success&method=square`,
        },
      });
      let serverMsg: string | undefined = (data as { error?: string } | null)?.error;
      if (!serverMsg && invErr) {
        const ctx = (invErr as unknown as { context?: Response }).context;
        try { serverMsg = (await ctx?.clone().json())?.error; } catch { /* ignore */ }
      }
      if (serverMsg || invErr) throw new Error(serverMsg || invErr!.message);
      const url = (data as { url?: string } | null)?.url;
      if (!url) throw new Error('Square did not return a checkout URL');
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err), { duration: 12000 });
      setPaying(false);
    }
  };

  const startPayment = async (_cardTypeHint?: 'credit' | 'debit' | 'visa_debit') => {
    if (!linkId) return;
    if (link?.card_provider === 'square') return startSquarePayment();
    setPaying(true);
    let clearCheckoutStartupWatch: (() => void) | undefined;
    try {
      const supabaseUrl = (import.meta as unknown as { env: { VITE_SUPABASE_URL: string } }).env.VITE_SUPABASE_URL;
      console.info('[Paysafe Checkout] loading public config');
      const { response: cfgRes, payload: cfg } = await fetchJsonWithTimeout(
        `${supabaseUrl}/functions/v1/paysafe-public-config?payment_link_id=${encodeURIComponent(linkId)}`,
      );
      if (!cfgRes.ok) throw new Error(cfg?.error || 'Could not load payment config');

      const paysafe = await loadPaysafeSdk();

      const cardAccountId = cfg.accountId ? String(cfg.accountId) : undefined;
      const options: Record<string, unknown> = {
        currency: cfg.link.currency,
        amount: cfg.link.amountMinor,
        environment: cfg.environment,
        merchantRefNum: `${cfg.link.reference}-${Date.now()}`,
        displayPaymentMethods: ['card'],
        canEditAmount: false,
        locale: 'en_US',
        companyName: 'efinsuite',
        ...(cardAccountId ? { paymentMethodDetails: { card: { accountId: cardAccountId } } } : {}),
      };

      let checkoutResponded = false;
      const markCheckoutResponded = (label: string) => {
        if (!checkoutResponded) console.info('[Paysafe Checkout] responded', label);
        checkoutResponded = true;
        clearCheckoutStartupWatch?.();
      };
      clearCheckoutStartupWatch = (() => {
        let done = false;
        const cleanup = () => {
          done = true;
          observer.disconnect();
          window.clearTimeout(timeoutId);
        };
        const handleOverlayOpen = () => {
          if (done) return;
          console.info('[Paysafe Checkout] overlay detected');
          cleanup();
        };
        const observer = new MutationObserver(() => {
          if (hasPaysafeOverlay()) handleOverlayOpen();
        });
        const timeoutId = window.setTimeout(() => {
          if (done || checkoutResponded || hasPaysafeOverlay()) {
            cleanup();
            return;
          }
          cleanup();
          console.warn('[Paysafe Checkout] setup produced no callback or overlay');
          toast.error('Paysafe Checkout did not open. Please refresh and try again.', { duration: 12000 });
          setPaying(false);
        }, 12000);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['id', 'class', 'src'] });
        if (hasPaysafeOverlay()) handleOverlayOpen();
        return cleanup;
      })();

      console.info('[Paysafe Checkout] setup start');
      paysafe.checkout.setup(
        cfg.publicKey,
        options,
        async (instance, err, result) => {
          markCheckoutResponded(err ? 'result:error' : 'result');
          try {
            if (err) {
              const msg = formatPaysafeError(err);
              setPaying(false);
              safelyShowCheckoutScreen(instance, 'failure', msg);
              safelyCloseCheckout(instance, 1500);
              toast.error(msg, { duration: 12000 });
              return;
            }
            if (!result?.paymentHandleToken) {
              console.warn('[Paysafe Checkout] missing payment handle token', result);
              setPaying(false);
              safelyCloseCheckout(instance);
              toast.error('Paysafe did not return a payment token. Please try again.', { duration: 12000 });
              return;
            }
            console.info('[Paysafe Checkout] charging payment handle', { paymentMethod: result.paymentMethod });
            const { data, error: invErr } = await withTimeout(
              supabase.functions.invoke('paysafe-charge-handle', {
                body: { payment_link_id: linkId, payment_handle_token: result.paymentHandleToken },
              }),
              30000,
              'Payment processing timed out. Please try again or contact support.',
            );
            let serverMsg: string | undefined = (data as { error?: string } | null)?.error;
            if (!serverMsg && invErr) {
              const ctx = (invErr as unknown as { context?: Response }).context;
              try { serverMsg = (await ctx?.clone().json())?.error; } catch { /* ignore */ }
            }
            if (serverMsg || invErr) throw new Error(serverMsg || invErr!.message);
            safelyShowCheckoutScreen(instance, 'success', 'Payment received');
            const settledToWise = Boolean((data as { settlement?: { settled?: boolean } } | null)?.settlement?.settled);
            setTimeout(() => {
              safelyCloseCheckout(instance);
              window.location.href = `${window.location.pathname}?status=success&method=card${settledToWise ? '&settlement=wise' : ''}`;
            }, 1200);
          } catch (err2) {
            const msg = err2 instanceof Error ? err2.message : String(err2);
            setPaying(false);
            safelyShowCheckoutScreen(instance, 'failure', msg);
            safelyCloseCheckout(instance, 1500);
            toast.error(msg, { duration: 12000 });
          }
        },
        (stage, expired) => {
          markCheckoutResponded(`close:${stage ?? 'unknown'}`);
          console.info('[Paysafe Checkout] close', { stage, expired });
          if (stage === 'PAYMENT_HANDLE_REDIRECT' && !expired && hasPaysafeOverlay()) return;
          setPaying(false);
        },
        (instance, amount, paymentMethod) => {
          markCheckoutResponded('risk');
          console.info('[Paysafe Checkout] risk accepted', { amount, paymentMethod });
          instance.accept();
        },
      );
    } catch (err) {
      clearCheckoutStartupWatch?.();
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg === 'The user aborted a request.' ? 'Paysafe configuration timed out. Please try again.' : msg, { duration: 12000 });
      setPaying(false);
    }
  };

  const startEtransfer = async () => {
    if (!linkId) return;
    setPaying(true);
    try {
      const { data, error } = await supabase.functions.invoke('paysafe-create-etransfer', {
        body: {
          payment_link_id: linkId,
          return_url: `${window.location.origin}${window.location.pathname}?status=success&method=interac`,
        },
      });
      let serverMsg: string | undefined = (data as { error?: string } | null)?.error;
      if (!serverMsg && error) {
        const ctx = (error as unknown as { context?: Response }).context;
        try { serverMsg = (await ctx?.clone().json())?.error; } catch { /* ignore */ }
      }
      if (data?.url) { window.location.href = data.url; return; }
      if (error || serverMsg) throw new Error(serverMsg || error!.message);
      toast.success('Interac e-Transfer request sent. Please check your email/SMS.');
      setPaying(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, { duration: 12000 });
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'success') {
    const usedMethod = searchParams.get('method'); // 'eft' | 'card' | 'interac' | 'square' | null
    if (usedMethod === 'square') {
      return <PaymentStatus backTo={null} />;
    }
    const linkMethod = link?.payment_method ?? 'any_card';
    // Prefer the actual method the payer used; fall back to the link's configured method.
    // Avoid defaulting an "all" link to card copy when no method param is present.
    const method = usedMethod
      ? (usedMethod === 'interac' ? 'any_card' : usedMethod)
      : (linkMethod === 'all' ? 'eft' : linkMethod);
    const instant = usedMethod === 'interac' ? 'interac_etransfer' : (link?.instant_method ?? null);
    const eta = getFundingEta(method, instant, usedMethod === 'interac' ? true : link?.instant_payment);
    const paidAt = new Date();
    const fmtDate = (d: Date) =>
      d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const fmtDateTime = (d: Date) =>
      d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 relative overflow-hidden">
        <Confetti />
        <Card className="w-full max-w-md relative z-10 shadow-xl border-green-200/50">
          <CardHeader className="text-center pb-2">
            <div className="relative mx-auto mb-3">
              <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl animate-pulse" />
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto relative animate-in zoom-in duration-500" />
            </div>
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              Payment successful
              <PartyPopper className="h-6 w-6 text-amber-500" />
            </CardTitle>
            {link && (
              <p className="text-3xl font-bold mt-3 text-foreground">
                {Number(link.amount).toFixed(2)} {link.currency}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {link && (
              <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono font-medium">{link.reference}</span>
                </div>
                {link.description && (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Receipt className="h-3.5 w-3.5" /> For
                    </span>
                    <span className="font-medium text-right">{link.description}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid on</span>
                  <span className="font-medium">{fmtDateTime(paidAt)}</span>
                </div>
              </div>
            )}

            {searchParams.get('settlement') === 'wise' && (
              <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 border-emerald-200 p-3 text-sm text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                <Landmark className="h-5 w-5 mt-0.5 shrink-0" />
                <span>Funds are being settled to the recipient's Wise account.</span>
              </div>
            )}



            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-3">
              <div className="flex items-start gap-2.5">
                <Banknote className="h-5 w-5 text-green-700 dark:text-green-400 mt-0.5 shrink-0" />
                <div className="text-sm flex-1">
                  <div className="font-semibold text-green-900 dark:text-green-200">
                    Funds availability
                  </div>
                  <p className="text-green-800/90 dark:text-green-200/90 mt-0.5">
                    {eta.copy}
                  </p>
                  {eta.etaDate && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-green-900/80 dark:text-green-200/80">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Estimated arrival by <strong>{fmtDate(eta.etaDate)}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              A confirmation email will be sent shortly.
            </p>
            <p className="text-center text-xs text-muted-foreground">
              <span className="text-amber-600 font-medium">Powered by efinsuite</span>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'failed' || error || !link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-14 w-14 text-destructive mx-auto mb-2" />
            <CardTitle>Payment unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            {error || 'This payment could not be processed.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="text-xs text-muted-foreground font-mono mb-1">{link.reference}</div>
          <CardTitle className="text-2xl">Pay {Number(link.amount).toFixed(2)} {link.currency}</CardTitle>
          {link.description && <p className="text-sm text-muted-foreground mt-2">{link.description}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Secure payment processed by {link.card_provider === 'square' ? 'Square' : 'Paysafe'}</span>
          </div>

          {link.instant_payment && link.instant_method === 'interac_etransfer' && (
            <Button onClick={startEtransfer} disabled={paying} className="w-full" size="lg" variant="default">
              {paying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending request…</> : '⚡ Pay with Interac e-Transfer'}
            </Button>
          )}
          {link.instant_payment && link.instant_method === 'card_instant_funding' && (
            <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2">
              ⚡ Instant settlement enabled — funds reach the merchant the same day.
            </div>
          )}


          {/* Specific card type */}
          {link.payment_method === 'credit_card' && (
            <Button onClick={() => startPayment('credit')} disabled={paying} className="w-full" size="lg">
              {paying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting…</> : 'Pay with Credit Card'}
            </Button>
          )}
          {link.payment_method === 'debit_card' && (
            <Button onClick={() => startPayment('debit')} disabled={paying} className="w-full" size="lg">
              {paying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting…</> : 'Pay with Debit Card'}
            </Button>
          )}
          {link.payment_method === 'visa_debit' && (
            <Button onClick={() => startPayment('visa_debit')} disabled={paying} className="w-full" size="lg">
              {paying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting…</> : 'Pay with Visa Debit'}
            </Button>
          )}

          {/* Any card */}
          {link.payment_method === 'any_card' && (
            <>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">Visa</Badge>
                <Badge variant="outline">Mastercard</Badge>
                <Badge variant="outline">Amex</Badge>
                <Badge variant="outline">Visa Debit</Badge>
              </div>
              <Button onClick={() => startPayment()} disabled={paying} className="w-full" size="lg">
                {paying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting…</> : 'Pay with card'}
              </Button>
            </>
          )}

          {/* EFT only */}
          {link.payment_method === 'eft' && !showEftForm && (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Landmark className="h-3.5 w-3.5" />
                <span>Enter your void-cheque info to pay directly from your bank account</span>
              </div>
              <Button onClick={() => setShowEftForm(true)} disabled={paying} className="w-full" size="lg">
                Pay by EFT (bank)
              </Button>
            </>
          )}

          {/* All methods */}
          {link.payment_method === 'all' && !showEftForm && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">Visa</Badge>
                <Badge variant="outline">Mastercard</Badge>
                <Badge variant="outline">Amex</Badge>
                <Badge variant="outline">Visa Debit</Badge>
                <Badge variant="outline">EFT</Badge>
              </div>
              <Button onClick={() => startPayment()} disabled={paying} className="w-full" size="lg">
                {paying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting…</> : 'Pay with card'}
              </Button>
              <Button onClick={() => setShowEftForm(true)} disabled={paying} variant="outline" className="w-full" size="lg">
                <Landmark className="h-4 w-4 mr-2" /> Pay by EFT (bank)
              </Button>
            </div>
          )}

          {/* EFT collection form */}
          {showEftForm && (link.payment_method === 'eft' || link.payment_method === 'all') && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Landmark className="h-4 w-4 text-primary" /> Bank account (void cheque)
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eft-holder">Account holder name</Label>
                <Input id="eft-holder" value={eft.holder_name} onChange={(e) => setEft({ ...eft, holder_name: e.target.value })} placeholder="As shown on the cheque" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="eft-inst">Institution # (3)</Label>
                  <Input id="eft-inst" inputMode="numeric" maxLength={3} value={eft.institution} onChange={(e) => setEft({ ...eft, institution: e.target.value.replace(/\D/g, '') })} placeholder="001" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eft-transit">Transit # (5)</Label>
                  <Input id="eft-transit" inputMode="numeric" maxLength={5} value={eft.transit} onChange={(e) => setEft({ ...eft, transit: e.target.value.replace(/\D/g, '') })} placeholder="12345" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eft-acct">Account number</Label>
                <Input id="eft-acct" inputMode="numeric" maxLength={17} value={eft.account_number} onChange={(e) => setEft({ ...eft, account_number: e.target.value.replace(/\D/g, '') })} placeholder="1234567" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eft-street">Billing street address</Label>
                <Input id="eft-street" value={eft.street} onChange={(e) => setEft({ ...eft, street: e.target.value })} placeholder="123 Main St" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="eft-city">City</Label>
                  <Input id="eft-city" value={eft.city} onChange={(e) => setEft({ ...eft, city: e.target.value })} placeholder="Toronto" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eft-zip">Postal code (optional)</Label>
                  <Input id="eft-zip" value={eft.zip} onChange={(e) => setEft({ ...eft, zip: e.target.value })} placeholder="M5H 2N2" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={eft.account_type === 'CHECKING' ? 'default' : 'outline'} onClick={() => setEft({ ...eft, account_type: 'CHECKING' })}>Chequing</Button>
                <Button type="button" size="sm" variant={eft.account_type === 'SAVINGS' ? 'default' : 'outline'} onClick={() => setEft({ ...eft, account_type: 'SAVINGS' })}>Savings</Button>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <Checkbox id="eft-consent" checked={eft.consent} onCheckedChange={(v) => setEft({ ...eft, consent: !!v })} />
                <label htmlFor="eft-consent" className="text-xs text-muted-foreground leading-snug">
                  I authorize a one-time Pre-Authorized Debit (PAD) of <strong>{Number(link.amount).toFixed(2)} {link.currency}</strong> from the bank account above for payment reference <span className="font-mono">{link.reference}</span>. I understand my recourse rights under the Canadian Payments Association Rule H1.
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1" onClick={() => setShowEftForm(false)} disabled={paying}>Back</Button>
                <Button className="flex-1" onClick={submitEft} disabled={paying}>
                  {paying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : `Debit ${Number(link.amount).toFixed(2)} ${link.currency}`}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">EFT settlements typically take 3–5 business days.</p>
            </div>
          )}

          <p className="text-[10px] text-center text-muted-foreground">
            Powered by efinsuite
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
