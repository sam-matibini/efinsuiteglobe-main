
CREATE TABLE public.stripe_connected_account_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  connected_account_id uuid NOT NULL REFERENCES public.stripe_connected_accounts(id) ON DELETE CASCADE,
  currency text NOT NULL,
  available_amount numeric NOT NULL DEFAULT 0,
  pending_amount numeric NOT NULL DEFAULT 0,
  reserved_amount numeric NOT NULL DEFAULT 0,
  as_of timestamptz NOT NULL DEFAULT now(),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connected_account_id, currency)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_connected_account_balances TO authenticated;
GRANT ALL ON public.stripe_connected_account_balances TO service_role;

ALTER TABLE public.stripe_connected_account_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view balances"
  ON public.stripe_connected_account_balances FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members can manage balances"
  ON public.stripe_connected_account_balances FOR ALL
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TRIGGER trg_stripe_connected_account_balances_updated
  BEFORE UPDATE ON public.stripe_connected_account_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_scab_org ON public.stripe_connected_account_balances(organization_id);
CREATE INDEX idx_scab_account ON public.stripe_connected_account_balances(connected_account_id);
