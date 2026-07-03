-- Prevent duplicate active employees with the same email in an organization
CREATE UNIQUE INDEX IF NOT EXISTS employees_unique_active_email 
ON employees (organization_id, email) 
WHERE deleted_at IS NULL;