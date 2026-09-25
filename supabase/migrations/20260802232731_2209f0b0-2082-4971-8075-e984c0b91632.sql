CREATE TABLE public.wise_receiving_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  currency text NOT NULL,
  account_holder_name text,
  bank_name text,
  account_number text,
  routing_number text,
  iban text,
  bic_swift text,
  sort_code text,
  institution_address text,
  wise_profile_id text,
  wise_balance_id text,
  gl_bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, currency)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wise_receiving_accounts TO authenticated;
GRANT ALL ON public.wise_receiving_accounts TO service_role;

ALTER TABLE public.wise_receiving_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view wise receiving accounts"
  ON public.wise_receiving_accounts FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org admins can insert wise receiving accounts"
  ON public.wise_receiving_accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Org admins can update wise receiving accounts"
  ON public.wise_receiving_accounts FOR UPDATE TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "Org admins can delete wise receiving accounts"
  ON public.wise_receiving_accounts FOR DELETE TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE TRIGGER update_wise_receiving_accounts_updated_at
  BEFORE UPDATE ON public.wise_receiving_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_wise_receiving_accounts_balance ON public.wise_receiving_accounts (wise_balance_id);
CREATE INDEX idx_wise_receiving_accounts_org ON public.wise_receiving_accounts (organization_id);

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS wise_payment_reference text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_wise_payment_reference
  ON public.invoices (wise_payment_reference) WHERE wise_payment_reference IS NOT NULL;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS invoice_wise_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.wise_webhook_events
  ADD COLUMN IF NOT EXISTS matched_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_status text,
  ADD COLUMN IF NOT EXISTS matched_reference text,
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wise_webhook_events_match_status
  ON public.wise_webhook_events (match_status);