
ALTER TABLE public.leases ADD COLUMN IF NOT EXISTS grace_period_months integer DEFAULT 0;

COMMENT ON COLUMN public.leases.grace_period_months IS 'Number of months at the start of the lease where no payments are due';
