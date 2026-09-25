
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS stripe_connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.expense_claims ADD COLUMN IF NOT EXISTS stripe_connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.pay_runs ADD COLUMN IF NOT EXISTS stripe_connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.vendor_stripe_connect ADD COLUMN IF NOT EXISTS default_payout_method text DEFAULT 'bank';

CREATE TABLE IF NOT EXISTS public.stripe_payouts_to_vendor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('bill','expense_claim','pay_run')),
  source_id uuid NOT NULL,
  connected_account_id uuid REFERENCES public.stripe_connected_accounts(id) ON DELETE SET NULL,
  vendor_id uuid,
  employee_id uuid,
  stripe_transfer_id text,
  stripe_payout_id text,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  journal_entry_id uuid,
  initiated_by uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_payouts_to_vendor TO authenticated;
GRANT ALL ON public.stripe_payouts_to_vendor TO service_role;

ALTER TABLE public.stripe_payouts_to_vendor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage stripe payouts"
ON public.stripe_payouts_to_vendor FOR ALL
USING (public.is_org_member(auth.uid(), org_id))
WITH CHECK (public.is_org_member(auth.uid(), org_id));

CREATE INDEX IF NOT EXISTS idx_sptv_source ON public.stripe_payouts_to_vendor(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_sptv_org ON public.stripe_payouts_to_vendor(org_id);
CREATE INDEX IF NOT EXISTS idx_sptv_transfer ON public.stripe_payouts_to_vendor(stripe_transfer_id);

CREATE TRIGGER update_sptv_updated_at
BEFORE UPDATE ON public.stripe_payouts_to_vendor
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
