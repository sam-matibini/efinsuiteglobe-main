
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS paysafe_merchant_ref TEXT,
  ADD COLUMN IF NOT EXISTS paysafe_eft_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paysafe_card_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','expired','cancelled')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'CAD',
  description TEXT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  create_invoice_on_payment BOOLEAN NOT NULL DEFAULT false,
  payment_method TEXT NOT NULL DEFAULT 'both' CHECK (payment_method IN ('card','eft','both')),
  paysafe_payment_handle_id TEXT,
  hosted_url TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_payment_links_org ON public.payment_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_invoice ON public.payment_links(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON public.payment_links(status);

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view payment links"
  ON public.payment_links FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can create payment links"
  ON public.payment_links FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can update payment links"
  ON public.payment_links FOR UPDATE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete payment links"
  ON public.payment_links FOR DELETE TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE IF NOT EXISTS public.payment_link_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_id UUID NOT NULL REFERENCES public.payment_links(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_link_events_link ON public.payment_link_events(payment_link_id);

ALTER TABLE public.payment_link_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view payment link events"
  ON public.payment_link_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payment_links pl
    WHERE pl.id = payment_link_id AND public.is_org_member(auth.uid(), pl.organization_id)
  ));

DROP TRIGGER IF EXISTS trg_payment_links_updated_at ON public.payment_links;
CREATE TRIGGER trg_payment_links_updated_at
  BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.next_payment_link_reference(p_org uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count FROM public.payment_links WHERE organization_id = p_org;
  RETURN 'PL-' || to_char(now(), 'YYYY') || '-' || lpad(v_count::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_payment_link(p_id uuid)
RETURNS TABLE (
  id uuid,
  reference text,
  amount numeric,
  currency text,
  description text,
  status text,
  payment_method text,
  hosted_url text,
  expires_at timestamptz,
  organization_id uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id, reference, amount, currency, description, status,
         payment_method, hosted_url, expires_at, organization_id
  FROM public.payment_links
  WHERE id = p_id AND status = 'open';
$$;

GRANT EXECUTE ON FUNCTION public.get_public_payment_link(uuid) TO anon, authenticated;
