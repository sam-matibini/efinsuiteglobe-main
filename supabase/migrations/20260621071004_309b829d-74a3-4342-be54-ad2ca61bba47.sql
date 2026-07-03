
-- =========================================================================
-- Phase 6: Disputes, Reserves & Processor API Automation
-- =========================================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE public.settlement_dispute_kind AS ENUM ('chargeback','inquiry','retrieval','refund_dispute');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.settlement_dispute_status AS ENUM ('needs_response','under_review','won','lost','withdrawn','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.processor_api_provider AS ENUM ('stripe','adyen','square','paypal','braintree','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.processor_api_mode AS ENUM ('live','test');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.processor_api_sync_status AS ENUM ('active','paused','error','disconnected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.settlement_reserve_type AS ENUM ('rolling','fixed','ad_hoc');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- settlement_disputes ----------
CREATE TABLE public.settlement_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  settlement_id uuid REFERENCES public.settlements(id) ON DELETE SET NULL,
  processor_account_id uuid NOT NULL REFERENCES public.processor_accounts(id) ON DELETE CASCADE,
  processor_dispute_id text NOT NULL,
  original_transaction_id text,
  kind public.settlement_dispute_kind NOT NULL DEFAULT 'chargeback',
  reason_code text,
  network_reason text,
  disputed_amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  fees numeric(18,2) NOT NULL DEFAULT 0,
  status public.settlement_dispute_status NOT NULL DEFAULT 'needs_response',
  evidence_due_at timestamptz,
  responded_at timestamptz,
  resolved_at timestamptz,
  outcome_amount numeric(18,2),
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  resolution_journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  assigned_to uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlement_disputes_processor_dispute_unique UNIQUE (processor_account_id, processor_dispute_id)
);

CREATE INDEX idx_settlement_disputes_org ON public.settlement_disputes(organization_id);
CREATE INDEX idx_settlement_disputes_status ON public.settlement_disputes(organization_id, status);
CREATE INDEX idx_settlement_disputes_settlement ON public.settlement_disputes(settlement_id);
CREATE INDEX idx_settlement_disputes_evidence_due ON public.settlement_disputes(evidence_due_at) WHERE status IN ('needs_response','under_review');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_disputes TO authenticated;
GRANT ALL ON public.settlement_disputes TO service_role;

ALTER TABLE public.settlement_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage settlement disputes"
  ON public.settlement_disputes FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ---------- settlement_dispute_evidence ----------
CREATE TABLE public.settlement_dispute_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  dispute_id uuid NOT NULL REFERENCES public.settlement_disputes(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'attachment', -- attachment | narrative | submission_log
  title text,
  narrative text,
  storage_path text,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  submitted_at timestamptz,
  submitted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_settlement_dispute_evidence_dispute ON public.settlement_dispute_evidence(dispute_id);
CREATE INDEX idx_settlement_dispute_evidence_org ON public.settlement_dispute_evidence(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_dispute_evidence TO authenticated;
GRANT ALL ON public.settlement_dispute_evidence TO service_role;

ALTER TABLE public.settlement_dispute_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage dispute evidence"
  ON public.settlement_dispute_evidence FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ---------- settlement_reserves ----------
CREATE TABLE public.settlement_reserves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  processor_account_id uuid NOT NULL REFERENCES public.processor_accounts(id) ON DELETE CASCADE,
  reserve_type public.settlement_reserve_type NOT NULL DEFAULT 'rolling',
  currency text NOT NULL DEFAULT 'USD',
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  current_balance numeric(18,2) NOT NULL DEFAULT 0,
  release_schedule jsonb NOT NULL DEFAULT '[]'::jsonb,
  gl_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  last_snapshot_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlement_reserves_processor_type_unique UNIQUE (processor_account_id, reserve_type)
);

CREATE INDEX idx_settlement_reserves_org ON public.settlement_reserves(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_reserves TO authenticated;
GRANT ALL ON public.settlement_reserves TO service_role;

ALTER TABLE public.settlement_reserves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage settlement reserves"
  ON public.settlement_reserves FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ---------- settlement_reserve_movements ----------
CREATE TABLE public.settlement_reserve_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  reserve_id uuid NOT NULL REFERENCES public.settlement_reserves(id) ON DELETE CASCADE,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  delta_amount numeric(18,2) NOT NULL DEFAULT 0,
  running_balance numeric(18,2) NOT NULL DEFAULT 0,
  reason text,
  source text, -- sync | manual | release
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reserve_movements_reserve ON public.settlement_reserve_movements(reserve_id, movement_date DESC);
CREATE INDEX idx_reserve_movements_org ON public.settlement_reserve_movements(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlement_reserve_movements TO authenticated;
GRANT ALL ON public.settlement_reserve_movements TO service_role;

ALTER TABLE public.settlement_reserve_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage reserve movements"
  ON public.settlement_reserve_movements FOR ALL
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- ---------- processor_api_credentials ----------
CREATE TABLE public.processor_api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  processor_account_id uuid NOT NULL UNIQUE REFERENCES public.processor_accounts(id) ON DELETE CASCADE,
  provider public.processor_api_provider NOT NULL DEFAULT 'manual',
  mode public.processor_api_mode NOT NULL DEFAULT 'live',
  credential_secret_name text,
  webhook_secret_name text,
  webhook_endpoint_id text,
  last_sync_at timestamptz,
  sync_cursor text,
  sync_status public.processor_api_sync_status NOT NULL DEFAULT 'disconnected',
  last_error text,
  connected_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_processor_api_credentials_org ON public.processor_api_credentials(organization_id);

GRANT SELECT, INSERT, UPDATE ON public.processor_api_credentials TO authenticated;
GRANT DELETE ON public.processor_api_credentials TO authenticated;
GRANT ALL ON public.processor_api_credentials TO service_role;

ALTER TABLE public.processor_api_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read processor api credentials"
  ON public.processor_api_credentials FOR SELECT
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members upsert processor api credentials"
  ON public.processor_api_credentials FOR INSERT
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Org members update processor api credentials"
  ON public.processor_api_credentials FOR UPDATE
  USING (public.is_org_member(auth.uid(), organization_id))
  WITH CHECK (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins delete processor api credentials"
  ON public.processor_api_credentials FOR DELETE
  USING (
    public.is_org_member(auth.uid(), organization_id)
    AND public.has_role(auth.uid(), 'admin')
  );

-- ---------- settlement_matches extension ----------
ALTER TABLE public.settlement_matches
  ADD COLUMN IF NOT EXISTS dispute_id uuid REFERENCES public.settlement_disputes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_settlement_matches_dispute ON public.settlement_matches(dispute_id) WHERE dispute_id IS NOT NULL;

-- ---------- updated_at triggers ----------
CREATE TRIGGER trg_settlement_disputes_updated
  BEFORE UPDATE ON public.settlement_disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_settlement_dispute_evidence_updated
  BEFORE UPDATE ON public.settlement_dispute_evidence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_settlement_reserves_updated
  BEFORE UPDATE ON public.settlement_reserves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_processor_api_credentials_updated
  BEFORE UPDATE ON public.processor_api_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- record_reserve_movement helper ----------
CREATE OR REPLACE FUNCTION public.record_reserve_movement(
  _org uuid,
  _reserve_id uuid,
  _delta numeric,
  _reason text DEFAULT NULL,
  _source text DEFAULT 'manual',
  _journal_entry_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_balance numeric;
  _movement_id uuid;
BEGIN
  UPDATE public.settlement_reserves
     SET current_balance = current_balance + _delta,
         last_snapshot_at = now()
   WHERE id = _reserve_id AND organization_id = _org
  RETURNING current_balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'Reserve % not found for org %', _reserve_id, _org;
  END IF;

  INSERT INTO public.settlement_reserve_movements(
    organization_id, reserve_id, delta_amount, running_balance, reason, source, journal_entry_id, created_by
  ) VALUES (
    _org, _reserve_id, _delta, _new_balance, _reason, _source, _journal_entry_id, auth.uid()
  )
  RETURNING id INTO _movement_id;

  RETURN _movement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_reserve_movement(uuid, uuid, numeric, text, text, uuid) TO authenticated, service_role;
