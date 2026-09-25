
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS executive_signer2_user_id uuid,
  ADD COLUMN IF NOT EXISTS executive_signer2_name text,
  ADD COLUMN IF NOT EXISTS executive_signer2_title text DEFAULT 'CFO/Treasurer',
  ADD COLUMN IF NOT EXISTS executive_signer2_secondary_title text;

ALTER TABLE public.executive_statement_signatures
  ADD COLUMN IF NOT EXISTS signer_role text NOT NULL DEFAULT 'primary';

DO $$ BEGIN
  ALTER TABLE public.executive_statement_signatures
    ADD CONSTRAINT executive_statement_signatures_signer_role_chk
    CHECK (signer_role IN ('primary','secondary'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP INDEX IF EXISTS idx_exec_sig_org_stmt_period;
CREATE INDEX IF NOT EXISTS idx_exec_sig_org_stmt_period_role
  ON public.executive_statement_signatures (organization_id, statement_type, period_start, period_end, signer_role);

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
    AND period_end = NEW.period_end
    AND signer_role = NEW.signer_role;

  NEW.revision := next_rev;
  NEW.is_latest := true;

  UPDATE public.executive_statement_signatures
    SET is_latest = false
    WHERE organization_id = NEW.organization_id
      AND statement_type = NEW.statement_type
      AND period_start = NEW.period_start
      AND period_end = NEW.period_end
      AND signer_role = NEW.signer_role
      AND is_latest = true;

  RETURN NEW;
END $$;

DROP POLICY IF EXISTS "Designated executive signer can insert" ON public.executive_statement_signatures;
CREATE POLICY "Designated executive signer can insert"
  ON public.executive_statement_signatures FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(auth.uid(), organization_id)
    AND signer_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND (
          (signer_role = 'primary' AND o.executive_signer_user_id = auth.uid())
          OR (signer_role = 'secondary' AND o.executive_signer2_user_id = auth.uid())
        )
    )
  );
