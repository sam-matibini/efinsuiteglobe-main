-- Add security settings columns to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS two_factor_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS session_timeout_minutes integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS audit_logging_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS lock_closed_periods boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS require_adjustment_approval boolean DEFAULT true;