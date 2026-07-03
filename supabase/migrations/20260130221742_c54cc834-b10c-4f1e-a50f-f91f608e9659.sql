-- Add invoice_logo_url column to organizations table for Bill of Sale branding
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT;