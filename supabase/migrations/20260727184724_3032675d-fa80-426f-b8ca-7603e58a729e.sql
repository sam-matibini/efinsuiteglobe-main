
CREATE TABLE public.virtual_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  created_by UUID,
  provider TEXT NOT NULL DEFAULT 'efincash',
  user_key TEXT NOT NULL,
  currency TEXT NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  bvn_or_nin TEXT,
  provider_account_id TEXT,
  account_number TEXT,
  bank_name TEXT,
  account_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX virtual_accounts_org_currency_idx
  ON public.virtual_accounts(organization_id, currency);

CREATE INDEX virtual_accounts_user_key_idx ON public.virtual_accounts(user_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.virtual_accounts TO authenticated;
GRANT ALL ON public.virtual_accounts TO service_role;

ALTER TABLE public.virtual_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "virtual_accounts_select_org_members"
  ON public.virtual_accounts FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "virtual_accounts_insert_org_admins"
  ON public.virtual_accounts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "virtual_accounts_update_org_admins"
  ON public.virtual_accounts FOR UPDATE
  TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id))
  WITH CHECK (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE POLICY "virtual_accounts_delete_org_admins"
  ON public.virtual_accounts FOR DELETE
  TO authenticated
  USING (public.is_org_admin_or_owner(auth.uid(), organization_id));

CREATE TRIGGER update_virtual_accounts_updated_at
  BEFORE UPDATE ON public.virtual_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
