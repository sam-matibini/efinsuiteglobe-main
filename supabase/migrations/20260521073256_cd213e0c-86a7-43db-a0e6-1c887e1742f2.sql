DROP FUNCTION IF EXISTS public.get_public_payment_link(uuid);

CREATE OR REPLACE FUNCTION public.get_public_payment_link(p_id uuid)
RETURNS TABLE (
  id uuid,
  reference text,
  amount numeric,
  currency text,
  description text,
  status text,
  payment_method text,
  hosted_url text,
  expires_at timestamptz,
  organization_id uuid,
  instant_payment boolean,
  instant_method text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id, reference, amount, currency, description, status,
         payment_method, hosted_url, expires_at, organization_id,
         instant_payment, instant_method
  FROM public.payment_links
  WHERE id = p_id AND status = 'open';
$$;

GRANT EXECUTE ON FUNCTION public.get_public_payment_link(uuid) TO anon, authenticated;