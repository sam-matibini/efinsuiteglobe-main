-- DocSign Phase 1: Own the schema.
-- Adds first-party signing primitives on top of the existing docsign tables:
--   * signer_token() DB function reading x-signer-token request header
--   * Anonymous-signer RLS policies keyed on document_signers.signing_token
--   * document_signatures table for per-signing-event audit + image capture
--   * document_signers.signer_expires_at / self_signed columns
--   * Private storage bucket + per-org path enforcement
--
-- The existing owner-scoped RLS policies stay intact. Postgres RLS combines
-- policies with OR, so signers gain the exact access they need without
-- widening org-member access.

-- ---------------------------------------------------------------------------
-- 1) Columns on document_signers
-- ---------------------------------------------------------------------------
ALTER TABLE public.document_signers
  ADD COLUMN IF NOT EXISTS signer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS self_signed boolean NOT NULL DEFAULT false;

-- Make signing_token uniquely indexed — every signer_token() lookup rides this.
CREATE UNIQUE INDEX IF NOT EXISTS document_signers_signing_token_key
  ON public.document_signers (signing_token);

-- Any existing signer row that was inserted before gen_random_uuid() default
-- was in place gets a token now.
UPDATE public.document_signers
  SET signing_token = gen_random_uuid()
  WHERE signing_token IS NULL;

ALTER TABLE public.document_signers
  ALTER COLUMN signing_token SET NOT NULL,
  ALTER COLUMN signing_token SET DEFAULT gen_random_uuid();

-- ---------------------------------------------------------------------------
-- 2) document_signatures — one row per completed signing event.
--    Separate from user_signatures (per-user reusable) and from
--    document_signers.signature_data (denormalized cache); this table is the
--    long-term audit record: image + IP + user agent + timestamp.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL REFERENCES public.document_signers(id) ON DELETE CASCADE,
  field_id uuid REFERENCES public.document_fields(id) ON DELETE SET NULL,
  image_base64 text NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_signatures_document_id_idx
  ON public.document_signatures (document_id);
CREATE INDEX IF NOT EXISTS document_signatures_signer_id_idx
  ON public.document_signatures (signer_id);

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3) signer_token() — reads x-signer-token from the current request headers.
--    Returns NULL when the header is absent or empty. STABLE so the planner
--    can reuse it within a statement. SECURITY INVOKER (default) — this
--    function does not do anything privileged, it just parses a header.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.signer_token()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.headers', true)::json ->> 'x-signer-token',
      ''
    ),
    ''
  )::uuid;
$$;

COMMENT ON FUNCTION public.signer_token() IS
  'Returns the x-signer-token request header as a UUID, or NULL if absent. '
  'Used by RLS policies to grant anonymous signer access via document_signers.signing_token.';

GRANT EXECUTE ON FUNCTION public.signer_token() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Signer RLS policies (added alongside existing owner-scoped ones).
--    Postgres combines policies with OR — owners keep full access, signers
--    gain narrowly-scoped access.
-- ---------------------------------------------------------------------------

-- document_signers: signer can read + update their own row
DROP POLICY IF EXISTS "signer_can_read_own_signer_row" ON public.document_signers;
CREATE POLICY "signer_can_read_own_signer_row"
  ON public.document_signers FOR SELECT
  USING (signing_token = public.signer_token());

DROP POLICY IF EXISTS "signer_can_update_own_signer_row" ON public.document_signers;
CREATE POLICY "signer_can_update_own_signer_row"
  ON public.document_signers FOR UPDATE
  USING (signing_token = public.signer_token())
  WITH CHECK (signing_token = public.signer_token());

-- documents: signer can read the document they're signing
DROP POLICY IF EXISTS "signer_can_read_signing_document" ON public.documents;
CREATE POLICY "signer_can_read_signing_document"
  ON public.documents FOR SELECT
  USING (
    id IN (
      SELECT ds.document_id
      FROM public.document_signers ds
      WHERE ds.signing_token = public.signer_token()
    )
  );

-- document_fields: signer can read all fields on their document, and write
-- to fields assigned to them (or unassigned "any signer" fields).
DROP POLICY IF EXISTS "signer_can_read_document_fields" ON public.document_fields;
CREATE POLICY "signer_can_read_document_fields"
  ON public.document_fields FOR SELECT
  USING (
    document_id IN (
      SELECT ds.document_id
      FROM public.document_signers ds
      WHERE ds.signing_token = public.signer_token()
    )
  );

DROP POLICY IF EXISTS "signer_can_update_assigned_fields" ON public.document_fields;
CREATE POLICY "signer_can_update_assigned_fields"
  ON public.document_fields FOR UPDATE
  USING (
    assigned_signer_id IN (
      SELECT id FROM public.document_signers
      WHERE signing_token = public.signer_token()
    )
    OR (
      assigned_signer_id IS NULL
      AND document_id IN (
        SELECT document_id FROM public.document_signers
        WHERE signing_token = public.signer_token()
      )
    )
  )
  WITH CHECK (
    document_id IN (
      SELECT ds.document_id FROM public.document_signers ds
      WHERE ds.signing_token = public.signer_token()
    )
  );

-- document_signatures: signer can write their own signature rows, and read
-- anything on documents they're a signer of.
DROP POLICY IF EXISTS "signer_can_insert_own_signature" ON public.document_signatures;
CREATE POLICY "signer_can_insert_own_signature"
  ON public.document_signatures FOR INSERT
  WITH CHECK (
    signer_id IN (
      SELECT id FROM public.document_signers
      WHERE signing_token = public.signer_token()
    )
  );

DROP POLICY IF EXISTS "signer_can_read_document_signatures" ON public.document_signatures;
CREATE POLICY "signer_can_read_document_signatures"
  ON public.document_signatures FOR SELECT
  USING (
    document_id IN (
      SELECT ds.document_id FROM public.document_signers ds
      WHERE ds.signing_token = public.signer_token()
    )
  );

-- document_signatures: org owners/members can read all signature rows on
-- documents in their org (owner audit view).
DROP POLICY IF EXISTS "org_members_can_read_document_signatures" ON public.document_signatures;
CREATE POLICY "org_members_can_read_document_signatures"
  ON public.document_signatures FOR SELECT
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      WHERE d.organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
      OR d.organization_id IN (
        SELECT id FROM public.organizations
        WHERE owner_id = auth.uid()
      )
    )
  );

-- document_audit_logs: signer can write audit rows on their document
DROP POLICY IF EXISTS "signer_can_insert_audit_log" ON public.document_audit_logs;
CREATE POLICY "signer_can_insert_audit_log"
  ON public.document_audit_logs FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT ds.document_id FROM public.document_signers ds
      WHERE ds.signing_token = public.signer_token()
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Storage: lock down the docsign-documents bucket.
--    Old bucket was public with any-authenticated-user policies — anyone
--    with a URL could read signed contracts. Now: private, org-scoped path
--    enforcement, edge functions get signed URLs via service role for
--    anonymous signers.
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
  SET public = false,
      file_size_limit = 20 * 1024 * 1024  -- 20 MB per spec
  WHERE id = 'docsign-documents';

DROP POLICY IF EXISTS "Users can view their organization's documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their documents" ON storage.objects;

-- Reads: org members (and owners) can read files under their org_id prefix.
-- Path convention: {org_id}/{user_id}/{ts}-{filename}. Legacy files at
-- documents/... stay readable to org members for a transition window.
CREATE POLICY "docsign_read_org_scoped"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'docsign-documents'
    AND (
      (storage.foldername(name))[1] = 'documents'  -- legacy path
      OR (storage.foldername(name))[1]::uuid IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
      OR (storage.foldername(name))[1]::uuid IN (
        SELECT id FROM public.organizations WHERE owner_id = auth.uid()
      )
    )
  );

-- Writes: only for the caller's own org, under {org_id}/{auth.uid}/...
CREATE POLICY "docsign_insert_org_scoped"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'docsign-documents'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "docsign_update_org_scoped"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'docsign-documents'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "docsign_delete_org_owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'docsign-documents'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6) updated_at trigger on document_signers if not already present.
--    Ensures signer status changes bump the timestamp for webhook/completion
--    logic in later phases.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.docsign_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_signers_touch_updated_at ON public.document_signers;
CREATE TRIGGER document_signers_touch_updated_at
  BEFORE UPDATE ON public.document_signers
  FOR EACH ROW EXECUTE FUNCTION public.docsign_touch_updated_at();
