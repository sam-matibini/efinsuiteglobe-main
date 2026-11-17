-- CRA Payments: semi-automated payments through CRA My Payment.
--
-- eFinsuite prepares, validates, approves and records a CRA payment. The authorized
-- user completes the payment on CRA's own My Payment site. Nothing here stores a CRA
-- password, MFA code or session token, and nothing signs in to CRA on anyone's behalf.
--
-- The payment register is the existing public.tax_payments table. This migration adds
-- the My Payment workflow columns, an approval policy, the CRA Representative settings,
-- the represented-client register, configurable payment categories, a receipt bucket,
-- and database-side controls (status transitions, separation of duties, audit trail).

-- ---------------------------------------------------------------------------
-- 1. Payment register columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.tax_payments
  ADD COLUMN IF NOT EXISTS workflow_status text,
  ADD COLUMN IF NOT EXISTS payer_kind text,
  ADD COLUMN IF NOT EXISTS cra_payment_type text,
  ADD COLUMN IF NOT EXISTS cra_allocation text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS business_number text,
  ADD COLUMN IF NOT EXISTS program_account text,
  ADD COLUMN IF NOT EXISTS represented_client_id uuid,
  ADD COLUMN IF NOT EXISTS prepared_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS handoff_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS receipt_file_name text,
  ADD COLUMN IF NOT EXISTS liability_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_transaction_id uuid REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciled_by uuid,
  ADD COLUMN IF NOT EXISTS duplicate_override_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_payments_workflow_status_check') THEN
    ALTER TABLE public.tax_payments
      ADD CONSTRAINT tax_payments_workflow_status_check
      CHECK (workflow_status IS NULL OR workflow_status IN (
        'draft','awaiting_authorization','awaiting_payment','payment_initiated',
        'payment_completed','payment_failed','reconciliation_pending','reconciled','cancelled'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_payments_payer_kind_check') THEN
    ALTER TABLE public.tax_payments
      ADD CONSTRAINT tax_payments_payer_kind_check
      CHECK (payer_kind IS NULL OR payer_kind IN ('individual','business'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_tax_payments_workflow
  ON public.tax_payments(organization_id, workflow_status)
  WHERE workflow_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tax_payments_duplicate_check
  ON public.tax_payments(organization_id, program_account, cra_allocation, filing_period_label)
  WHERE workflow_status IS NOT NULL;

COMMENT ON COLUMN public.tax_payments.workflow_status IS
  'CRA My Payment workflow. Null for payments made through other rails.';

-- ---------------------------------------------------------------------------
-- 2. Approval policy (one row per organization)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cra_payment_policies (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- 1 = preparer then approver; 2 = preparer, reviewer, then approver.
  approval_levels smallint NOT NULL DEFAULT 1 CHECK (approval_levels IN (1, 2)),
  -- Payments at or above this amount need the review step even when approval_levels = 1.
  review_threshold numeric(15,2),
  -- When true, the person who prepared a payment cannot review or approve it.
  separate_duties boolean NOT NULL DEFAULT true,
  reviewer_roles text[] NOT NULL DEFAULT ARRAY['owner','admin','finance_manager','accountant'],
  approver_roles text[] NOT NULL DEFAULT ARRAY['owner','admin','finance_manager'],
  -- Upper bound on a single payment. Null = no limit.
  max_payment_amount numeric(15,2),
  duplicate_window_days integer NOT NULL DEFAULT 45 CHECK (duplicate_window_days BETWEEN 0 AND 365),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cra_payment_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members read CRA payment policy" ON public.cra_payment_policies;
CREATE POLICY "Org members read CRA payment policy" ON public.cra_payment_policies
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- 3. Helper: the caller's role in an organization
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cra_member_role(p_org uuid, p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.role::text
  FROM public.organization_members om
  WHERE om.organization_id = p_org AND om.user_id = p_user
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.cra_member_role(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cra_member_role(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cra_is_org_admin(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(public.cra_member_role(p_org, auth.uid()) IN ('owner','admin','finance_manager'), false)
$$;
REVOKE EXECUTE ON FUNCTION public.cra_is_org_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cra_is_org_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "Org admins write CRA payment policy" ON public.cra_payment_policies;
CREATE POLICY "Org admins write CRA payment policy" ON public.cra_payment_policies
  FOR ALL TO authenticated
  USING (public.cra_is_org_admin(organization_id))
  WITH CHECK (public.cra_is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- 4. CRA Representative settings (Settings -> Integrations -> CRA Representative)
--    There is deliberately no password, MFA or token column.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cra_representative_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  representative_name text NOT NULL DEFAULT '',
  rep_id text NOT NULL DEFAULT '' CHECK (rep_id = '' OR rep_id ~ '^[A-Z0-9]{7,8}$'),
  group_id text NOT NULL DEFAULT '' CHECK (group_id = '' OR group_id ~ '^G[A-Z0-9]{6,7}$'),
  authentication_method text NOT NULL DEFAULT 'cra_sign_in'
    CHECK (authentication_method IN ('cra_sign_in','sign_in_partner')),
  authorization_status text NOT NULL DEFAULT 'inactive'
    CHECK (authorization_status IN ('active','inactive')),
  access_level text NOT NULL DEFAULT 'level_1'
    CHECK (access_level IN ('level_1','level_2','level_3')),
  notes text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.cra_representative_settings IS
  'CRA representative identity metadata only. Never store CRA passwords, MFA codes or session tokens.';

ALTER TABLE public.cra_representative_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members read CRA representative" ON public.cra_representative_settings;
CREATE POLICY "Org members read CRA representative" ON public.cra_representative_settings
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org admins write CRA representative" ON public.cra_representative_settings;
CREATE POLICY "Org admins write CRA representative" ON public.cra_representative_settings
  FOR ALL TO authenticated
  USING (public.cra_is_org_admin(organization_id))
  WITH CHECK (public.cra_is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- 5. Represented-client authorization register
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cra_represented_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  payer_kind text NOT NULL DEFAULT 'business' CHECK (payer_kind IN ('individual','business')),
  business_number text NOT NULL DEFAULT '' CHECK (business_number = '' OR business_number ~ '^[0-9]{9}$'),
  program_accounts text[] NOT NULL DEFAULT '{}',
  access_level text NOT NULL DEFAULT 'level_1' CHECK (access_level IN ('level_1','level_2','level_3')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked','expired')),
  authorized_on date,
  expires_on date,
  notes text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cra_represented_clients_org ON public.cra_represented_clients(organization_id);

ALTER TABLE public.cra_represented_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members read represented clients" ON public.cra_represented_clients;
CREATE POLICY "Org members read represented clients" ON public.cra_represented_clients
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org admins write represented clients" ON public.cra_represented_clients;
CREATE POLICY "Org admins write represented clients" ON public.cra_represented_clients
  FOR ALL TO authenticated
  USING (public.cra_is_org_admin(organization_id))
  WITH CHECK (public.cra_is_org_admin(organization_id));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_payments_represented_client_fk') THEN
    ALTER TABLE public.tax_payments
      ADD CONSTRAINT tax_payments_represented_client_fk
      FOREIGN KEY (represented_client_id) REFERENCES public.cra_represented_clients(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 6. Configurable payment categories
--    The built-in CRA catalog lives in the app. Rows here add, rename or hide
--    categories and allocations for one organization when CRA changes its list.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cra_payment_catalog_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  payer_kind text NOT NULL CHECK (payer_kind IN ('individual','business')),
  type_key text NOT NULL CHECK (type_key ~ '^[a-z0-9_]{2,60}$'),
  label text,
  program_code text,
  allocations jsonb,
  hidden boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, payer_kind, type_key)
);

ALTER TABLE public.cra_payment_catalog_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members read CRA catalog" ON public.cra_payment_catalog_overrides;
CREATE POLICY "Org members read CRA catalog" ON public.cra_payment_catalog_overrides
  FOR SELECT TO authenticated USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "Org admins write CRA catalog" ON public.cra_payment_catalog_overrides;
CREATE POLICY "Org admins write CRA catalog" ON public.cra_payment_catalog_overrides
  FOR ALL TO authenticated
  USING (public.cra_is_org_admin(organization_id))
  WITH CHECK (public.cra_is_org_admin(organization_id));

-- ---------------------------------------------------------------------------
-- 7. Payment reference EF-CRA-000001
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_cra_my_payment_reference(p_org uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_max int;
BEGIN
  IF NOT public.is_org_member(auth.uid(), p_org) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('cra-my-payment-ref:' || p_org::text));
  SELECT coalesce(max(substring(reference FROM '^EF-CRA-([0-9]+)$')::int), 0)
    INTO v_max
    FROM public.tax_payments
   WHERE organization_id = p_org AND reference ~ '^EF-CRA-[0-9]+$';
  RETURN 'EF-CRA-' || lpad((v_max + 1)::text, 6, '0');
END $$;
REVOKE EXECUTE ON FUNCTION public.next_cra_my_payment_reference(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.next_cra_my_payment_reference(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Workflow controls enforced in the database
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_cra_my_payment_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_policy public.cra_payment_policies%ROWTYPE;
  v_old text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.workflow_status ELSE NULL END;
  v_new text := NEW.workflow_status;
  v_role text;
  v_actor uuid := auth.uid();
  v_needs_review boolean;
BEGIN
  IF v_new IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_policy FROM public.cra_payment_policies WHERE organization_id = NEW.organization_id;
  IF NOT FOUND THEN
    v_policy.approval_levels := 1;
    v_policy.separate_duties := true;
    v_policy.reviewer_roles := ARRAY['owner','admin','finance_manager','accountant'];
    v_policy.approver_roles := ARRAY['owner','admin','finance_manager'];
    v_policy.max_payment_amount := NULL;
    v_policy.review_threshold := NULL;
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'A CRA payment amount must be greater than zero';
  END IF;
  IF v_policy.max_payment_amount IS NOT NULL AND NEW.amount > v_policy.max_payment_amount THEN
    RAISE EXCEPTION 'Amount % is above the organization limit of %', NEW.amount, v_policy.max_payment_amount;
  END IF;

  -- Legal transitions only.
  IF TG_OP = 'INSERT' THEN
    IF v_new NOT IN ('draft','awaiting_authorization') THEN
      RAISE EXCEPTION 'A new CRA payment starts as a draft';
    END IF;
  ELSIF v_old IS DISTINCT FROM v_new THEN
    IF NOT (
      (v_old = 'draft' AND v_new IN ('awaiting_authorization','cancelled')) OR
      (v_old = 'awaiting_authorization' AND v_new IN ('awaiting_authorization','awaiting_payment','draft','cancelled')) OR
      (v_old = 'awaiting_payment' AND v_new IN ('payment_initiated','draft','cancelled')) OR
      (v_old = 'payment_initiated' AND v_new IN ('payment_completed','payment_failed','awaiting_payment')) OR
      (v_old = 'payment_failed' AND v_new IN ('awaiting_payment','cancelled')) OR
      (v_old = 'payment_completed' AND v_new IN ('reconciliation_pending','reconciled')) OR
      (v_old = 'reconciliation_pending' AND v_new IN ('reconciled'))
    ) THEN
      RAISE EXCEPTION 'A CRA payment cannot move from % to %', v_old, v_new;
    END IF;
  END IF;

  -- Amount, account and allocation are frozen once the payment is approved.
  IF TG_OP = 'UPDATE' AND v_old IN ('awaiting_payment','payment_initiated','payment_completed','reconciliation_pending','reconciled','payment_failed')
     AND v_new NOT IN ('draft','cancelled') THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount
       OR NEW.program_account IS DISTINCT FROM OLD.program_account
       OR NEW.cra_allocation IS DISTINCT FROM OLD.cra_allocation
       OR NEW.cra_payment_type IS DISTINCT FROM OLD.cra_payment_type THEN
      RAISE EXCEPTION 'Return the payment to draft before changing the amount, account or allocation';
    END IF;
  END IF;

  -- Sending back to draft clears approvals.
  IF TG_OP = 'UPDATE' AND v_new = 'draft' AND v_old IS DISTINCT FROM 'draft' THEN
    NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL;
  END IF;

  v_needs_review := v_policy.approval_levels = 2
    OR (v_policy.review_threshold IS NOT NULL AND NEW.amount >= v_policy.review_threshold);

  -- Review step.
  IF TG_OP = 'UPDATE' AND NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by AND NEW.reviewed_by IS NOT NULL THEN
    IF NEW.reviewed_by IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'A review is recorded by the reviewer';
    END IF;
    v_role := public.cra_member_role(NEW.organization_id, v_actor);
    IF v_role IS NULL OR NOT (v_role = ANY (v_policy.reviewer_roles)) THEN
      RAISE EXCEPTION 'Your role cannot review CRA payments';
    END IF;
    IF v_policy.separate_duties AND NEW.reviewed_by = NEW.prepared_by THEN
      RAISE EXCEPTION 'The preparer cannot review their own CRA payment';
    END IF;
    NEW.reviewed_at := now();
  END IF;

  -- Approval step.
  IF TG_OP = 'UPDATE' AND NEW.approved_by IS DISTINCT FROM OLD.approved_by AND NEW.approved_by IS NOT NULL THEN
    IF NEW.approved_by IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'An approval is recorded by the approver';
    END IF;
    v_role := public.cra_member_role(NEW.organization_id, v_actor);
    IF v_role IS NULL OR NOT (v_role = ANY (v_policy.approver_roles)) THEN
      RAISE EXCEPTION 'Your role cannot approve CRA payments';
    END IF;
    IF v_policy.separate_duties AND (NEW.approved_by = NEW.prepared_by) THEN
      RAISE EXCEPTION 'The preparer cannot approve their own CRA payment';
    END IF;
    IF v_policy.separate_duties AND v_needs_review AND NEW.approved_by = NEW.reviewed_by THEN
      RAISE EXCEPTION 'The reviewer and the approver must be different people';
    END IF;
    IF v_needs_review AND NEW.reviewed_by IS NULL THEN
      RAISE EXCEPTION 'This payment needs a review before approval';
    END IF;
    NEW.approved_at := now();
  END IF;

  IF v_new = 'awaiting_payment' AND (v_old IS DISTINCT FROM 'awaiting_payment') THEN
    IF NEW.approved_by IS NULL THEN
      RAISE EXCEPTION 'A CRA payment must be approved before it is sent to CRA My Payment';
    END IF;
  END IF;

  IF v_new = 'payment_initiated' AND v_old IS DISTINCT FROM 'payment_initiated' THEN
    NEW.handoff_at := coalesce(NEW.handoff_at, now());
  END IF;

  -- Completion needs evidence from CRA.
  IF v_new IN ('payment_completed','reconciliation_pending','reconciled') THEN
    IF coalesce(btrim(NEW.confirmation_number), '') = '' THEN
      RAISE EXCEPTION 'Record the CRA confirmation number before marking the payment completed';
    END IF;
    IF NEW.paid_at IS NULL THEN
      RAISE EXCEPTION 'Record the payment date before marking the payment completed';
    END IF;
  END IF;

  -- A journal entry belongs only to a confirmed payment.
  IF NEW.journal_entry_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.journal_entry_id IS DISTINCT FROM OLD.journal_entry_id)
     AND v_new NOT IN ('payment_completed','reconciliation_pending','reconciled') THEN
    RAISE EXCEPTION 'Post the journal entry only after the CRA payment is confirmed';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.journal_entry_id IS NOT NULL AND NEW.journal_entry_id IS DISTINCT FROM OLD.journal_entry_id THEN
    RAISE EXCEPTION 'This CRA payment already has a journal entry';
  END IF;

  IF v_new = 'reconciled' AND NEW.bank_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Match a bank transaction before marking the payment reconciled';
  END IF;
  IF v_new = 'reconciled' AND (v_old IS DISTINCT FROM 'reconciled') THEN
    NEW.reconciled_at := now();
    NEW.reconciled_by := v_actor;
  END IF;

  -- Keep the legacy status column meaningful for existing screens.
  NEW.status := CASE v_new
    WHEN 'draft' THEN 'draft'
    WHEN 'awaiting_authorization' THEN 'pending'
    WHEN 'awaiting_payment' THEN 'authorized'
    WHEN 'payment_initiated' THEN 'processing'
    WHEN 'payment_completed' THEN 'completed'
    WHEN 'reconciliation_pending' THEN 'completed'
    WHEN 'reconciled' THEN 'completed'
    WHEN 'payment_failed' THEN 'failed'
    WHEN 'cancelled' THEN 'cancelled'
  END;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_cra_my_payment_workflow ON public.tax_payments;
CREATE TRIGGER trg_enforce_cra_my_payment_workflow
  BEFORE INSERT OR UPDATE ON public.tax_payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cra_my_payment_workflow();

-- Approved or paid CRA payments cannot be deleted; cancel them instead.
CREATE OR REPLACE FUNCTION public.prevent_cra_my_payment_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.workflow_status IS NOT NULL AND OLD.workflow_status NOT IN ('draft','cancelled') THEN
    RAISE EXCEPTION 'A CRA payment in % cannot be deleted. Cancel it or keep it for the audit trail.', OLD.workflow_status;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_cra_my_payment_delete ON public.tax_payments;
CREATE TRIGGER trg_prevent_cra_my_payment_delete
  BEFORE DELETE ON public.tax_payments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cra_my_payment_delete();

-- ---------------------------------------------------------------------------
-- 9. Audit trail: every change to a My Payment record goes to the append-only log
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_cra_my_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.workflow_status IS NULL THEN RETURN OLD; END IF;
    INSERT INTO public.cra_payment_audit_logs (organization_id, entity_type, entity_id, action, actor_id, before_data)
    VALUES (OLD.organization_id, 'cra_my_payment', OLD.id, 'deleted', auth.uid(), to_jsonb(OLD) - 'metadata');
    RETURN OLD;
  END IF;

  IF NEW.workflow_status IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_after := to_jsonb(NEW) - 'metadata';
  ELSE
    IF to_jsonb(OLD) = to_jsonb(NEW) THEN RETURN NEW; END IF;
    v_action := CASE
      WHEN OLD.workflow_status IS DISTINCT FROM NEW.workflow_status THEN 'status:' || NEW.workflow_status
      WHEN OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by AND NEW.reviewed_by IS NOT NULL THEN 'reviewed'
      WHEN OLD.journal_entry_id IS DISTINCT FROM NEW.journal_entry_id THEN 'journal_posted'
      WHEN OLD.receipt_path IS DISTINCT FROM NEW.receipt_path THEN 'receipt_attached'
      WHEN OLD.bank_transaction_id IS DISTINCT FROM NEW.bank_transaction_id THEN 'bank_matched'
      ELSE 'updated'
    END;
    v_before := to_jsonb(OLD) - 'metadata';
    v_after := to_jsonb(NEW) - 'metadata';
  END IF;

  INSERT INTO public.cra_payment_audit_logs (organization_id, entity_type, entity_id, action, actor_id, before_data, after_data)
  VALUES (NEW.organization_id, 'cra_my_payment', NEW.id, v_action, auth.uid(), v_before, v_after);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_cra_my_payment ON public.tax_payments;
CREATE TRIGGER trg_audit_cra_my_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.tax_payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_cra_my_payment();

-- ---------------------------------------------------------------------------
-- 10. Private receipt storage, one folder per organization
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cra-payment-receipts', 'cra-payment-receipts', false, 10485760,
  ARRAY['application/pdf','image/png','image/jpeg','image/webp','message/rfc822','text/plain']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cra_payment_receipts_read" ON storage.objects;
CREATE POLICY "cra_payment_receipts_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'cra-payment-receipts'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "cra_payment_receipts_write" ON storage.objects;
CREATE POLICY "cra_payment_receipts_write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cra-payment-receipts'
  AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id::text = (storage.foldername(name))[1]
  )
);
-- No update or delete policy: receipts are kept for the audit trail.
