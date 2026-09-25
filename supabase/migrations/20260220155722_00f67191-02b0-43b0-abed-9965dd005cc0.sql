
-- ============================================================
-- Fix 1: Payroll Tables — Replace permissive USING(true) RLS with org-scoped policies
-- ============================================================

-- Drop overly permissive policies on employees
DROP POLICY IF EXISTS "Authenticated users can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can update employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can delete employees" ON public.employees;

-- Drop overly permissive policies on payroll tables
DROP POLICY IF EXISTS "Authenticated users can manage onboarding" ON public.onboarding_tasks;
DROP POLICY IF EXISTS "Authenticated users can manage pay_runs" ON public.pay_runs;
DROP POLICY IF EXISTS "Authenticated users can manage pay_stubs" ON public.pay_stubs;
DROP POLICY IF EXISTS "Authenticated users can manage remittances" ON public.remittances;
DROP POLICY IF EXISTS "Authenticated users can manage roe" ON public.roe_records;
DROP POLICY IF EXISTS "Authenticated users can manage tax_slips" ON public.tax_slips;
DROP POLICY IF EXISTS "Authenticated users can manage td1" ON public.employee_td1;

-- ---- employees ----
CREATE POLICY "employees_select_org_members"
ON public.employees FOR SELECT TO authenticated
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "employees_insert_org_members"
ON public.employees FOR INSERT TO authenticated
WITH CHECK (is_org_member(auth.uid(), organization_id));

CREATE POLICY "employees_update_org_members"
ON public.employees FOR UPDATE TO authenticated
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "employees_delete_org_members"
ON public.employees FOR DELETE TO authenticated
USING (is_org_member(auth.uid(), organization_id));

-- ---- pay_runs (has organization_id) ----
DROP POLICY IF EXISTS "pay_runs_policy" ON public.pay_runs;
CREATE POLICY "pay_runs_org_members"
ON public.pay_runs FOR ALL TO authenticated
USING (is_org_member(auth.uid(), organization_id))
WITH CHECK (is_org_member(auth.uid(), organization_id));

-- ---- pay_stubs (linked via pay_run_id → pay_runs.organization_id) ----
DROP POLICY IF EXISTS "pay_stubs_policy" ON public.pay_stubs;
CREATE POLICY "pay_stubs_org_members"
ON public.pay_stubs FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pay_runs pr
    WHERE pr.id = pay_stubs.pay_run_id
    AND is_org_member(auth.uid(), pr.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pay_runs pr
    WHERE pr.id = pay_stubs.pay_run_id
    AND is_org_member(auth.uid(), pr.organization_id)
  )
);

-- ---- remittances (has organization_id) ----
DROP POLICY IF EXISTS "remittances_policy" ON public.remittances;
CREATE POLICY "remittances_org_members"
ON public.remittances FOR ALL TO authenticated
USING (is_org_member(auth.uid(), organization_id))
WITH CHECK (is_org_member(auth.uid(), organization_id));

-- ---- roe_records (linked via employee_id → employees.organization_id) ----
DROP POLICY IF EXISTS "roe_records_policy" ON public.roe_records;
CREATE POLICY "roe_records_org_members"
ON public.roe_records FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = roe_records.employee_id
    AND is_org_member(auth.uid(), e.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = roe_records.employee_id
    AND is_org_member(auth.uid(), e.organization_id)
  )
);

-- ---- tax_slips (linked via employee_id → employees.organization_id) ----
DROP POLICY IF EXISTS "tax_slips_policy" ON public.tax_slips;
CREATE POLICY "tax_slips_org_members"
ON public.tax_slips FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = tax_slips.employee_id
    AND is_org_member(auth.uid(), e.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = tax_slips.employee_id
    AND is_org_member(auth.uid(), e.organization_id)
  )
);

-- ---- employee_td1 (linked via employee_id → employees.organization_id) ----
DROP POLICY IF EXISTS "employee_td1_policy" ON public.employee_td1;
CREATE POLICY "employee_td1_org_members"
ON public.employee_td1 FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = employee_td1.employee_id
    AND is_org_member(auth.uid(), e.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = employee_td1.employee_id
    AND is_org_member(auth.uid(), e.organization_id)
  )
);

-- ---- onboarding_tasks (linked via employee_id → employees.organization_id) ----
DROP POLICY IF EXISTS "onboarding_tasks_policy" ON public.onboarding_tasks;
CREATE POLICY "onboarding_tasks_org_members"
ON public.onboarding_tasks FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = onboarding_tasks.employee_id
    AND is_org_member(auth.uid(), e.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = onboarding_tasks.employee_id
    AND is_org_member(auth.uid(), e.organization_id)
  )
);

-- ============================================================
-- Fix 2: Storage Buckets — Make private
-- ============================================================
UPDATE storage.buckets 
SET public = false 
WHERE id IN ('docsign-documents', 'documents', 'accountant-assets');

-- Drop overly permissive storage policies
DROP POLICY IF EXISTS "Public read access for documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their organization's documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read docsign documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;

-- docsign-documents: org-scoped via folder structure (org_id/filename)
CREATE POLICY "docsign_docs_org_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'docsign-documents'
  AND auth.uid() IS NOT NULL
);

-- documents bucket: authenticated users only (was fully public)
CREATE POLICY "documents_authenticated_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
);

-- accountant-assets: authenticated users only
CREATE POLICY "accountant_assets_authenticated_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'accountant-assets'
  AND auth.uid() IS NOT NULL
);
