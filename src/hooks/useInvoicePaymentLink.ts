/**
 * Hook to ensure a stable, shareable Pay Now link for an invoice.
 *
 * Looks up an existing OPEN payment_links row for the invoice whose amount
 * still matches the invoice's balance due; if none, creates one. The hosted
 * page lives at `/pay/{payment_link_id}` and presents every payment method
 * the org has enabled (card, debit, Visa Debit, EFT, Interac e-Transfer).
 */
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationContext } from './useOrganizationContext';
import { useAuth } from './useAuth';

export interface InvoiceLikeForLink {
  id: string;
  invoice_number?: string | null;
  total?: number | null;
  amount_paid?: number | null;
  balance_due?: number | null;
  currency?: string | null;
  customer_id?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  customer?: { name?: string | null; email?: string | null } | null;
}

export interface InvoicePayLink {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  url: string;
  qrUrl: string;
}

type PaymentLinkRow = {
  id: string;
  reference: string;
  amount: number | string;
  currency: string;
  status: string;
};

function toLink(row: PaymentLinkRow): InvoicePayLink {
  const url = `${window.location.origin}/pay/${row.id}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(url)}`;
  return {
    id: row.id,
    reference: row.reference,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    url,
    qrUrl,
  };
}

export function computeBalance(invoice: InvoiceLikeForLink): number {
  const explicit = invoice.balance_due;
  if (explicit !== undefined && explicit !== null) return Number(explicit) || 0;
  return (Number(invoice.total ?? 0) - Number(invoice.amount_paid ?? 0)) || 0;
}

export function useInvoicePaymentLink() {
  const { currentOrganization } = useOrganizationContext();
  const { user } = useAuth();
  const orgId = currentOrganization?.id;

  const ensureLink = useCallback(
    async (invoice: InvoiceLikeForLink): Promise<InvoicePayLink | null> => {
      if (!invoice?.id || !orgId) return null;
      const balance = computeBalance(invoice);
      if (!(balance > 0)) return null;
      const currency = (invoice.currency || 'CAD').toUpperCase();

      // Reuse the most recent OPEN link if amount + currency still match.
      const { data: existing } = await supabase
        .from('payment_links' as never)
        .select('id, reference, amount, currency, status')
        .eq('organization_id', orgId)
        .eq('invoice_id', invoice.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);
      const rows = (existing ?? []) as unknown as PaymentLinkRow[];
      const found = rows[0];
      if (
        found &&
        Math.abs(Number(found.amount) - balance) < 0.01 &&
        String(found.currency || '').toUpperCase() === currency
      ) {
        return toLink(found);
      }

      const { data: refData, error: refErr } = await supabase.rpc(
        'next_payment_link_reference' as never,
        { p_org: orgId } as never,
      );
      if (refErr) throw refErr;
      const reference = refData as unknown as string;

      const payerName = invoice.buyer_name ?? invoice.customer?.name ?? null;
      const payerEmail = invoice.buyer_email ?? invoice.customer?.email ?? null;

      const { data, error } = await supabase
        .from('payment_links' as never)
        .insert({
          organization_id: orgId,
          reference,
          status: 'open',
          currency,
          payment_method: 'all',
          create_invoice_on_payment: false,
          created_by: user?.id ?? null,
          amount: balance,
          description: invoice.invoice_number
            ? `Invoice ${invoice.invoice_number}`
            : 'Invoice payment',
          invoice_id: invoice.id,
          customer_id: invoice.customer_id ?? null,
          payer_name: payerName,
          payer_email: payerEmail,
        } as never)
        .select('id, reference, amount, currency, status')
        .single();
      if (error) throw error;
      return toLink(data as unknown as PaymentLinkRow);
    },
    [orgId, user?.id],
  );

  return { ensureLink };
}
