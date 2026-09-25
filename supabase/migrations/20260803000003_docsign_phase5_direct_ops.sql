-- DocSign Phase 5: direct Supabase operations (deprecate efinsign-proxy).
-- Adds the RLS policies that let authenticated org members/owners perform
-- INSERT / UPDATE / DELETE on document_signers and document_fields directly,
-- without going through the service-role proxy.

-- ── document_signers ──────────────────────────────────────────────────────

-- INSERT: org members can add signers to documents in their org.
DROP POLICY IF EXISTS "org_members_can_insert_signers" ON public.document_signers;
CREATE POLICY "org_members_can_insert_signers"
  ON public.document_signers FOR INSERT
  TO authenticated
  WITH CHECK (
    document_id IN (
      SELECT d.id FROM public.documents d
      WHERE d.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.organizations WHERE owner_id = auth.uid()
      )
    )
  );

-- UPDATE: org members can update signers on their documents.
DROP POLICY IF EXISTS "org_members_can_update_signers" ON public.document_signers;
CREATE POLICY "org_members_can_update_signers"
  ON public.document_signers FOR UPDATE
  TO authenticated
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      WHERE d.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.organizations WHERE owner_id = auth.uid()
      )
    )
  );

-- DELETE: org members can remove signers from their documents.
DROP POLICY IF EXISTS "org_members_can_delete_signers" ON public.document_signers;
CREATE POLICY "org_members_can_delete_signers"
  ON public.document_signers FOR DELETE
  TO authenticated
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      WHERE d.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.organizations WHERE owner_id = auth.uid()
      )
    )
  );

-- SELECT: org members can read all signers on their documents.
DROP POLICY IF EXISTS "org_members_can_read_signers" ON public.document_signers;
CREATE POLICY "org_members_can_read_signers"
  ON public.document_signers FOR SELECT
  TO authenticated
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      WHERE d.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.organizations WHERE owner_id = auth.uid()
      )
    )
  );

-- ── document_fields ───────────────────────────────────────────────────────

-- INSERT: org members can add fields to documents in their org.
DROP POLICY IF EXISTS "org_members_can_insert_fields" ON public.document_fields;
CREATE POLICY "org_members_can_insert_fields"
  ON public.document_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    document_id IN (
      SELECT d.id FROM public.documents d
      WHERE d.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.organizations WHERE owner_id = auth.uid()
      )
    )
  );

-- UPDATE: org members can update fields on their documents.
DROP POLICY IF EXISTS "org_members_can_update_fields" ON public.document_fields;
CREATE POLICY "org_members_can_update_fields"
  ON public.document_fields FOR UPDATE
  TO authenticated
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      WHERE d.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.organizations WHERE owner_id = auth.uid()
      )
    )
  );

-- DELETE: org members can remove fields from their documents.
DROP POLICY IF EXISTS "org_members_can_delete_fields" ON public.document_fields;
CREATE POLICY "org_members_can_delete_fields"
  ON public.document_fields FOR DELETE
  TO authenticated
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      WHERE d.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.organizations WHERE owner_id = auth.uid()
      )
    )
  );

-- SELECT: org members can read fields on their documents.
DROP POLICY IF EXISTS "org_members_can_read_fields" ON public.document_fields;
CREATE POLICY "org_members_can_read_fields"
  ON public.document_fields FOR SELECT
  TO authenticated
  USING (
    document_id IN (
      SELECT d.id FROM public.documents d
      WHERE d.organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        UNION
        SELECT id FROM public.organizations WHERE owner_id = auth.uid()
      )
    )
  );

-- ── document_webhooks (Phase 4) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.document_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text,
  events text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_webhooks_org_idx ON public.document_webhooks (organization_id);

ALTER TABLE public.document_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_can_manage_webhooks" ON public.document_webhooks;
CREATE POLICY "org_members_can_manage_webhooks"
  ON public.document_webhooks FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.organizations WHERE owner_id = auth.uid()
    )
  );
