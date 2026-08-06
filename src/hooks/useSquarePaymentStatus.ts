import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SquarePaymentStatus = 'paid' | 'cancelled' | 'pending' | 'unknown';

export interface SquarePaymentStatusResult {
  status: SquarePaymentStatus;
  amount?: number;
  currency?: string;
  error?: string;
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 8;

async function invokeStatus(paymentLinkId: string): Promise<SquarePaymentStatusResult> {
  const { data, error: invErr } = await supabase.functions.invoke('square-check-payment-status', {
    body: { payment_link_id: paymentLinkId },
  });

  const payload = (data ?? {}) as SquarePaymentStatusResult;
  let serverMsg: string | undefined = payload.error;
  if (!serverMsg && invErr) {
    const ctx = (invErr as unknown as { context?: Response }).context;
    try { serverMsg = (await ctx?.clone().json())?.error; } catch { /* ignore */ }
  }
  if (serverMsg && !payload.status) {
    return { status: 'unknown', error: serverMsg };
  }
  return { status: payload.status ?? 'unknown', amount: payload.amount, currency: payload.currency, error: serverMsg };
}

/**
 * Verifies a Square hosted-checkout payment by polling `square-check-payment-status`
 * until the status is terminal or the poll budget is exhausted. Read-only: it
 * never records anything, it only decides what the payer should be told.
 */
export function useSquarePaymentStatus(paymentLinkId: string | undefined) {
  const [status, setStatus] = useState<SquarePaymentStatus>('pending');
  const [result, setResult] = useState<SquarePaymentStatusResult | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [done, setDone] = useState(false);
  const cancelledRef = useRef(false);

  const check = useCallback(async (): Promise<SquarePaymentStatusResult> => {
    if (!paymentLinkId) return { status: 'unknown', error: 'Missing payment link' };
    const res = await invokeStatus(paymentLinkId);
    if (!cancelledRef.current) {
      setResult(res);
      setStatus(res.status);
    }
    return res;
  }, [paymentLinkId]);

  useEffect(() => {
    cancelledRef.current = false;
    setStatus('pending');
    setVerifying(true);
    setDone(false);
    setResult(null);
    if (!paymentLinkId) return;

    let active = true;
    const poll = async () => {
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && active; attempt++) {
        const res = await invokeStatus(paymentLinkId);
        if (!active) return;
        setResult(res);
        setStatus(res.status);
        if (res.status !== 'pending') break;
        if (attempt < MAX_POLL_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
      }
      if (active) {
        setVerifying(false);
        setDone(true);
      }
    };
    poll();

    return () => {
      active = false;
      cancelledRef.current = true;
    };
  }, [paymentLinkId]);

  const retry = useCallback(() => {
    setVerifying(true);
    setDone(false);
    check().then(() => {
      if (!cancelledRef.current) {
        setVerifying(false);
        setDone(true);
      }
    }).catch(() => {
      if (!cancelledRef.current) {
        setStatus('unknown');
        setVerifying(false);
        setDone(true);
      }
    });
  }, [check]);

  return { status, result, verifying, done, retry };
}
