-- Fix RLS for voice tables - enable RLS and add policies

-- Enable RLS on voice tables
ALTER TABLE IF EXISTS public.voice_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.voice_provider_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.voice_call_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.voice_country_rates ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies on voice tables
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.voice_providers;
DROP POLICY IF EXISTS "Authenticated users can view voice_providers" ON public.voice_providers;
DROP POLICY IF EXISTS "Admins can manage voice_providers" ON public.voice_providers;
DROP POLICY IF EXISTS "Authenticated users can view voice providers" ON public.voice_providers;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.voice_provider_routes;
DROP POLICY IF EXISTS "Authenticated users can view voice_provider_routes" ON public.voice_provider_routes;
DROP POLICY IF EXISTS "Admins can manage voice_provider_routes" ON public.voice_provider_routes;
DROP POLICY IF EXISTS "Authenticated users can view voice routes" ON public.voice_provider_routes;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.voice_call_rates;
DROP POLICY IF EXISTS "Authenticated users can view voice_call_rates" ON public.voice_call_rates;
DROP POLICY IF EXISTS "Admins can manage voice_call_rates" ON public.voice_call_rates;
DROP POLICY IF EXISTS "Authenticated users can view call rates" ON public.voice_call_rates;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.voice_country_rates;
DROP POLICY IF EXISTS "Authenticated users can view voice_country_rates" ON public.voice_country_rates;
DROP POLICY IF EXISTS "Admins can manage voice_country_rates" ON public.voice_country_rates;
DROP POLICY IF EXISTS "Authenticated users can view country rates" ON public.voice_country_rates;

-- Create proper policies for voice_providers
CREATE POLICY "Admins can manage voice_providers"
  ON public.voice_providers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view voice providers"
  ON public.voice_providers FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create proper policies for voice_provider_routes
CREATE POLICY "Admins can manage voice_provider_routes"
  ON public.voice_provider_routes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view voice routes"
  ON public.voice_provider_routes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create proper policies for voice_call_rates
CREATE POLICY "Admins can manage voice_call_rates"
  ON public.voice_call_rates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view call rates"
  ON public.voice_call_rates FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create proper policies for voice_country_rates
CREATE POLICY "Admins can manage voice_country_rates"
  ON public.voice_country_rates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view country rates"
  ON public.voice_country_rates FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Fix CCA classes - drop permissive, add proper policies
DROP POLICY IF EXISTS "Authenticated users can view cca_classes" ON public.cca_classes;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.cca_classes;
DROP POLICY IF EXISTS "Admins can manage CCA classes" ON public.cca_classes;
DROP POLICY IF EXISTS "Authenticated users can view CCA classes" ON public.cca_classes;

CREATE POLICY "Authenticated users can view CCA classes"
  ON public.cca_classes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage CCA classes"
  ON public.cca_classes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));