-- Let organization roles that already include a module create records such as invoices.
-- Does not change the header-account posting trigger or existing feature behavior.
-- Safe to re-run. Staff-only invoice policies are removed only when they were
-- added on top of the accounting invoices table.

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = _user_id AND organization_id = _org_id
    )
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = _org_id
        AND om.organization_id = _user_id
        AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = _user_id)
        AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _org_id)
    );
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'is_org_member'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid'
      AND pg_get_functiondef(p.oid) ILIKE '%org_id%'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1 FROM public.organization_members
          WHERE user_id = auth.uid() AND organization_id = _org
        )
      $body$
    $fn$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organization_members'
      AND policyname = 'Members can view own membership'
  ) THEN
    CREATE POLICY "Members can view own membership"
      ON public.organization_members
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'organization_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'staff insert invoices'
    ) THEN
      DROP POLICY "staff insert invoices" ON public.invoices;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'invoices' AND cmd = 'INSERT'
    ) THEN
      CREATE POLICY "Users can create invoices in their organization"
        ON public.invoices
        FOR INSERT
        TO authenticated
        WITH CHECK (public.is_org_member(auth.uid(), organization_id));
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoice_lines' AND column_name = 'invoice_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'organization_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'invoice_lines' AND policyname = 'staff write invoice lines'
    ) THEN
      DROP POLICY "staff write invoice lines" ON public.invoice_lines;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'invoice_lines' AND cmd = 'INSERT'
    ) THEN
      CREATE POLICY "Users can create invoice lines in their organization"
        ON public.invoice_lines
        FOR INSERT
        TO authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.invoices inv
            WHERE inv.id = invoice_lines.invoice_id
              AND public.is_org_member(auth.uid(), inv.organization_id)
          )
        );
    END IF;
  END IF;
END $$;
