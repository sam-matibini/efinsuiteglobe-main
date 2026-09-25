-- Remove remaining permissive USING(true) policies from voice tables

DROP POLICY IF EXISTS "voice_call_rates_select" ON public.voice_call_rates;
DROP POLICY IF EXISTS "Anyone can view voice rates" ON public.voice_country_rates;
DROP POLICY IF EXISTS "voice_provider_routes_select" ON public.voice_provider_routes;
DROP POLICY IF EXISTS "voice_providers_select" ON public.voice_providers;

-- Also drop the redundant admin policy that uses organization_members directly
DROP POLICY IF EXISTS "Admins can manage voice rates" ON public.voice_country_rates;