ALTER TABLE public.employees ALTER COLUMN province DROP DEFAULT;
ALTER TABLE public.employees ALTER COLUMN province TYPE text USING province::text;
ALTER TABLE public.employees ALTER COLUMN province SET DEFAULT 'ON';