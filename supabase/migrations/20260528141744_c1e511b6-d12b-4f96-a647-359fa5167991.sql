
CREATE TABLE public.treasury_webhook_events (
  provider_event_id text PRIMARY KEY,
  provider text NOT NULL DEFAULT 'paysafe',
  event_type text,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.treasury_webhook_events TO service_role;
ALTER TABLE public.treasury_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reconciliation_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  tax_payment_id uuid REFERENCES public.tax_payments(id) ON DELETE CASCADE,
  bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  reason text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_recon_queue_org_status ON public.reconciliation_review_queue(organization_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reconciliation_review_queue TO authenticated;
GRANT ALL ON public.reconciliation_review_queue TO service_role;
ALTER TABLE public.reconciliation_review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage their org recon queue"
ON public.reconciliation_review_queue
FOR ALL TO authenticated
USING (public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE TABLE public.fintrac_large_eft_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  tax_payment_id uuid REFERENCES public.tax_payments(id) ON DELETE SET NULL,
  aggregate_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'CAD',
  reportable_date date NOT NULL,
  report_status text NOT NULL DEFAULT 'pending',
  filed_at timestamptz,
  fintrac_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fintrac_org_status ON public.fintrac_large_eft_reports(organization_id, report_status);
CREATE INDEX idx_fintrac_tax_payment ON public.fintrac_large_eft_reports(tax_payment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fintrac_large_eft_reports TO authenticated;
GRANT ALL ON public.fintrac_large_eft_reports TO service_role;
ALTER TABLE public.fintrac_large_eft_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage their FINTRAC reports"
ON public.fintrac_large_eft_reports
FOR ALL TO authenticated
USING (public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

ALTER TABLE public.cra_audit_log ADD COLUMN IF NOT EXISTS provider_event_id text;
CREATE INDEX IF NOT EXISTS idx_cra_audit_provider_event ON public.cra_audit_log(provider_event_id);

CREATE OR REPLACE FUNCTION public.fn_check_fintrac_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rolling_total numeric;
  is_eft boolean;
BEGIN
  is_eft := COALESCE(NEW.payment_rail, NEW.payment_method) IN ('eft','pad','vopay_eft','vopay_pad','paysafe_eft');
  IF NOT is_eft THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('processing','submitted','completed','authorized') THEN RETURN NEW; END IF;
  IF COALESCE(NEW.currency,'CAD') <> 'CAD' THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(amount),0) INTO rolling_total
  FROM public.tax_payments
  WHERE organization_id = NEW.organization_id
    AND COALESCE(payment_rail, payment_method) IN ('eft','pad','vopay_eft','vopay_pad','paysafe_eft')
    AND status IN ('processing','submitted','completed','authorized')
    AND created_at >= NEW.created_at - interval '24 hours'
    AND created_at <= NEW.created_at;

  IF rolling_total >= 10000 THEN
    INSERT INTO public.fintrac_large_eft_reports
      (organization_id, tax_payment_id, aggregate_amount, currency, reportable_date, report_status, notes)
    SELECT NEW.organization_id, NEW.id, rolling_total, COALESCE(NEW.currency,'CAD'),
           (NEW.created_at AT TIME ZONE 'UTC')::date, 'pending',
           'Auto-flagged: rolling 24h CRA EFT aggregate reached CAD ' || rolling_total::text
    WHERE NOT EXISTS (
      SELECT 1 FROM public.fintrac_large_eft_reports WHERE tax_payment_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fintrac_threshold ON public.tax_payments;
CREATE TRIGGER trg_fintrac_threshold
AFTER INSERT OR UPDATE OF status, amount ON public.tax_payments
FOR EACH ROW EXECUTE FUNCTION public.fn_check_fintrac_threshold();

CREATE TRIGGER trg_fintrac_updated_at
BEFORE UPDATE ON public.fintrac_large_eft_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
