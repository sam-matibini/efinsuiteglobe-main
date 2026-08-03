-- DocSign Phase 1 patch: fix RLS infinite recursion on document_signers.
--
-- Root cause: a pre-existing policy on document_signers checks
--   document_id IN (SELECT id FROM documents WHERE ...)
-- That SELECT on documents triggers signer_can_read_signing_document, which
-- subqueries document_signers again → infinite loop.
--
-- Fix: two SECURITY DEFINER helper functions that query document_signers
-- without RLS, used in every signer policy that previously had an inline
-- subquery into document_signers from another table.

-- ── Helper: set of document_ids the current token can access ──────────────

CREATE OR REPLACE FUNCTION public.signer_accessible_document_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT document_id
  FROM public.document_signers
  WHERE signing_token = public.signer_token();
$$;

COMMENT ON FUNCTION public.signer_accessible_document_ids() IS
  'Returns the document_ids the current x-signer-token grants access to. '
  'SECURITY DEFINER bypasses document_signers RLS to break the circular '
  'policy dependency between documents and document_signers.';

GRANT EXECUTE ON FUNCTION public.signer_accessible_document_ids() TO anon, authenticated;

-- ── Helper: signer.id for the current token ───────────────────────────────

CREATE OR REPLACE FUNCTION public.signer_id_from_token()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.document_signers
  WHERE signing_token = public.signer_token()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.signer_id_from_token() IS
  'Returns document_signers.id for the current x-signer-token. '
  'SECURITY DEFINER bypasses document_signers RLS.';

GRANT EXECUTE ON FUNCTION public.signer_id_from_token() TO anon, authenticated;

-- ── Rewrite signer policies to use the helper functions ───────────────────

-- documents: signer can read their document
DROP POLICY IF EXISTS "signer_can_read_signing_document" ON public.documents;
CREATE POLICY "signer_can_read_signing_document"
  ON public.documents FOR SELECT
  USING (id IN (SELECT public.signer_accessible_document_ids()));

-- document_fields: signer can read all fields on their document
DROP POLICY IF EXISTS "signer_can_read_document_fields" ON public.document_fields;
CREATE POLICY "signer_can_read_document_fields"
  ON public.document_fields FOR SELECT
  USING (document_id IN (SELECT public.signer_accessible_document_ids()));

-- document_fields: signer can update fields assigned to them (or unassigned)
DROP POLICY IF EXISTS "signer_can_update_assigned_fields" ON public.document_fields;
CREATE POLICY "signer_can_update_assigned_fields"
  ON public.document_fields FOR UPDATE
  USING (
    document_id IN (SELECT public.signer_accessible_document_ids())
    AND (
      assigned_signer_id = public.signer_id_from_token()
      OR assigned_signer_id IS NULL
    )
  )
  WITH CHECK (document_id IN (SELECT public.signer_accessible_document_ids()));

-- document_signatures: signer can insert their own signature audit rows
DROP POLICY IF EXISTS "signer_can_insert_own_signature" ON public.document_signatures;
CREATE POLICY "signer_can_insert_own_signature"
  ON public.document_signatures FOR INSERT
  WITH CHECK (signer_id = public.signer_id_from_token());

-- document_signatures: signer can read signatures on their document
DROP POLICY IF EXISTS "signer_can_read_document_signatures" ON public.document_signatures;
CREATE POLICY "signer_can_read_document_signatures"
  ON public.document_signatures FOR SELECT
  USING (document_id IN (SELECT public.signer_accessible_document_ids()));

-- document_audit_logs: signer can insert audit rows on their document
DROP POLICY IF EXISTS "signer_can_insert_audit_log" ON public.document_audit_logs;
CREATE POLICY "signer_can_insert_audit_log"
  ON public.document_audit_logs FOR INSERT
  WITH CHECK (document_id IN (SELECT public.signer_accessible_document_ids()));
