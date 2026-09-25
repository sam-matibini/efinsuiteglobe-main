ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS square_payment_link_id text,
  ADD COLUMN IF NOT EXISTS square_order_id text,
  ADD COLUMN IF NOT EXISTS square_checkout_url text;

CREATE INDEX IF NOT EXISTS payment_links_square_order_id_idx ON public.payment_links (square_order_id);

DROP FUNCTION IF EXISTS public.get_public_payment_link(uuid);

CREATE OR REPLACE FUNCTION public.get_public_payment_link(p_id uuid)
 RETURNS TABLE(id uuid, reference text, amount numeric, currency text, description text, status text, payment_method text, hosted_url text, expires_at timestamp with time zone, organization_id uuid, instant_payment boolean, instant_method text, card_provider text, square_checkout_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT pl.id, pl.reference, pl.amount, pl.currency, pl.description, pl.status,
         pl.payment_method, pl.hosted_url, pl.expires_at, pl.organization_id,
         pl.instant_payment, pl.instant_method,
         CASE
           WHEN COALESCE((o.efinconnect_preferences -> 'payoutProviders' ->> 'square')::boolean, false)
             THEN 'square'
           ELSE 'paysafe'
         END AS card_provider,
         pl.square_checkout_url
  FROM public.payment_links pl
  JOIN public.organizations o ON o.id = pl.organization_id
  WHERE pl.id = p_id AND pl.status = 'open';
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_payment_link(uuid) TO anon, authenticated;