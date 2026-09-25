-- Consolidate to one shared account per currency (keep oldest per currency)
DELETE FROM public.wise_receiving_accounts a
USING public.wise_receiving_accounts b
WHERE a.currency = b.currency
  AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

DROP POLICY IF EXISTS "Members can view wise receiving accounts" ON public.wise_receiving_accounts;
DROP POLICY IF EXISTS "Org admins can insert wise receiving accounts" ON public.wise_receiving_accounts;
DROP POLICY IF EXISTS "Org admins can update wise receiving accounts" ON public.wise_receiving_accounts;
DROP POLICY IF EXISTS "Org admins can delete wise receiving accounts" ON public.wise_receiving_accounts;

DROP INDEX IF EXISTS public.idx_wise_receiving_accounts_org;
ALTER TABLE public.wise_receiving_accounts DROP CONSTRAINT IF EXISTS wise_receiving_accounts_organization_id_currency_key;
ALTER TABLE public.wise_receiving_accounts DROP COLUMN IF EXISTS organization_id;
ALTER TABLE public.wise_receiving_accounts DROP COLUMN IF EXISTS gl_bank_account_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wise_receiving_accounts_currency
  ON public.wise_receiving_accounts (currency);

CREATE POLICY "Authenticated users can view wise receiving accounts"
  ON public.wise_receiving_accounts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Platform admins can insert wise receiving accounts"
  ON public.wise_receiving_accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins can update wise receiving accounts"
  ON public.wise_receiving_accounts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins can delete wise receiving accounts"
  ON public.wise_receiving_accounts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));