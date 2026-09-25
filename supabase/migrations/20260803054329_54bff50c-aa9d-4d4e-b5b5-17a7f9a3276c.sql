-- Wise outbound payout recipients
CREATE TABLE public.wise_payout_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  vendor_id UUID,
  employee_id UUID,
  nickname TEXT,
  currency TEXT NOT NULL DEFAULT 'CAD',
  account_holder_name TEXT NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  routing_number TEXT,
  iban TEXT,
  bic_swift TEXT,
  sort_code TEXT,
  etransfer_email TEXT,
  country TEXT,
  wise_recipient_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wise_payout_recipients TO authenticated;
GRANT ALL ON public.wise_payout_recipients TO service_role;
ALTER TABLE public.wise_payout_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage wise payout recipients"
ON public.wise_payout_recipients FOR ALL TO authenticated
USING (public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_wise_recipients_org ON public.wise_payout_recipients(organization_id);
CREATE INDEX idx_wise_recipients_vendor ON public.wise_payout_recipients(vendor_id);

-- Wise outbound transfers
CREATE TABLE public.wise_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID,
  recipient_id UUID REFERENCES public.wise_payout_recipients(id) ON DELETE SET NULL,
  method TEXT NOT NULL DEFAULT 'eft',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CAD',
  reference TEXT,
  wise_quote_id TEXT,
  wise_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'instructed',
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wise_transfers TO authenticated;
GRANT ALL ON public.wise_transfers TO service_role;
ALTER TABLE public.wise_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage wise transfers"
ON public.wise_transfers FOR ALL TO authenticated
USING (public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE INDEX idx_wise_transfers_org ON public.wise_transfers(organization_id);
CREATE INDEX idx_wise_transfers_source ON public.wise_transfers(source_type, source_id);
CREATE INDEX idx_wise_transfers_wise_id ON public.wise_transfers(wise_transfer_id);

-- Provider-agnostic vendor payout routing
CREATE TABLE public.vendor_payout_routing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  payout_provider TEXT NOT NULL DEFAULT 'stripe',
  stripe_connected_account_id UUID,
  wise_recipient_id UUID REFERENCES public.wise_payout_recipients(id) ON DELETE SET NULL,
  default_payout_method TEXT NOT NULL DEFAULT 'eft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, vendor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_payout_routing TO authenticated;
GRANT ALL ON public.vendor_payout_routing TO service_role;
ALTER TABLE public.vendor_payout_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage vendor payout routing"
ON public.vendor_payout_routing FOR ALL TO authenticated
USING (public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER trg_wise_recipients_updated_at BEFORE UPDATE ON public.wise_payout_recipients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_wise_transfers_updated_at BEFORE UPDATE ON public.wise_transfers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_vendor_payout_routing_updated_at BEFORE UPDATE ON public.vendor_payout_routing
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();