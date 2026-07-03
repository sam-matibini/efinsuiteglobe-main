
-- ============ Connected Accounts ============
CREATE TABLE public.stripe_connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  stripe_account_id text NOT NULL UNIQUE,
  account_type text NOT NULL DEFAULT 'express' CHECK (account_type IN ('standard','express','custom')),
  country text,
  default_currency text,
  email text,
  business_profile jsonb DEFAULT '{}'::jsonb,
  capabilities jsonb DEFAULT '{}'::jsonb,
  requirements jsonb DEFAULT '{}'::jsonb,
  charges_enabled boolean DEFAULT false,
  payouts_enabled boolean DEFAULT false,
  details_submitted boolean DEFAULT false,
  disabled_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_connected_accounts TO authenticated;
GRANT ALL ON public.stripe_connected_accounts TO service_role;
ALTER TABLE public.stripe_connected_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage connected accounts" ON public.stripe_connected_accounts
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============ Persons ============
CREATE TABLE public.stripe_connected_account_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_account_id uuid NOT NULL REFERENCES public.stripe_connected_accounts(id) ON DELETE CASCADE,
  stripe_person_id text NOT NULL,
  relationship jsonb DEFAULT '{}'::jsonb,
  verification jsonb DEFAULT '{}'::jsonb,
  requirements jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connected_account_id, stripe_person_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_connected_account_persons TO authenticated;
GRANT ALL ON public.stripe_connected_account_persons TO service_role;
ALTER TABLE public.stripe_connected_account_persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access persons" ON public.stripe_connected_account_persons
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stripe_connected_accounts a WHERE a.id = connected_account_id AND public.is_org_member(auth.uid(), a.organization_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stripe_connected_accounts a WHERE a.id = connected_account_id AND public.is_org_member(auth.uid(), a.organization_id)));

-- ============ Transfers ============
CREATE TABLE public.stripe_connect_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  stripe_transfer_id text NOT NULL UNIQUE,
  destination_account_id text,
  connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,
  source_transaction text,
  description text,
  status text,
  purpose text, -- 'bill_payment' | 'payroll' | 'manual' | 'invoice_settlement'
  related_entity_type text,
  related_entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_connect_transfers TO authenticated;
GRANT ALL ON public.stripe_connect_transfers TO service_role;
ALTER TABLE public.stripe_connect_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access transfers" ON public.stripe_connect_transfers
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============ Topups ============
CREATE TABLE public.stripe_connect_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  stripe_topup_id text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  currency text NOT NULL,
  status text,
  source jsonb,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_connect_topups TO authenticated;
GRANT ALL ON public.stripe_connect_topups TO service_role;
ALTER TABLE public.stripe_connect_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access topups" ON public.stripe_connect_topups
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============ Application Fees ============
CREATE TABLE public.stripe_application_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  stripe_fee_id text NOT NULL UNIQUE,
  charge_id text,
  connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE SET NULL,
  account_stripe_id text,
  amount numeric NOT NULL,
  amount_refunded numeric DEFAULT 0,
  currency text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_application_fees TO authenticated;
GRANT ALL ON public.stripe_application_fees TO service_role;
ALTER TABLE public.stripe_application_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access app fees" ON public.stripe_application_fees
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.stripe_application_fee_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  stripe_refund_id text NOT NULL UNIQUE,
  application_fee_id uuid REFERENCES public.stripe_application_fees(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_application_fee_refunds TO authenticated;
GRANT ALL ON public.stripe_application_fee_refunds TO service_role;
ALTER TABLE public.stripe_application_fee_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access fee refunds" ON public.stripe_application_fee_refunds
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============ Link tables ============
CREATE TABLE public.bank_account_stripe_connect (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  bank_account_id uuid NOT NULL,
  connected_account_id uuid NOT NULL REFERENCES public.stripe_connected_accounts(id) ON DELETE CASCADE,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bank_account_id, connected_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_account_stripe_connect TO authenticated;
GRANT ALL ON public.bank_account_stripe_connect TO service_role;
ALTER TABLE public.bank_account_stripe_connect ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage bank links" ON public.bank_account_stripe_connect
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.vendor_stripe_connect (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  connected_account_id uuid NOT NULL REFERENCES public.stripe_connected_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_stripe_connect TO authenticated;
GRANT ALL ON public.vendor_stripe_connect TO service_role;
ALTER TABLE public.vendor_stripe_connect ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage vendor links" ON public.vendor_stripe_connect
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.employee_stripe_connect (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  connected_account_id uuid NOT NULL REFERENCES public.stripe_connected_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_stripe_connect TO authenticated;
GRANT ALL ON public.employee_stripe_connect TO service_role;
ALTER TABLE public.employee_stripe_connect ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage employee links" ON public.employee_stripe_connect
  FOR ALL TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ============ updated_at triggers ============
CREATE TRIGGER trg_sca_updated BEFORE UPDATE ON public.stripe_connected_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_scap_updated BEFORE UPDATE ON public.stripe_connected_account_persons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sct_updated BEFORE UPDATE ON public.stripe_connect_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sctp_updated BEFORE UPDATE ON public.stripe_connect_topups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_saf_updated BEFORE UPDATE ON public.stripe_application_fees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Extensions to existing tables ============
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payable_to_connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS application_fee_amount numeric;
ALTER TABLE public.payment_links ADD COLUMN IF NOT EXISTS connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sca_org ON public.stripe_connected_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_sct_org ON public.stripe_connect_transfers(organization_id);
CREATE INDEX IF NOT EXISTS idx_saf_org ON public.stripe_application_fees(organization_id);
