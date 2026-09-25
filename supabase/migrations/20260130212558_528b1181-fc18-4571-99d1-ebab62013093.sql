-- Fix the vendors INSERT policy - arguments were in wrong order
DROP POLICY IF EXISTS "Users can create vendors in their organization" ON public.vendors;

CREATE POLICY "Users can create vendors in their organization" 
ON public.vendors 
FOR INSERT 
WITH CHECK (is_org_member(auth.uid(), organization_id));