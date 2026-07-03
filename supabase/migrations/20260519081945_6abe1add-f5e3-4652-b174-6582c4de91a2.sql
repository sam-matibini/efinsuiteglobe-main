-- Add 'employee' to contact_source enum
ALTER TYPE public.contact_source ADD VALUE IF NOT EXISTS 'employee';