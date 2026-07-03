-- Drop all permissive USING(true) policies that expose payroll data cross-organization

-- employees table - remove overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can update employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can view employees" ON public.employees;

-- pay_stubs table
DROP POLICY IF EXISTS "Authenticated users can manage pay_stubs" ON public.pay_stubs;

-- pay_runs table
DROP POLICY IF EXISTS "Authenticated users can manage pay_runs" ON public.pay_runs;

-- employee_td1 table
DROP POLICY IF EXISTS "Authenticated users can manage td1" ON public.employee_td1;
DROP POLICY IF EXISTS "Authenticated users can manage employee_td1" ON public.employee_td1;

-- roe_records table
DROP POLICY IF EXISTS "Authenticated users can manage roe" ON public.roe_records;
DROP POLICY IF EXISTS "Authenticated users can manage roe_records" ON public.roe_records;

-- tax_slips table
DROP POLICY IF EXISTS "Authenticated users can manage tax_slips" ON public.tax_slips;

-- remittances table
DROP POLICY IF EXISTS "Authenticated users can manage remittances" ON public.remittances;

-- onboarding_tasks table
DROP POLICY IF EXISTS "Authenticated users can manage onboarding" ON public.onboarding_tasks;
DROP POLICY IF EXISTS "Authenticated users can manage onboarding_tasks" ON public.onboarding_tasks;

-- Also check for other tables with potential USING(true) issues
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.employees;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.employees;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.pay_stubs;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.pay_stubs;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.pay_runs;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.pay_runs;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.employee_td1;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.employee_td1;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.roe_records;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.roe_records;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.tax_slips;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.tax_slips;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.remittances;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.remittances;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.onboarding_tasks;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.onboarding_tasks;