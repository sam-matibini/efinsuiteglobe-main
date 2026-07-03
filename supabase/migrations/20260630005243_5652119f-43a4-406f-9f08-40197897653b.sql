
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS executive_signer_user_id uuid,
  ADD COLUMN IF NOT EXISTS executive_signer_name text,
  ADD COLUMN IF NOT EXISTS executive_signer_title text DEFAULT 'CEO/President',
  ADD COLUMN IF NOT EXISTS executive_signer_secondary_title text;

DO $$ BEGIN
  CREATE TYPE public.exec_statement_type AS ENUM (
    'balance_sheet','income_statement','cash_flow','changes_in_equity','compilation_report'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.executive_statement_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  statement_type public.exec_statement_type NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  fiscal_year_id uuid,
  revision integer NOT NULL DEFAULT 1,
  is_latest boolean NOT NULL DEFAULT true,
  signer_user_id uuid NOT NULL,
  signer_name text NOT NULL,
  signer_title text NOT NULL,
  signature_image_url text NOT NULL,
  signature_hash text,
  certification_text text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  archived_pdf_url text,
  report_snapshot_hash text,
  report_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exec_sig_org_stmt_period
  ON public.executive_statement_signatures (organization_id, statement_type, period_start, period_end);

GRANT SELECT, INSERT ON public.executive_statement_signatures TO authenticated;
GRANT ALL ON public.executive_statement_signatures TO service_role;

ALTER TABLE public.executive_statement_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view executive signatures"
  ON public.executive_statement_signatures FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Designated executive signer can insert"
  ON public.executive_statement_signatures FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(auth.uid(), organization_id)
    AND signer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND o.executive_signer_user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.handle_executive_signature_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_rev integer;
BEGIN
  SELECT COALESCE(MAX(revision), 0) + 1 INTO next_rev
  FROM public.executive_statement_signatures
  WHERE organization_id = NEW.organization_id
    AND statement_type = NEW.statement_type
    AND period_start = NEW.period_start
    AND period_end = NEW.period_end;

  NEW.revision := next_rev;
  NEW.is_latest := true;

  UPDATE public.executive_statement_signatures
    SET is_latest = false
    WHERE organization_id = NEW.organization_id
      AND statement_type = NEW.statement_type
      AND period_start = NEW.period_start
      AND period_end = NEW.period_end
      AND is_latest = true;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_exec_sig_before_insert ON public.executive_statement_signatures;
CREATE TRIGGER trg_exec_sig_before_insert
BEFORE INSERT ON public.executive_statement_signatures
FOR EACH ROW EXECUTE FUNCTION public.handle_executive_signature_insert();
