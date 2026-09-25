-- Add unique constraint to prevent duplicate employees by email within an organization (excluding soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS employees_organization_email_unique 
ON public.employees (organization_id, email) 
WHERE deleted_at IS NULL;

-- Add unique constraint to prevent duplicate employee numbers within an organization (excluding soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS employees_organization_employee_number_unique 
ON public.employees (organization_id, employee_number) 
WHERE deleted_at IS NULL;