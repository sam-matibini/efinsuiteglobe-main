import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PaysafeCraRail = 'card' | 'eft' | 'interac';

export interface PaysafeCraPaymentInput {
  taxPaymentId: string;
  rail: PaysafeCraRail;
  /** Paysafe.js card tokenization handle, required for `rail: 'card'`. */
  paymentHandleToken?: string;
  /** Return URL for Interac e-Transfer flow. */
  returnUrl?: string;
}

/**
 * Submit a CRA `tax_payment` to Paysafe using the already-deployed
 * `paysafe-create-payment` / `paysafe-create-etransfer` edge functions.
 *
 * Phase 11 — keeps the rail abstraction so the same dialog can fall back
 * to `status='simulated'` when the Paysafe secrets are not yet configured.
 */
export function usePaysafeCraPayment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ taxPaymentId, rail, paymentHandleToken, returnUrl }: PaysafeCraPaymentInput) => {
      if (rail === 'interac') {
        const { data, error } = await supabase.functions.invoke('paysafe-create-etransfer', {
          body: { tax_payment_id: taxPaymentId, return_url: returnUrl ?? window.location.href },
        });
        if (error) throw error;
        return data as { url?: string; status?: string };
      }

      if (rail === 'card' && !paymentHandleToken) {
        throw new Error('Card payment requires a Paysafe payment handle token.');
      }

      const { data, error } = await supabase.functions.invoke('paysafe-create-payment', {
        body: {
          source_type: 'tax_payment',
          source_id: taxPaymentId,
          rail,
          payment_handle_token: paymentHandleToken,
        },
      });
      if (error) throw error;
      return data as { ok: boolean; status?: string; paysafe_id?: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-payments'] });
      qc.invalidateQueries({ queryKey: ['cra-payment-batches'] });
      toast.success('CRA payment submitted to Paysafe');
    },
    onError: (e: Error) => toast.error(`Paysafe submission failed: ${e.message}`),
  });
}
